/**
 * CrewSimulationSection — read-only render contract.
 *
 * Verifies the 7 scenario panels, step rails, gates, blocked action chips, and
 * `executable: false` marker — with NO write/action controls and NO run/execute/
 * launch/send/deploy controls. SSR render (repo convention).
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

const NO_RUN_CONTROLS = (html: string) => {
  NO_WRITE_CONTROLS(html);
  const actionable = /<(button|a)[^>]*>\s*(run|execute|launch|send|deploy|source|mark live)\b/i;
  expect(actionable.test(html)).toBe(false);
};

describe("CrewSimulationSection", () => {
  it("renders executable:false marker + read-only note", () => {
    // Canonized 2026-06-29: the "Crew Simulation" heading is provided by the
    // parent AdminSectionCard; the body keeps the executable:false guard marker.
    const html = render(SIMS);
    expect(html).toContain("executable: false");
    NO_RUN_CONTROLS(html);
  });

  it("renders all seven scenarios", () => {
    const html = render(SIMS);
    expect(SIMS).toHaveLength(7);
    for (const s of SIMS) {
      expect(html).toContain(s.scenario.label);
    }
    NO_RUN_CONTROLS(html);
  });

  it("renders step rails with step labels + modes", () => {
    const html = render(SIMS);
    const first = SIMS[0]!.scenario.steps[0]!;
    expect(html).toContain(first.label);
    expect(html).toMatch(/read-only|draft-only|write blocked|forbidden/);
    NO_RUN_CONTROLS(html);
  });

  it("renders gates indicator and blocked action chips when present", () => {
    const html = render(SIMS);
    const withGates = SIMS.find((s) => s.requiredGates.length > 0);
    expect(withGates).toBeDefined();
    expect(html).toContain("gate");
    // Blocked actions are rendered as chips (agentic-flow-blocked), not a "Blocked actions" label
    const withBlocked = SIMS.find((s) => s.blockedActions.length > 0);
    if (withBlocked) {
      expect(html).toContain(withBlocked.blockedActions[0]);
    }
    NO_RUN_CONTROLS(html);
  });

  it("shows executable: false in the section header (simulation guard, once per render)", () => {
    const html = render(SIMS);
    // The marker appears at least once in the global header
    const occurrences = (html.match(/executable: false/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(1);
    NO_RUN_CONTROLS(html);
  });

  it("renders nothing when simulations are null/empty", () => {
    expect(render(null)).toBe("");
    expect(render([])).toBe("");
    expect(render(undefined)).toBe("");
  });
});
