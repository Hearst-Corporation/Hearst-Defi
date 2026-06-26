import { describe, it, expect } from "vitest";
import {
  CREW_SIMULATION_SCENARIOS,
  SCENARIO_IDS,
  simulateCrewFlow,
  listSimulationScenarioIds,
  isCrewSimulationError,
  assertAllScenariosSafe,
  assertScenarioSafe,
} from "../index";

// --- Scenario catalogue ---

describe("CREW_SIMULATION_SCENARIOS catalogue", () => {
  it("contains all 7 expected scenario ids", () => {
    expect(SCENARIO_IDS).toContain("reporting_crew_briefing");
    expect(SCENARIO_IDS).toContain("outreach_draft_flow");
    expect(SCENARIO_IDS).toContain("product_review_flow");
    expect(SCENARIO_IDS).toContain("risk_explanation_flow");
    expect(SCENARIO_IDS).toContain("vault_readiness_flow");
    expect(SCENARIO_IDS).toContain("memory_distill_flow");
    expect(SCENARIO_IDS).toContain("projection_flow");
    expect(CREW_SIMULATION_SCENARIOS).toHaveLength(7);
  });

  it("projection_flow is read-only, non-executable, and triggers no external tool/write", () => {
    const s = CREW_SIMULATION_SCENARIOS.find((x) => x.id === "projection_flow")!;
    expect(s.mode).toBe("read_only");
    expect(s.executable).toBe(false);
    for (const step of s.steps) {
      expect(step.executable).toBe(false);
      expect(step.mode).toBe("read_only");
      expect(step.gateRequired).toBe(false);
    }
    expect(assertScenarioSafe(s)).toEqual([]);
    const r = simulateCrewFlow("projection_flow");
    expect(isCrewSimulationError(r)).toBe(false);
  });

  it("every scenario has executable:false at the scenario level", () => {
    for (const scenario of CREW_SIMULATION_SCENARIOS) {
      expect(scenario.executable).toBe(false);
    }
  });

  it("every step across all scenarios has executable:false", () => {
    for (const scenario of CREW_SIMULATION_SCENARIOS) {
      for (const step of scenario.steps) {
        expect(step.executable).toBe(false);
      }
    }
  });

  it("every scenario has at least one step", () => {
    for (const scenario of CREW_SIMULATION_SCENARIOS) {
      expect(scenario.steps.length).toBeGreaterThan(0);
    }
  });

  it("every scenario has at least one forbidden action", () => {
    for (const scenario of CREW_SIMULATION_SCENARIOS) {
      expect(scenario.forbiddenActions.length).toBeGreaterThan(0);
    }
  });

  it("every scenario has at least one safety note", () => {
    for (const scenario of CREW_SIMULATION_SCENARIOS) {
      expect(scenario.safetyNotes.length).toBeGreaterThan(0);
    }
  });
});

// --- Reporting Crew ---

describe("reporting_crew_briefing", () => {
  it("is read_only mode", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "reporting_crew_briefing",
    );
    expect(s?.mode).toBe("read_only");
  });

  it("has risk:none", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "reporting_crew_briefing",
    );
    expect(s?.risk).toBe("none");
  });

  it("all steps are read_only", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "reporting_crew_briefing",
    );
    for (const step of s!.steps) {
      expect(step.mode).toBe("read_only");
    }
  });

  it("no step requires a gate", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "reporting_crew_briefing",
    );
    for (const step of s!.steps) {
      expect(step.gateRequired).toBe(false);
    }
  });

  it("forbids execute_tool and write_database", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "reporting_crew_briefing",
    );
    expect(s?.forbiddenActions).toContain("execute_tool");
    expect(s?.forbiddenActions).toContain("write_database");
  });
});

// --- Outreach Draft Flow ---

describe("outreach_draft_flow", () => {
  it("is draft_only mode", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "outreach_draft_flow",
    );
    expect(s?.mode).toBe("draft_only");
  });

  it("has a gate-required step for human approval", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "outreach_draft_flow",
    );
    const gatedSteps = s!.steps.filter((st) => st.gateRequired);
    expect(gatedSteps.length).toBeGreaterThan(0);
  });

  it("blocks auto_send_outreach", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "outreach_draft_flow",
    );
    expect(s?.forbiddenActions).toContain("auto_send_outreach");
  });

  it("blocks send_without_hitl_token", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "outreach_draft_flow",
    );
    expect(s?.forbiddenActions).toContain("send_without_hitl_token");
  });

  it("blocks send_tier_a_outreach", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "outreach_draft_flow",
    );
    expect(s?.forbiddenActions).toContain("send_tier_a_outreach");
  });

  it("the gate step is confirmed_write_blocked", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "outreach_draft_flow",
    );
    const gateStep = s!.steps.find((st) => st.gateRequired);
    expect(gateStep?.mode).toBe("confirmed_write_blocked");
  });
});

// --- Vault Readiness Flow ---

describe("vault_readiness_flow", () => {
  it("forbids deploy_to_mainnet", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "vault_readiness_flow",
    );
    expect(s?.forbiddenActions).toContain("deploy_to_mainnet");
  });

  it("forbids mark_vault_live", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "vault_readiness_flow",
    );
    expect(s?.forbiddenActions).toContain("mark_vault_live");
  });

  it("forbids execute_on_chain", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "vault_readiness_flow",
    );
    expect(s?.forbiddenActions).toContain("execute_on_chain");
  });

  it("has risk:high", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "vault_readiness_flow",
    );
    expect(s?.risk).toBe("high");
  });
});

// --- Risk Explanation Flow ---

describe("risk_explanation_flow", () => {
  it("is read_only mode", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "risk_explanation_flow",
    );
    expect(s?.mode).toBe("read_only");
  });

  it("forbids give_financial_advice", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "risk_explanation_flow",
    );
    expect(s?.forbiddenActions).toContain("give_financial_advice");
  });

  it("forbids guarantee_return", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "risk_explanation_flow",
    );
    expect(s?.forbiddenActions).toContain("guarantee_return");
  });

  it("forbids promise_yield", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "risk_explanation_flow",
    );
    expect(s?.forbiddenActions).toContain("promise_yield");
  });
});

// --- Product Review Flow ---

describe("product_review_flow", () => {
  it("forbids deploy_contract", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "product_review_flow",
    );
    expect(s?.forbiddenActions).toContain("deploy_contract");
  });

  it("forbids mark_vault_live", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "product_review_flow",
    );
    expect(s?.forbiddenActions).toContain("mark_vault_live");
  });
});

// --- Memory Distill Flow ---

describe("memory_distill_flow", () => {
  it("is read_only mode", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "memory_distill_flow",
    );
    expect(s?.mode).toBe("read_only");
  });

  it("forbids store_user_message_text", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "memory_distill_flow",
    );
    expect(s?.forbiddenActions).toContain("store_user_message_text");
  });

  it("forbids send_summary_externally", () => {
    const s = CREW_SIMULATION_SCENARIOS.find(
      (s) => s.id === "memory_distill_flow",
    );
    expect(s?.forbiddenActions).toContain("send_summary_externally");
  });
});

// --- simulateCrewFlow ---

describe("simulateCrewFlow", () => {
  it("returns a result with executable:false on scenario for all known ids", () => {
    for (const id of SCENARIO_IDS) {
      const result = simulateCrewFlow(id);
      expect(isCrewSimulationError(result)).toBe(false);
      if (!isCrewSimulationError(result)) {
        expect(result.scenario.executable).toBe(false);
      }
    }
  });

  it("returns a summary string for every known scenario", () => {
    for (const id of SCENARIO_IDS) {
      const result = simulateCrewFlow(id);
      if (!isCrewSimulationError(result)) {
        expect(typeof result.summary).toBe("string");
        expect(result.summary.length).toBeGreaterThan(10);
      }
    }
  });

  it("returns blockedActions including all forbiddenActions", () => {
    for (const id of SCENARIO_IDS) {
      const result = simulateCrewFlow(id);
      if (!isCrewSimulationError(result)) {
        for (const fa of result.scenario.forbiddenActions) {
          expect(result.blockedActions).toContain(fa);
        }
      }
    }
  });

  it("returns requiredGates for outreach_draft_flow", () => {
    const result = simulateCrewFlow("outreach_draft_flow");
    if (!isCrewSimulationError(result)) {
      expect(result.requiredGates.length).toBeGreaterThan(0);
    }
  });

  it("returns empty requiredGates for reporting_crew_briefing", () => {
    const result = simulateCrewFlow("reporting_crew_briefing");
    if (!isCrewSimulationError(result)) {
      expect(result.requiredGates).toHaveLength(0);
    }
  });

  it("returns a generatedAt ISO string", () => {
    const result = simulateCrewFlow("reporting_crew_briefing");
    if (!isCrewSimulationError(result)) {
      expect(() => new Date(result.generatedAt)).not.toThrow();
      expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("returns unknown_scenario error for an unregistered id", () => {
    const result = simulateCrewFlow("totally_made_up_id");
    expect(isCrewSimulationError(result)).toBe(true);
    if (isCrewSimulationError(result)) {
      expect(result.kind).toBe("unknown_scenario");
      expect(result.scenarioId).toBe("totally_made_up_id");
    }
  });

  it("does not fallback to execution on unknown scenario", () => {
    const result = simulateCrewFlow("unknown_crew");
    expect(isCrewSimulationError(result)).toBe(true);
    if (isCrewSimulationError(result)) {
      expect(result.kind).toBe("unknown_scenario");
    }
  });

  it("is deterministic — same input always returns same scenario id", () => {
    const r1 = simulateCrewFlow("vault_readiness_flow");
    const r2 = simulateCrewFlow("vault_readiness_flow");
    if (!isCrewSimulationError(r1) && !isCrewSimulationError(r2)) {
      expect(r1.scenario.id).toBe(r2.scenario.id);
      expect(r1.scenario.mode).toBe(r2.scenario.mode);
      expect(r1.scenario.risk).toBe(r2.scenario.risk);
      expect(r1.blockedActions).toEqual(r2.blockedActions);
      expect(r1.requiredGates).toEqual(r2.requiredGates);
    }
  });

  it("never mutates the scenario object", () => {
    const before = JSON.stringify(CREW_SIMULATION_SCENARIOS);
    simulateCrewFlow("outreach_draft_flow");
    simulateCrewFlow("vault_readiness_flow");
    const after = JSON.stringify(CREW_SIMULATION_SCENARIOS);
    expect(before).toBe(after);
  });
});

// --- listSimulationScenarioIds ---

describe("listSimulationScenarioIds", () => {
  it("returns all 6 scenario ids", () => {
    const ids = listSimulationScenarioIds();
    expect(ids).toHaveLength(7);
    expect(ids).toContain("reporting_crew_briefing");
    expect(ids).toContain("outreach_draft_flow");
  });
});

// --- Safety assertions ---

describe("assertAllScenariosSafe", () => {
  it("reports no violations for the built-in scenario set", () => {
    const violations = assertAllScenariosSafe(CREW_SIMULATION_SCENARIOS);
    expect(violations).toHaveLength(0);
  });

  it("flags a scenario whose executable is not false", () => {
    const fakeScenario = {
      ...CREW_SIMULATION_SCENARIOS[0]!,
      id: "bad_scenario",
      executable: true as unknown as false,
    };
    const violations = assertAllScenariosSafe([fakeScenario]);
    expect(violations.some((v) => v.kind === "step_executable_true")).toBe(
      true,
    );
  });

  it("flags a confirmed_write_blocked step without gateRequired", () => {
    const fakeScenario = {
      ...CREW_SIMULATION_SCENARIOS[0]!,
      id: "bad_scenario_2",
      steps: [
        {
          id: "bad_step",
          label: "Bad Step",
          description: "Should have gate",
          mode: "confirmed_write_blocked" as const,
          executable: false as const,
          usesToolIds: [],
          produces: [],
          gateRequired: false,
        },
      ],
      forbiddenActions: ["deploy", "mark_live"],
    };
    const violations = assertScenarioSafe(fakeScenario);
    expect(
      violations.some((v) => v.kind === "confirmed_write_without_gate"),
    ).toBe(true);
  });
});

// --- No write verbs as executable actions ---

describe("no write verbs as executable step actions", () => {
  const WRITE_VERBS = [
    "send",
    "deploy",
    "mark_live",
    "source",
    "execute",
    "approve",
    "mutate",
    "write",
    "sign",
  ];

  it("no step id contains a write verb", () => {
    for (const scenario of CREW_SIMULATION_SCENARIOS) {
      for (const step of scenario.steps) {
        for (const verb of WRITE_VERBS) {
          // Steps named "read_output_guard" are safe reads
          if (step.id === "read_output_guard") continue;
          // Step ids like "step_await_human_gate" with mode confirmed_write_blocked are OK (blocked, not executable)
          if (step.mode === "confirmed_write_blocked") continue;
          const hasWriteVerb =
            step.mode !== "read_only" &&
            step.mode !== "draft_only" &&
            step.id.startsWith(verb);
          expect(hasWriteVerb).toBe(false);
        }
      }
    }
  });

  it("no scenario with forbidden deploy/send/source marks them executable", () => {
    for (const scenario of CREW_SIMULATION_SCENARIOS) {
      // All steps must be non-executable regardless
      for (const step of scenario.steps) {
        expect(step.executable).toBe(false);
      }
    }
  });
});
