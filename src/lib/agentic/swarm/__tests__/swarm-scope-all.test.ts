/**
 * Swarm scope enforcement — all 5 swarms are now bounded.
 *
 * Pure unit tests (no DB, no server) asserting the enforced scope of each of the
 * 4 swarms extended in this lot, plus the global invariant that NO swarm is left
 * unbounded and NONE can be loosened.
 */

import { describe, expect, it } from "vitest";

import {
  evaluateActionReadiness,
  getSwarmDefinition,
  SWARM_DEFINITIONS,
} from "../index";
import { ACTION_READINESS_ITEMS } from "../../action-readiness";

const def = (id: string) => getSwarmDefinition(id)!;

/** decision for an action against a swarm scope. */
function decide(swarmId: string, actionId: string, token = false) {
  return evaluateActionReadiness(
    actionId,
    { hasHumanConfirmationToken: token },
    def(swarmId),
  );
}

describe("global — every swarm is bounded and safe", () => {
  it("no swarm is left without an enforced scope", () => {
    for (const s of SWARM_DEFINITIONS) {
      expect(Array.isArray(s.allowedActionIds)).toBe(true);
      expect(s.allowedActionIds!.length).toBeGreaterThan(0);
    }
  });

  it("no swarm allows a forbidden_autonomous action (floor holds with token)", () => {
    const forbidden = ACTION_READINESS_ITEMS.filter(
      (a) => a.tier === "forbidden_autonomous",
    ).map((a) => a.id);
    for (const s of SWARM_DEFINITIONS) {
      for (const id of forbidden) {
        expect(decide(s.id, id, true).decision).toBe("blocked");
      }
    }
  });

  it("every allowedActionId is a real catalog id", () => {
    const catalog = new Set(ACTION_READINESS_ITEMS.map((a) => a.id));
    for (const s of SWARM_DEFINITIONS) {
      for (const id of s.allowedActionIds ?? []) {
        expect(catalog.has(id)).toBe(true);
      }
    }
  });
});

describe("platform_reporting_swarm — read/report scope", () => {
  it("allows in-scope reads, blocks out-of-scope drafts/outreach", () => {
    expect(decide("platform_reporting_swarm", "read_observability").decision).toBe("allow");
    expect(decide("platform_reporting_swarm", "compose_reporting_briefing").decision).toBe("allow");
    expect(decide("platform_reporting_swarm", "create_vault_draft").reasonCode).toBe("action_out_of_swarm_scope");
    expect(decide("platform_reporting_swarm", "draft_outreach_email").reasonCode).toBe("action_out_of_swarm_scope");
  });
  it("blocks the send-run by swarm and forbidden global", () => {
    expect(decide("platform_reporting_swarm", "outreach_trigger_send_run", true).reasonCode).toBe("forbidden_by_swarm");
    expect(decide("platform_reporting_swarm", "deploy_product", true).reasonCode).toBe("forbidden_autonomous");
  });
});

describe("lp_explainer_swarm — explain scope (incl. risk + provenance)", () => {
  it("allows all four explain actions", () => {
    expect(decide("lp_explainer_swarm", "explain_product").decision).toBe("allow");
    expect(decide("lp_explainer_swarm", "explain_yield").decision).toBe("allow");
    expect(decide("lp_explainer_swarm", "explain_risk").decision).toBe("allow");
    expect(decide("lp_explainer_swarm", "explain_risk").reasonCode).toBe("read_only_allowed");
    expect(decide("lp_explainer_swarm", "explain_provenance").decision).toBe("allow");
    expect(decide("lp_explainer_swarm", "explain_provenance").reasonCode).toBe("read_only_allowed");
  });
  it("blocks drafts/outreach/sends", () => {
    expect(decide("lp_explainer_swarm", "draft_outreach_email").reasonCode).toBe("action_out_of_swarm_scope");
    expect(decide("lp_explainer_swarm", "create_vault_draft").reasonCode).toBe("action_out_of_swarm_scope");
    expect(decide("lp_explainer_swarm", "outreach_trigger_send_run", true).reasonCode).toBe("forbidden_by_swarm");
    expect(decide("lp_explainer_swarm", "deploy_product", true).reasonCode).toBe("forbidden_autonomous");
  });
});

describe("vault_governance_swarm — governance dry-run scope", () => {
  it("gates in-scope vault/governance drafts, blocks outreach + live mutation", () => {
    expect(decide("vault_governance_swarm", "create_vault_draft").decision).toBe("gated");
    expect(decide("vault_governance_swarm", "create_governance_proposal_draft").decision).toBe("gated");
    expect(decide("vault_governance_swarm", "create_review_note_draft").decision).toBe("gated");
    expect(decide("vault_governance_swarm", "read_observability").decision).toBe("allow");
    expect(decide("vault_governance_swarm", "draft_outreach_email").reasonCode).toBe("action_out_of_swarm_scope");
    // deploy/mark_live are forbidden_autonomous → floor reports forbidden_autonomous.
    expect(decide("vault_governance_swarm", "deploy_product", true).decision).toBe("blocked");
    expect(decide("vault_governance_swarm", "mark_vault_live", true).decision).toBe("blocked");
  });
});

describe("memory_maintenance_swarm — enforce minimal useful (read_session_context)", () => {
  it("allows its read-only scope incl. metadata-only session context", () => {
    expect(decide("memory_maintenance_swarm", "navigate_admin_surface").decision).toBe("allow");
    expect(decide("memory_maintenance_swarm", "read_observability").decision).toBe("allow");
    expect(decide("memory_maintenance_swarm", "read_session_context").decision).toBe("allow");
    expect(decide("memory_maintenance_swarm", "read_session_context").reasonCode).toBe("read_only_allowed");
  });
  it("blocks unrelated product/vault/outreach actions and the floor", () => {
    expect(decide("memory_maintenance_swarm", "explain_product").reasonCode).toBe("action_out_of_swarm_scope");
    expect(decide("memory_maintenance_swarm", "create_vault_draft").reasonCode).toBe("action_out_of_swarm_scope");
    expect(decide("memory_maintenance_swarm", "draft_outreach_email").reasonCode).toBe("action_out_of_swarm_scope");
    expect(decide("memory_maintenance_swarm", "outreach_trigger_send_run", true).reasonCode).toBe("forbidden_by_swarm");
    expect(decide("memory_maintenance_swarm", "deploy_product", true).reasonCode).toBe("forbidden_autonomous");
  });
});

describe("product_projection_swarm — read-only projection scope", () => {
  it("allows run_projection + explain actions, blocks outreach/vault/forbidden", () => {
    expect(decide("product_projection_swarm", "run_projection").decision).toBe("allow");
    expect(decide("product_projection_swarm", "run_projection").reasonCode).toBe("read_only_allowed");
    expect(decide("product_projection_swarm", "explain_risk").decision).toBe("allow");
    expect(decide("product_projection_swarm", "explain_provenance").decision).toBe("allow");
    expect(decide("product_projection_swarm", "draft_outreach_email").reasonCode).toBe("action_out_of_swarm_scope");
    expect(decide("product_projection_swarm", "create_vault_draft").reasonCode).toBe("action_out_of_swarm_scope");
    expect(decide("product_projection_swarm", "outreach_trigger_send_run", true).reasonCode).toBe("forbidden_by_swarm");
    expect(decide("product_projection_swarm", "deploy_product", true).reasonCode).toBe("forbidden_autonomous");
  });
});

describe("new read-only utility actions are well-formed", () => {
  it("explain_risk / explain_provenance / read_session_context / run_projection are read_only, non-autonomous-by-policy", () => {
    for (const id of ["explain_risk", "explain_provenance", "read_session_context", "run_projection"]) {
      const e = evaluateActionReadiness(id); // no swarm → tier only
      expect(e.tier).toBe("read_only");
      expect(e.decision).toBe("allow");
      expect(e.reasonCode).toBe("read_only_allowed");
      expect(e.autonomousAllowed).toBe(false);
      expect(e.unknown).toBe(false);
    }
  });
});

describe("outreach_governed_swarm — unchanged (regression guard)", () => {
  it("still enforces draft-only scope", () => {
    expect(decide("outreach_governed_swarm", "navigate_admin_surface").decision).toBe("allow");
    expect(decide("outreach_governed_swarm", "draft_outreach_email").decision).toBe("gated");
    expect(decide("outreach_governed_swarm", "outreach_trigger_send_run", true).reasonCode).toBe("forbidden_by_swarm");
    expect(decide("outreach_governed_swarm", "read_observability").reasonCode).toBe("action_out_of_swarm_scope");
  });
});
