/**
 * Swarm boundary enforcement — evaluateActionReadiness is now swarm-aware.
 *
 * Pure unit tests of the enforcement policy (no DB, no server, no network):
 *  - global tier floor is unchanged and a swarm can only TIGHTEN it;
 *  - outreach_governed_swarm is the first ENFORCING swarm (scope + forbidden);
 *  - the new reason codes (forbidden_by_swarm, action_out_of_swarm_scope) and the
 *    renamed human_confirmation_token_present behave as specified;
 *  - unscoped swarms keep their backward-compatible tier-only behaviour.
 */

import { describe, expect, it } from "vitest";

import {
  evaluateActionReadiness,
  getSwarmDefinition,
  assertAllSwarmsSafe,
  assertSwarmSafe,
  SWARM_DEFINITIONS,
} from "../index";

const outreach = getSwarmDefinition("outreach_governed_swarm")!;
const platform = getSwarmDefinition("platform_reporting_swarm")!;

describe("evaluateActionReadiness — backward compatible without a swarm", () => {
  it("read_only → allow, draft → gated, forbidden → blocked", () => {
    expect(evaluateActionReadiness("read_observability").decision).toBe("allow");
    expect(evaluateActionReadiness("create_vault_draft").decision).toBe("gated");
    expect(
      evaluateActionReadiness("deploy_product", { hasHumanConfirmationToken: true })
        .decision,
    ).toBe("blocked");
  });

  it("confirmed_write needs human without token; allow with token (renamed code)", () => {
    const noTok = evaluateActionReadiness("outreach_trigger_send_run");
    expect(noTok.decision).toBe("requires_human_confirmation");
    expect(noTok.reasonCode).toBe("confirmed_write_needs_human");

    const tok = evaluateActionReadiness("outreach_trigger_send_run", {
      hasHumanConfirmationToken: true,
    });
    expect(tok.decision).toBe("allow");
    expect(tok.reasonCode).toBe("human_confirmation_token_present");
    expect(tok.reasonCode).not.toBe("confirmed_write_token_present"); // renamed
    expect(tok.autonomousAllowed).toBe(false);
  });

  it("a 2-arg call sets swarmScoped=false", () => {
    expect(evaluateActionReadiness("read_observability").swarmScoped).toBe(false);
  });
});

describe("outreach_governed_swarm — enforcing scope", () => {
  it("allows an in-scope read action", () => {
    const e = evaluateActionReadiness("navigate_admin_surface", {}, outreach);
    expect(e.decision).toBe("allow");
    expect(e.reasonCode).toBe("read_only_allowed");
  });

  it("gates an in-scope draft action", () => {
    const e = evaluateActionReadiness("draft_outreach_email", {}, outreach);
    expect(e.decision).toBe("gated");
    expect(e.reasonCode).toBe("draft_requires_gate");
  });

  it("blocks the send-run by swarm policy, even WITH a token", () => {
    const e = evaluateActionReadiness(
      "outreach_trigger_send_run",
      { hasHumanConfirmationToken: true },
      outreach,
    );
    expect(e.decision).toBe("blocked");
    expect(e.reasonCode).toBe("forbidden_by_swarm");
    expect(e.swarmScoped).toBe(true);
    expect(e.autonomousAllowed).toBe(false);
  });

  it("blocks an out-of-scope read action with action_out_of_swarm_scope", () => {
    const e = evaluateActionReadiness("read_observability", {}, outreach);
    expect(e.decision).toBe("blocked");
    expect(e.reasonCode).toBe("action_out_of_swarm_scope");
    expect(e.swarmScoped).toBe(true);
  });

  it("blocks an out-of-scope draft action (scope beats tier-allow-to-gate)", () => {
    const e = evaluateActionReadiness("create_vault_draft", {}, outreach);
    expect(e.decision).toBe("blocked");
    expect(e.reasonCode).toBe("action_out_of_swarm_scope");
  });

  it("a forbidden_autonomous action is blocked by the GLOBAL floor, not the swarm", () => {
    const e = evaluateActionReadiness(
      "deploy_product",
      { hasHumanConfirmationToken: true },
      outreach,
    );
    expect(e.decision).toBe("blocked");
    expect(e.reasonCode).toBe("forbidden_autonomous"); // floor wins over scope
    expect(e.swarmScoped).toBe(false);
  });

  it("an unknown write-like action is still blocked fail-safe", () => {
    const e = evaluateActionReadiness("send_money_now", {}, outreach);
    expect(e.decision).toBe("blocked");
    expect(e.unknown).toBe(true);
  });
});

describe("a swarm can only TIGHTEN, never loosen", () => {
  it("no swarm can turn a forbidden_autonomous action into allow", () => {
    for (const s of SWARM_DEFINITIONS) {
      const e = evaluateActionReadiness(
        "mark_vault_live",
        { hasHumanConfirmationToken: true },
        s,
      );
      expect(e.decision).toBe("blocked");
    }
  });

  it("an unscoped swarm scope keeps tier-only behaviour (read stays allow)", () => {
    // All registered swarms are now scoped, so simulate the backward-compatible
    // path with a synthetic scope that omits allowedActionIds.
    const unscoped = { mode: "simulation" as const, forbiddenActions: [] };
    const e = evaluateActionReadiness("read_observability", {}, unscoped);
    expect(e.decision).toBe("allow");
    expect(e.swarmScoped).toBe(false);
  });

  it("a 2-arg call (no swarm) still resolves by tier only", () => {
    expect(evaluateActionReadiness("read_observability").decision).toBe("allow");
    expect(evaluateActionReadiness("create_vault_draft").decision).toBe("gated");
  });

  it("platform_reporting is now scoped and blocks an out-of-scope draft", () => {
    expect(platform.allowedActionIds).toBeDefined();
    const e = evaluateActionReadiness("draft_outreach_email", {}, platform);
    expect(e.decision).toBe("blocked");
    expect(e.reasonCode).toBe("action_out_of_swarm_scope");
  });
});

describe("registry stays safe with the new scope field", () => {
  it("assertAllSwarmsSafe reports zero violations", () => {
    expect(assertAllSwarmsSafe([...SWARM_DEFINITIONS])).toEqual([]);
  });

  it("flags an allowedActionId that is not in the catalog", () => {
    const bad = { ...outreach, allowedActionIds: ["not_a_real_action"] };
    const v = assertSwarmSafe(bad);
    expect(v.some((x) => x.kind === "allowed_action_not_in_catalog")).toBe(true);
  });
});
