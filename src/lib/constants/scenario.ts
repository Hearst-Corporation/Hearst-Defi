// UI-only constants for the Scenario Lab output panels.
// Pure presentation maps (labels / variant names / colors) — NO business logic,
// NO engine math. Shared by OutputPanel and AllocationBreakdown.

import { ALLOCATION_LABELS, ALLOCATION_STROKE } from "@/lib/allocation-colors";
import type { AllocationBucket, ScenarioOutput } from "@/lib/engine/types";

export const BUCKET_LABEL: Record<AllocationBucket, string> = {
  mining: `${ALLOCATION_LABELS.mining} cashflow`,
  btc_tactical: ALLOCATION_LABELS.btc_tactical,
  usdc_base: `${ALLOCATION_LABELS.usdc_base} yield`,
  stable_reserve: ALLOCATION_LABELS.stable_reserve,
};

export const BUCKET_COLOR = ALLOCATION_STROKE;

export const CONFIDENCE_VARIANT: Record<
  ScenarioOutput["confidence"],
  "danger" | "warning" | "success"
> = {
  low: "danger",
  medium: "warning",
  high: "success",
};

export const MODE_LABEL: Record<ScenarioOutput["mode"], string> = {
  defensive: "Defensive",
  balanced: "Balanced",
  opportunistic: "Opportunistic",
};

export const MODE_VARIANT: Record<
  ScenarioOutput["mode"],
  "danger" | "default" | "success"
> = {
  defensive: "danger",
  balanced: "default",
  opportunistic: "success",
};

/** Progress bar fill class for risk (inverted) and mining scores. */
export function progressScoreFillClass(
  score: number,
  invertedRisk = false,
): string {
  if (invertedRisk) {
    if (score > 70) return "bg-[var(--ct-status-danger)]";
    if (score > 40) return "bg-[var(--ct-status-warning)]";
    return "bg-[var(--ct-status-success)]";
  }
  if (score < 30) return "bg-[var(--ct-status-danger)]";
  if (score < 60) return "bg-[var(--ct-status-warning)]";
  return "bg-[var(--ct-status-success)]";
}
