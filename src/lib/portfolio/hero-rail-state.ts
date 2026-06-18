import type { Provenance } from "@/components/ui/provenance-badge";

import { resolveProvenance } from "@/lib/portfolio/provenance";

/** Shared zero-shell + provenance for TimeToCash and HeroPayoutRail. */
export function resolveTimeToCashShell(input: {
  previewZeros?: boolean;
  source?: "live" | "stale";
  updatedAt?: Date;
  projectedUsdc: number;
  aprLow: number;
  aprHigh: number;
}): {
  showZeroShell: boolean;
  widgetProvenance: Provenance | undefined;
  isStale: boolean;
} {
  const isStale =
    input.source === "stale" ||
    input.projectedUsdc === 0 ||
    input.aprLow + input.aprHigh === 0;
  const showZeroShell = Boolean(input.previewZeros) || isStale;
  const widgetProvenance = showZeroShell
    ? undefined
    : resolveProvenance(input.source ?? "live", input.updatedAt, "estimated");

  return { showZeroShell, widgetProvenance, isStale };
}

/** Shared zero-shell + provenance for LockMeter and HeroLiquidityRail. */
export function resolveLockMeterShell(input: {
  previewZeros?: boolean;
  source?: "live" | "stale";
  softLockupDays: number;
}): {
  showZeroShell: boolean;
  widgetProvenance: Provenance | undefined;
  termsUnknown: boolean;
} {
  const termsUnknown = input.softLockupDays <= 0;
  const showZeroShell =
    Boolean(input.previewZeros) || termsUnknown || input.source === "stale";
  const widgetProvenance = showZeroShell ? undefined : "live";

  return { showZeroShell, widgetProvenance, termsUnknown };
}
