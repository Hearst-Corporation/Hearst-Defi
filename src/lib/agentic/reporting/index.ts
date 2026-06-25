// Reporting Crew Read-Only v0 — barrel + entry point.
//
// A deterministic, read-only briefing composed from data the platform already
// produces. NOT CrewAI, NOT an autonomous runtime: no tool is executed, no write
// is performed, nothing is stored. The composition (compose-briefing) is pure;
// only the input collection (collect-inputs) is server-side + best-effort.

import { collectReportingCrewInputs } from "./collect-inputs";
import { composeReportingCrewBriefing } from "./compose-briefing";
import type {
  ReportingCrewBriefing,
  ReportingCrewInputs,
} from "./types";
import type { RouterObservabilityWindow } from "@/lib/agentic/observability/types";

export * from "./types";
export {
  deriveRouterSignals,
  deriveToolBoundarySignals,
  deriveSafetySignals,
  deriveNoDataSignals,
} from "./quality-signals";
export { buildRecommendedReadOnlyChecks } from "./recommendations";
export { composeReportingCrewBriefing } from "./compose-briefing";
export { collectReportingCrewInputs } from "./collect-inputs";

/**
 * The admin entry point: collect read-only inputs (best-effort) and compose the
 * deterministic briefing. Never throws into the page — a failed read degrades to
 * a no_data briefing. Pass a pre-fetched observability summary to avoid a second
 * read when the page already has one.
 */
export async function getReportingCrewBriefing(args?: {
  window?: RouterObservabilityWindow | string;
  observability?: ReportingCrewInputs["observability"];
}): Promise<ReportingCrewBriefing> {
  const inputs = await collectReportingCrewInputs(args);
  return composeReportingCrewBriefing(inputs);
}
