/**
 * Swarm calibration — non-destructive safety net.
 *
 * Exercises the FULL agentic chain in-process (pure functions only: no DB, no
 * server, no network, no external tool, no business mutation) and asserts the
 * safety invariants that must hold for EVERY registered swarm and EVERY action
 * tier. It fails the build if a swarm becomes unsafe (e.g. gains an
 * autonomous-write mode, stops blocking a forbidden action, or lets a
 * confirmed-write through without a human confirmation).
 *
 * This is the executable form of the calibration campaign — run it as a guard:
 *   pnpm test -- src/lib/agentic/__tests__/swarm-calibration.test.ts
 */

import { describe, expect, it } from "vitest";

import {
  SWARM_DEFINITIONS,
  SWARM_IDS,
  simulateSwarm,
  isSwarmSimulationError,
  assertAllSwarmsSafe,
  evaluateActionReadiness,
} from "../swarm";
import { ACTION_READINESS_ITEMS } from "../action-readiness";
import type { ActionReadinessTier } from "../action-readiness/types";

const SAFE_MODES = ["simulation", "dry_run", "gated"] as const;

function actionsByTier(tier: ActionReadinessTier): string[] {
  return ACTION_READINESS_ITEMS.filter((a) => a.tier === tier).map((a) => a.id);
}

describe("swarm calibration — registry safety", () => {
  it("every registered swarm uses a safe mode (never autonomous_write)", () => {
    for (const s of SWARM_DEFINITIONS) {
      expect(SAFE_MODES).toContain(s.mode);
      expect((s.mode as string)).not.toBe("autonomous_write");
    }
  });

  it("the swarm safety assertions report zero violations", () => {
    expect(assertAllSwarmsSafe([...SWARM_DEFINITIONS])).toEqual([]);
  });

  it("has at least the five known swarms", () => {
    for (const id of [
      "platform_reporting_swarm",
      "lp_explainer_swarm",
      "vault_governance_swarm",
      "outreach_governed_swarm",
      "memory_maintenance_swarm",
    ]) {
      expect(SWARM_IDS).toContain(id);
    }
  });
});

describe("swarm calibration — simulation invariants (every swarm)", () => {
  it("simulates every swarm with no side effects and non-executable steps", () => {
    for (const id of SWARM_IDS) {
      const r = simulateSwarm(id);
      expect(isSwarmSimulationError(r)).toBe(false);
      if (isSwarmSimulationError(r)) continue;
      expect(SAFE_MODES).toContain(r.executionMode);
      for (const step of r.steps) {
        expect(step.executable).toBe(false);
      }
      // No wall-clock value embedded → deterministic.
      expect(JSON.stringify(r)).not.toMatch(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
      // Only a gated swarm surfaces required confirmations.
      if (r.executionMode === "gated") {
        expect(r.requiredConfirmations.length).toBeGreaterThan(0);
      } else {
        expect(r.requiredConfirmations).toEqual([]);
      }
    }
  });

  it("is deterministic — identical output for identical swarm id", () => {
    for (const id of SWARM_IDS) {
      expect(simulateSwarm(id)).toEqual(simulateSwarm(id));
    }
  });

  it("an unknown swarm fails safe (no fallback execution)", () => {
    const r = simulateSwarm("definitely_not_a_registered_swarm");
    expect(isSwarmSimulationError(r)).toBe(true);
    if (isSwarmSimulationError(r)) expect(r.kind).toBe("unknown_swarm");
  });
});

describe("swarm calibration — HITL & forbidden contract (every action tier)", () => {
  it("EVERY forbidden_autonomous action stays blocked, even WITH a token", () => {
    const forbidden = actionsByTier("forbidden_autonomous");
    expect(forbidden.length).toBeGreaterThan(0);
    for (const id of forbidden) {
      const e = evaluateActionReadiness(id, { hasHumanConfirmationToken: true });
      expect(e.decision).toBe("blocked");
      expect(e.reasonCode).toBe("forbidden_autonomous");
      expect(e.autonomousAllowed).toBe(false);
    }
  });

  it("EVERY confirmed_write action requires human confirmation without a token", () => {
    const confirmed = actionsByTier("confirmed_write");
    expect(confirmed.length).toBeGreaterThan(0);
    for (const id of confirmed) {
      const e = evaluateActionReadiness(id);
      expect(e.decision).toBe("requires_human_confirmation");
      expect(e.autonomousAllowed).toBe(false);
    }
  });

  it("confirmed_write becomes allowed WITH a token but is never autonomous", () => {
    for (const id of actionsByTier("confirmed_write")) {
      const e = evaluateActionReadiness(id, { hasHumanConfirmationToken: true });
      expect(e.decision).toBe("allow");
      expect(e.autonomousAllowed).toBe(false);
    }
  });

  it("EVERY draft_or_proposal action is gated (never autonomous)", () => {
    for (const id of actionsByTier("draft_or_proposal")) {
      const e = evaluateActionReadiness(id);
      expect(e.decision).toBe("gated");
      expect(e.autonomousAllowed).toBe(false);
    }
  });

  it("EVERY read_only action is allowed but never autonomous-write", () => {
    for (const id of actionsByTier("read_only")) {
      const e = evaluateActionReadiness(id);
      expect(e.decision).toBe("allow");
      expect(e.autonomousAllowed).toBe(false);
    }
  });

  it("an unknown write-like action is blocked fail-safe", () => {
    const e = evaluateActionReadiness("send_money_to_attacker");
    expect(e.unknown).toBe(true);
    expect(e.decision).toBe("blocked");
    expect(e.reasonCode).toMatch(/^unknown_action:/);
  });
});

describe("swarm calibration — full cross matrix (swarm × forbidden action)", () => {
  it("no (swarm, forbidden action) pair can ever resolve to allow", () => {
    // The global floor must hold even when the swarm scope is threaded in.
    for (const swarm of SWARM_DEFINITIONS) {
      const sim = simulateSwarm(swarm.id);
      expect(isSwarmSimulationError(sim)).toBe(false);
      for (const actionId of actionsByTier("forbidden_autonomous")) {
        const e = evaluateActionReadiness(
          actionId,
          { hasHumanConfirmationToken: true },
          swarm,
        );
        expect(e.decision).toBe("blocked");
      }
    }
  });
});

describe("swarm calibration — enforcement is active for scoped swarms", () => {
  it("an enforcing swarm blocks an out-of-scope action it does not allow", () => {
    const scoped = SWARM_DEFINITIONS.filter((s) => s.allowedActionIds);
    expect(scoped.length).toBeGreaterThan(0); // outreach_governed_swarm at least
    for (const swarm of scoped) {
      // Find a catalog action the swarm neither allows nor forbids.
      const outOfScope = ACTION_READINESS_ITEMS.find(
        (a) =>
          a.tier !== "forbidden_autonomous" &&
          !swarm.allowedActionIds!.includes(a.id) &&
          !swarm.forbiddenActions.includes(a.id),
      );
      expect(outOfScope).toBeDefined();
      const e = evaluateActionReadiness(outOfScope!.id, {}, swarm);
      expect(e.decision).toBe("blocked");
      expect(e.reasonCode).toBe("action_out_of_swarm_scope");
      expect(e.swarmScoped).toBe(true);
    }
  });

  it("a swarm-forbidden action stays blocked even with a token", () => {
    for (const swarm of SWARM_DEFINITIONS) {
      for (const actionId of swarm.forbiddenActions) {
        // Only assert on catalog ids (free-text labels never match an action).
        if (!ACTION_READINESS_ITEMS.some((a) => a.id === actionId)) continue;
        const e = evaluateActionReadiness(
          actionId,
          { hasHumanConfirmationToken: true },
          swarm,
        );
        expect(e.decision).toBe("blocked");
      }
    }
  });
});
