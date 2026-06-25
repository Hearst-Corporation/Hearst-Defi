// Agentic System Map v0 — barrel + entry point.
//
// A pure, read-only visual graph of the agentic system, composed from the data
// the platform already produces. No tool is executed, no LLM is called, no write
// is performed. The builder is pure; the entry point just threads the (already
// best-effort) summaries the admin page has into it.

import { buildAgenticSystemMap } from "./build-system-map";
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

/**
 * Build the read-only system map from the page's already-fetched summaries. Pure
 * + deterministic given its inputs; `observability` / `reporting` may be null
 * (best-effort) and the affected nodes degrade to no_data. Never throws.
 */
export function getAgenticSystemMap(inputs: {
  controlCenter: AgenticControlCenterData;
  observability: RouterObservabilitySummary | null;
  reporting: ReportingCrewBriefing | null;
}): AgenticSystemMap {
  return buildAgenticSystemMap(inputs);
}
