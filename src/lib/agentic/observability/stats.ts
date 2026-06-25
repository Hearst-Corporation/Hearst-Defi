// Router Observability v0 — aggregate stats (pure).

import type { RouterDecisionStats, RouterDecisionTrace } from "./types";

/** Compute aggregate counts over a set of traces. Pure, no I/O. */
export function computeRouterDecisionStats(
  traces: readonly RouterDecisionTrace[],
): RouterDecisionStats {
  const byKind: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  let dangerousRefusals = 0;
  let negatedNoNav = 0;
  let educationalTurns = 0;
  let navigationFastPaths = 0;
  let legacyFallbacks = 0;
  let unknownTurns = 0;

  for (const t of traces) {
    byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
    byOutcome[t.outcome] = (byOutcome[t.outcome] ?? 0) + 1;
    switch (t.outcome) {
      case "dangerous_refusal":
        dangerousRefusals++;
        break;
      case "negated_no_nav":
        negatedNoNav++;
        break;
      case "educational_llm":
        educationalTurns++;
        break;
      case "nav_fast_path":
        navigationFastPaths++;
        break;
      case "legacy_fallback_nav":
        legacyFallbacks++;
        break;
      case "unknown":
        unknownTurns++;
        break;
      // "normal_llm" contributes only to total / byOutcome.
      default:
        break;
    }
  }

  return {
    total: traces.length,
    byKind,
    byOutcome,
    dangerousRefusals,
    negatedNoNav,
    educationalTurns,
    navigationFastPaths,
    legacyFallbacks,
    unknownTurns,
  };
}
