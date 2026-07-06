/**
 * simulateSwarm — fail-safe branches that no REAL registry entry ever reaches.
 *
 * Gap found by the agentic-full-test series (batch 3/6, zone 2 — see
 * docs/projects/agentic-full-test/COVERAGE_MATRIX.md): every SWARM_DEFINITIONS
 * entry composes only known crews with scenario-level mode "read_only" or
 * "draft_only", so simulate-swarm.ts's `unknown_crew` return and the
 * "forbidden" / "confirmed_write_blocked" branches of its audit reasonCode
 * (crewModeToBlocked) are unreachable with real data — `assertSwarmSafe`
 * covers the *registry-shape* "unknown crew" violation (swarm.test.ts) but not
 * simulateSwarm's own runtime reject, and no scenario ever has scenario-level
 * mode "forbidden" or "confirmed_write_blocked" (only steps do). These tests
 * exercise those branches directly via a mocked crew-simulation module.
 */

import { describe, expect, it, vi } from "vitest";
import type { CrewSimulationResult, CrewSimulationError } from "../../crew-simulation/types";
import type { SwarmDefinition } from "../types";

const BROKEN_SWARM: SwarmDefinition = {
  id: "test_only_broken_crew_swarm",
  label: "Test-only swarm with an unregistered crew reference",
  description: "Fixture for the unknown_crew fail-safe path — never a real registered swarm.",
  mode: "simulation",
  coordination: "sequential",
  crewIds: ["does_not_exist_crew"],
  forbiddenActions: ["outreach_trigger_send_run"],
  allowedActionIds: ["navigate_admin_surface"],
  safetyNotes: ["test fixture only"],
};

// No SWARM_DEFINITIONS entry ever composes a scenario with scenario-level mode
// "forbidden" or "confirmed_write_blocked" (only individual steps do) — this
// fixture exercises both branches of simulate-swarm.ts's crewModeToBlocked /
// audit reasonCode logic, which are otherwise dead code against real data.
const SCOPED_SWARM: SwarmDefinition = {
  id: "test_only_scoped_crew_modes_swarm",
  label: "Test-only swarm composing forbidden + confirmed_write_blocked crews",
  description: "Fixture for the crew_blocked_forbidden / crew_blocked_missing_confirmation reasonCodes.",
  mode: "gated",
  coordination: "sequential",
  crewIds: ["test_forbidden_crew", "test_confirmed_write_blocked_crew"],
  forbiddenActions: [],
  safetyNotes: ["test fixture only"],
};

function fixtureResult(
  scenarioId: string,
  mode: CrewSimulationResult["scenario"]["mode"],
  requiredGates: string[],
): CrewSimulationResult {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    scenario: {
      id: scenarioId,
      label: scenarioId,
      trigger: "test fixture",
      mode,
      risk: "high",
      executable: false,
      steps: [],
      forbiddenActions: ["some_forbidden_action"],
      safetyNotes: ["test fixture"],
    },
    summary: `Fixture simulation of "${scenarioId}".`,
    blockedActions: ["some_forbidden_action"],
    requiredGates,
  };
}

vi.mock("../registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../registry")>();
  return {
    ...actual,
    getSwarmDefinition: (id: string) => {
      if (id === BROKEN_SWARM.id) return BROKEN_SWARM;
      if (id === SCOPED_SWARM.id) return SCOPED_SWARM;
      return actual.getSwarmDefinition(id);
    },
  };
});

vi.mock("../../crew-simulation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../crew-simulation")>();
  return {
    ...actual,
    simulateCrewFlow: (id: string): CrewSimulationResult | CrewSimulationError => {
      if (id === "does_not_exist_crew") {
        return {
          kind: "unknown_scenario",
          scenarioId: id,
          message: `No simulation scenario registered for id "${id}". No fallback execution will occur.`,
        };
      }
      if (id === "test_forbidden_crew") {
        return fixtureResult(id, "forbidden", []);
      }
      if (id === "test_confirmed_write_blocked_crew") {
        return fixtureResult(id, "confirmed_write_blocked", ["human_gate"]);
      }
      return actual.simulateCrewFlow(id);
    },
    isCrewSimulationError: actual.isCrewSimulationError,
  };
});

const { simulateSwarm, isSwarmSimulationError } = await import("../simulate-swarm");

describe("simulateSwarm — unknown crew reference (fail-safe, no partial run)", () => {
  it("returns a typed unknown_crew error instead of a partial simulation result", () => {
    const r = simulateSwarm(BROKEN_SWARM.id);
    expect(isSwarmSimulationError(r)).toBe(true);
    if (!isSwarmSimulationError(r)) throw new Error("expected a simulation error");
    expect(r.kind).toBe("unknown_crew");
    expect(r.swarmId).toBe(BROKEN_SWARM.id);
    expect(r.crewId).toBe("does_not_exist_crew");
    expect(r.reasonCode).toBe("crew_unavailable");
    expect(r.message).toMatch(/unknown crew/i);
    expect(r.message).toMatch(/no fallback execution/i);
  });

  it("never returns a steps/audit array on the unknown_crew error (not a mixed shape)", () => {
    const r = simulateSwarm(BROKEN_SWARM.id);
    expect(r).not.toHaveProperty("steps");
    expect(r).not.toHaveProperty("audit");
  });
});
