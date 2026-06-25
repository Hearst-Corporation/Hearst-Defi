import "server-only";

// Reporting Crew Read-Only v0 — input collection (read-only, best-effort).
//
// Gathers ONLY read-only data the platform already produces:
//   - getAgenticControlCenterData(): pure, sync registry (router / tools / gates / safety)
//   - getRouterObservabilitySummary(): best-effort durable read (null on failure)
// It executes NO tool, calls NO LLM, performs NO write, creates NO HITL token, and
// touches NO chat route. Never throws — a failed observability read degrades to a
// null summary so the briefing stays honest (no_data) rather than breaking.

import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import {
  getRouterObservabilitySummary,
  resolveWindow,
} from "@/lib/agentic/observability/read-router-decisions";
import type { RouterObservabilityWindow } from "@/lib/agentic/observability/types";
import type { ReportingCrewInputs } from "./types";

/**
 * Collect the read-only inputs for the briefing. `window` selects the observability
 * window (default 24h). Best-effort: the observability read is wrapped so a backend
 * hiccup yields a null summary instead of throwing.
 */
export async function collectReportingCrewInputs(args?: {
  window?: RouterObservabilityWindow | string;
  /**
   * Optional pre-fetched observability summary (the admin page already fetches it
   * for its own section — pass it here to avoid a second read). When provided, it
   * is used as-is and no new read is issued.
   */
  observability?: ReportingCrewInputs["observability"];
}): Promise<ReportingCrewInputs> {
  const controlCenter = getAgenticControlCenterData();

  // Reuse a pre-fetched summary when the caller supplies one (page integration).
  if (args && "observability" in args) {
    return { controlCenter, observability: args.observability ?? null };
  }

  const window = resolveWindow(
    typeof args?.window === "string" ? args.window : args?.window,
  );
  const observability = await getRouterObservabilitySummary({ window }).catch(
    () => null,
  );

  return { controlCenter, observability };
}
