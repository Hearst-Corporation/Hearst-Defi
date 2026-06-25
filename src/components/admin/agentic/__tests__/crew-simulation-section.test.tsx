/**
 * CrewSimulationSection — read-only render contract.
 *
 * Verifies the 6 scenario flow cards, step rails, gates, blocked actions, the
 * prominent `executable: false` markers, and risk chips — with NO write/action
 * controls and NO Run / Execute / Launch / Send / Deploy / Mark live controls.
 * SSR render (repo convention).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CrewSimulationSection } from "@/components/admin/agentic/crew-simulation-section";
import {
  CREW_SIMULATION_SCENARIOS,
  simulateCrewFlow,
  isCrewSimulationError,
} from "@/lib/agentic/crew-simulation";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";

const SIMS: CrewSimulationResult[] = CREW_SIMULATION_SCENARIOS.map((s) =>
  simulateCrewFlow(s.id),
).filter((r): r is CrewSimulationResult => !isCrewSimulationError(r));

function render(sims: CrewSimulationResult[] | null | undefined): string {
  return renderToStaticMarkup(<CrewSimulationSection simulations={sims} />);
}

const NO_WRITE_CONTROLS = (html: string) => {
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<form");
  expect(html).not.toContain("<input");
};

/** There must be no actionable run/launch control — a button with such a label. */
const NO_RUN_CONTROLS = (html: string) => {
  NO_WRITE_CONTROLS(html);
  // No <button>/<a> whose visible text is an execution verb.
  const actionable = /<(button|a)[^>]*>\s*(run|execute|launch|send|deploy|source|mark live)\b/i;
  expect(actionable.test(html)).toBe(false);
};

describe("CrewSimulationSection", () => {
  it("renders heading + executable:false marker", () => {
    const html = render(SIMS);
    expect(html).toContain("Crew Simulation");
    expect(html).toContain("executable: false");
    expect(html).toContain("read-only");
    NO_RUN_CONTROLS(html);
  });

  it("renders all six scenarios", () => {
    const html = render(SIMS);
    expect(SIMS).toHaveLength(6);
    for (const s of SIMS) {
      expect(html).toContain(s.scenario.label);
    }
    NO_RUN_CONTROLS(html);
  });

  it("renders step rails with step labels + modes", () => {
    const html = render(SIMS);
    // first scenario's first step label appears
    const first = SIMS[0]!.scenario.steps[0]!;
    expect(html).toContain(first.label);
    // mode labels
    expect(html).toMatch(/read-only|draft-only|confirmed-write|forbidden/);
    NO_RUN_CONTROLS(html);
  });

  it("renders gates + blocked actions", () => {
    const html = render(SIMS);
    // at least one scenario has gates / blocked actions
    const withGates = SIMS.find((s) => s.requiredGates.length > 0);
    expect(withGates).toBeDefined();
    expect(html).toContain("gate");
    const withBlocked = SIMS.find((s) => s.blockedActions.length > 0);
    if (withBlocked) {
      expect(html).toContain("Blocked actions");
    }
    NO_RUN_CONTROLS(html);
  });

  it("each scenario shows executable: false (never a run control)", () => {
    const html = render(SIMS);
    // executable: false marker appears once per scenario + the header
    const occurrences = (html.match(/executable: false/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(SIMS.length);
    NO_RUN_CONTROLS(html);
  });

  it("renders nothing when simulations are null/empty", () => {
    expect(render(null)).toBe("");
    expect(render([])).toBe("");
    expect(render(undefined)).toBe("");
  });
});
