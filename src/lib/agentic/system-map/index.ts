// Agentic System Map v0 — barrel + entry point.
//
// A pure, read-only visual graph of the agentic system, composed from the data
// the platform already produces. No tool is executed, no LLM is called, no write
// is performed. The builder is pure; the entry point just threads the (already
// best-effort) summaries the admin page has into it.

import { buildAgenticSystemMap } from "./build-system-map";
import { buildActionReadinessMatrix } from "@/lib/agentic/action-readiness";
import {
  CREW_SIMULATION_SCENARIOS,
  simulateCrewFlow,
  isCrewSimulationError,
} from "@/lib/agentic/crew-simulation";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";
import type { CrewSimulationResult } from "@/lib/agentic/crew-simulation/types";
import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ReportingCrewBriefing } from "@/lib/agentic/reporting/types";
import type { AgenticSystemMap } from "./types";

export * from "./types";
export { buildAgenticSystemMap, GROUP } from "./build-system-map";
export {
  deriveRouterStatus,
  deriveObservabilityStatus,
  deriveQualityStatus,
  deriveToolBoundaryStatus,
  deriveReportingStatus,
} from "./derive-system-map-status";

/** Static marker for the readiness matrix — pure code has no Date.now. */
const STATIC_GENERATED_AT = "live read-only (static marker)";

/**
 * Build the action-readiness matrix (pure). Best-effort: returns null if the
 * matrix's build-time consistency validation throws. No I/O, no tool execution.
 */
export function getActionReadinessMatrix(): ActionReadinessMatrix | null {
  try {
    return buildActionReadinessMatrix(STATIC_GENERATED_AT);
  } catch {
    return null;
  }
}

/**
 * Build every crew-simulation result (pure, read-only). Each scenario is
 * `executable: false`; nothing is run. Errors for unknown scenarios are dropped.
 */
export function getCrewSimulations(): CrewSimulationResult[] {
  return CREW_SIMULATION_SCENARIOS.map((s) => simulateCrewFlow(s.id)).filter(
    (r): r is CrewSimulationResult => !isCrewSimulationError(r),
  );
}

/**
 * Build the read-only system map from the page's already-fetched summaries plus
 * the pure action-readiness + crew-simulation modules (computed here — both are
 * pure, no I/O). `observability` / `reporting` may be null (best-effort) and the
 * affected nodes degrade to no_data. Never throws.
 */
export function getAgenticSystemMap(inputs: {
  controlCenter: AgenticControlCenterData;
  observability: RouterObservabilitySummary | null;
  reporting: ReportingCrewBriefing | null;
}): AgenticSystemMap {
  return buildAgenticSystemMap({
    ...inputs,
    actionReadiness: getActionReadinessMatrix(),
    crewSimulations: getCrewSimulations(),
  });
}
