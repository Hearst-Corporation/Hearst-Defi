// Reporting Crew Read-Only v0 — recommendations (pure, read-only).
//
// Returns a short list of READ-ONLY follow-up checks an admin can run. Every item
// is an observation/verification — never a write, send, deploy, source, mark-live,
// execute, approve, or rule mutation. A test asserts no forbidden verb appears.

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";
import type { ReportingCrewSignal } from "./types";

/**
 * Build read-only follow-up checks tailored to the current signals. Always
 * includes a baseline of safe verifications; appends targeted checks when watch/
 * alert signals are present. Pure.
 */
export function buildRecommendedReadOnlyChecks(args: {
  controlCenter: AgenticControlCenterData;
  observability: RouterObservabilitySummary | null;
  signals: ReportingCrewSignal[];
}): string[] {
  const checks: string[] = [];
  const has = (predicate: (s: ReportingCrewSignal) => boolean) =>
    args.signals.some(predicate);

  // Baseline read-only checks (always safe to suggest).
  checks.push(
    "Review the router unknown-rate trend across the 1h / 24h / 7d / 30d windows.",
  );
  checks.push(
    "Check the top matched rules for unexpected concentration on a single rule.",
  );
  checks.push("Verify the Tool Boundary shows zero unclassified (unknown) tools.");
  checks.push(
    "Confirm every write tool remains gated (HITL) and non-autonomous in the Tool Boundary.",
  );

  // Targeted, still read-only, checks based on active signals.
  if (has((s) => s.id.startsWith("quality:high_dangerous_refusal"))) {
    checks.push(
      "Inspect the recent decisions table for the dangerous-refusal spike before considering any change.",
    );
  }
  if (has((s) => s.id === "router-storage-fallback")) {
    checks.push(
      "Note that observability is on a fallback store — re-check once the durable database is reachable for complete numbers.",
    );
  }
  if (has((s) => s.id.startsWith("tool-boundary-critical"))) {
    checks.push(
      "Open the Tool Boundary consistency warnings and review each critical item against the registry.",
    );
  }
  if (
    has((s) => s.id === "router-no-traces") ||
    has((s) => s.id === "no-data-observability")
  ) {
    checks.push(
      "Widen the observability window or send chat traffic to gather more router decisions before drawing conclusions.",
    );
  }

  // Closing guidance — explicitly read-only posture.
  checks.push(
    "Keep write tools gated and crews read-only; do not enable autonomous writes or additional crews until these signals are clear.",
  );

  return checks;
}
