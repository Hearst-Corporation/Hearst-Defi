/**
 * Swarm foundation — exhaustive invariants.
 *
 * Covers: registry stability, safe modes, crew existence, deterministic
 * simulation, the readiness safety contract (forbidden never executes,
 * confirmed_write needs HITL, unknown blocked, read-only allowed), and the
 * absence of any execution/DB/network/tool side effect.
 */

import { describe, expect, it } from "vitest";

import {
  SWARM_DEFINITIONS,
  SWARM_IDS,
  getSwarmDefinition,
  simulateSwarm,
  isSwarmSimulationError,
  listSwarmIds,
  assertAllSwarmsSafe,
  assertSwarmSafe,
  evaluateActionReadiness,
} from "../index";
import { listSimulationScenarioIds } from "../../crew-simulation";

describe("swarm registry", () => {
  it("is non-empty and every swarm has a stable shape", () => {
    expect(SWARM_DEFINITIONS.length).toBeGreaterThan(0);
    for (const s of SWARM_DEFINITIONS) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.crewIds.length).toBeGreaterThan(0);
      expect(Array.isArray(s.forbiddenActions)).toBe(true);
      expect(Array.isArray(s.safetyNotes)).toBe(true);
    }
  });

  it("exposes ids consistently across registry and helpers", () => {
    expect([...SWARM_IDS].sort()).toEqual(
      SWARM_DEFINITIONS.map((s) => s.id).sort(),
    );
    expect([...listSwarmIds()].sort()).toEqual([...SWARM_IDS].sort());
  });

  it("has unique swarm ids", () => {
    expect(new Set(SWARM_IDS).size).toBe(SWARM_IDS.length);
  });

  it("only uses the safe execution modes (never autonomous_write)", () => {
    for (const s of SWARM_DEFINITIONS) {
      expect(["simulation", "dry_run", "gated"]).toContain(s.mode);
    }
  });

  it("references only existing crews", () => {
    const known = new Set(listSimulationScenarioIds());
    for (const s of SWARM_DEFINITIONS) {
      for (const crewId of s.crewIds) {
        expect(known.has(crewId)).toBe(true);
      }
    }
  });
});

describe("swarm safety assertions", () => {
  it("reports zero violations across all registered swarms", () => {
    expect(assertAllSwarmsSafe([...SWARM_DEFINITIONS])).toEqual([]);
  });

  it("flags an unsafe mode", () => {
    const bad = {
      ...SWARM_DEFINITIONS[0]!,
      mode: "autonomous_write" as unknown as "gated",
    };
    const v = assertSwarmSafe(bad);
    expect(v.some((x) => x.kind === "unsafe_mode")).toBe(true);
  });

  it("flags an unknown crew reference", () => {
    const bad = { ...SWARM_DEFINITIONS[0]!, crewIds: ["does_not_exist"] };
    const v = assertSwarmSafe(bad);
    expect(v.some((x) => x.kind === "unknown_crew")).toBe(true);
  });

  it("requires vault/product swarms to forbid deploy and mark_live", () => {
    const bad = {
      ...SWARM_DEFINITIONS.find((s) => s.id === "vault_governance_swarm")!,
      forbiddenActions: [],
    };
    const kinds = assertSwarmSafe(bad).map((x) => x.kind);
    expect(kinds).toContain("missing_deploy_forbidden");
    expect(kinds).toContain("missing_mark_live_forbidden");
  });

  it("requires outreach swarms to forbid send", () => {
    const bad = {
      ...SWARM_DEFINITIONS.find((s) => s.id === "outreach_governed_swarm")!,
      forbiddenActions: ["write_to_db"],
    };
    expect(
      assertSwarmSafe(bad).some((x) => x.kind === "missing_send_forbidden"),
    ).toBe(true);
  });
});

describe("simulateSwarm — determinism & no side effects", () => {
  it("simulates every registered swarm without error", () => {
    for (const id of SWARM_IDS) {
      const r = simulateSwarm(id);
      expect(isSwarmSimulationError(r)).toBe(false);
    }
  });

  it("is deterministic — identical output for identical input", () => {
    for (const id of SWARM_IDS) {
      expect(simulateSwarm(id)).toEqual(simulateSwarm(id));
    }
  });

  it("produces no wall-clock value (no Date dependency)", () => {
    // A deterministic result must not embed an ISO timestamp anywhere.
    const json = JSON.stringify(simulateSwarm(SWARM_IDS[0]!));
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("every step is non-executable and rolls up gates/blocked actions", () => {
    const r = simulateSwarm("vault_governance_swarm");
    if (isSwarmSimulationError(r)) throw new Error("unexpected error");
    expect(r.steps.length).toBeGreaterThan(0);
    for (const step of r.steps) {
      expect(step.executable).toBe(false);
    }
    // The gated swarm forbids deploy + mark_live.
    expect(r.blockedActions).toContain("deploy_product");
    expect(r.blockedActions).toContain("mark_vault_live");
  });

  it("a gated swarm surfaces required confirmations; simulation swarms do not", () => {
    const gated = simulateSwarm("outreach_governed_swarm");
    const sim = simulateSwarm("platform_reporting_swarm");
    if (isSwarmSimulationError(gated) || isSwarmSimulationError(sim)) {
      throw new Error("unexpected error");
    }
    expect(gated.executionMode).toBe("gated");
    expect(gated.requiredConfirmations.length).toBeGreaterThan(0);
    expect(sim.executionMode).toBe("simulation");
    expect(sim.requiredConfirmations).toEqual([]);
  });

  it("emits a pure audit trail with no prompt/user text", () => {
    const r = simulateSwarm("outreach_governed_swarm");
    if (isSwarmSimulationError(r)) throw new Error("unexpected error");
    expect(r.audit[0]!.kind).toBe("swarm_simulated");
    for (const ev of r.audit) {
      expect(ev.executionMode).toBe("gated");
      expect(typeof ev.reasonCode).toBe("string");
      // audit carries only ids + codes, never free text fields.
      expect(ev).not.toHaveProperty("prompt");
      expect(ev).not.toHaveProperty("userText");
    }
  });

  it("makes no network / DB call during simulation", () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      throw new Error("network not allowed in a pure simulation");
    }) as typeof fetch;
    try {
      const r = simulateSwarm("platform_reporting_swarm");
      expect(isSwarmSimulationError(r)).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
    expect(called).toBe(false);
  });
});

describe("simulateSwarm — fail-safe errors (no execution fallback)", () => {
  it("returns unknown_swarm for an unregistered id", () => {
    const r = simulateSwarm("not_a_real_swarm");
    expect(isSwarmSimulationError(r)).toBe(true);
    if (isSwarmSimulationError(r)) {
      expect(r.kind).toBe("unknown_swarm");
      expect(r.message).toMatch(/no fallback execution/i);
    }
  });

  it("getSwarmDefinition returns undefined for unknown id", () => {
    expect(getSwarmDefinition("nope")).toBeUndefined();
  });
});

describe("evaluateActionReadiness — HITL & forbidden contract", () => {
  it("allows a read-only action", () => {
    const e = evaluateActionReadiness("read_observability");
    expect(e.decision).toBe("allow");
    expect(e.autonomousAllowed).toBe(false);
  });

  it("gates a draft/proposal action", () => {
    const e = evaluateActionReadiness("create_vault_draft");
    expect(e.decision).toBe("gated");
    expect(e.autonomousAllowed).toBe(false);
  });

  it("requires human confirmation for confirmed_write without a token", () => {
    const e = evaluateActionReadiness("outreach_trigger_send_run");
    expect(e.decision).toBe("requires_human_confirmation");
  });

  it("allows confirmed_write ONLY with an explicit confirmation token", () => {
    const e = evaluateActionReadiness("outreach_trigger_send_run", {
      hasHumanConfirmationToken: true,
    });
    expect(e.decision).toBe("allow");
    expect(e.autonomousAllowed).toBe(false); // still never autonomous
  });

  it("always blocks forbidden_autonomous, even with a token", () => {
    for (const id of ["deploy_product", "mark_vault_live", "source_leads_autonomously"]) {
      const e = evaluateActionReadiness(id, { hasHumanConfirmationToken: true });
      expect(e.decision).toBe("blocked");
      expect(e.reasonCode).toBe("forbidden_autonomous");
    }
  });

  it("blocks an unknown write-like action (fail-safe)", () => {
    const e = evaluateActionReadiness("send_money_to_attacker");
    expect(e.unknown).toBe(true);
    expect(e.decision).toBe("blocked");
    expect(e.reasonCode).toMatch(/^unknown_action:/);
  });

  it("treats an unknown non-write action as read-only/allow but never autonomous", () => {
    const e = evaluateActionReadiness("inspect_some_readonly_thing");
    expect(e.unknown).toBe(true);
    expect(e.autonomousAllowed).toBe(false);
    expect(e.decision).toBe("allow");
  });
});
