import type { Provenance } from "@/components/ui/provenance-badge";

import { resolveProvenance } from "@/lib/portfolio/provenance";
import { resolveWidgetView, type WidgetView } from "@/lib/portfolio/view-state";

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

/** Loader-resolved {mode, provenance} for HeroPayoutRail (Architecture A). */
export function resolvePayoutWidgetView(input: {
  previewZeros: boolean;
  source?: "live" | "stale";
  updatedAt?: Date;
  projectedUsdc: number;
  aprLow: number;
  aprHigh: number;
}): WidgetView {
  const { isStale, widgetProvenance } = resolveTimeToCashShell({
    ...input,
    previewZeros: false,
  });
  return resolveWidgetView({
    previewZeros: input.previewZeros,
    hasData: !isStale,
    provenance: widgetProvenance,
  });
}

/** Loader-resolved {mode, provenance} for HeroLiquidityRail (Architecture A). */
export function resolveLiquidityWidgetView(input: {
  previewZeros: boolean;
  source?: "live" | "stale";
  softLockupDays: number;
}): WidgetView {
  const { showZeroShell, widgetProvenance } = resolveLockMeterShell({
    ...input,
    previewZeros: false,
  });
  return resolveWidgetView({
    previewZeros: input.previewZeros,
    hasData: !showZeroShell,
    provenance: widgetProvenance,
  });
}
