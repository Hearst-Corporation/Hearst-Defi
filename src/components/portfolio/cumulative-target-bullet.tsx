/**
 * CumulativeTargetBullet — cumulative distributions vs a methodology target.
 *
 * Honest-pending by default: until a methodology cumulative-distribution target
 * exists (`targetUsdc === null`) it renders a neutral track with NO target tick
 * and an em-dash — it never fabricates a percentage. Once a target lands, it
 * flips to a real Stephen-Few bullet (measure + target tick), accent only when
 * the measure clears the target. Pure render (server component).
 */

import { formatUsdFull } from "@/lib/vaults/product-display";

export function CumulativeTargetBullet({
  distributedUsdc,
  targetUsdc = null,
}: {
  distributedUsdc: number;
  targetUsdc?: number | null;
}) {
  const hasTarget = targetUsdc !== null && targetUsdc > 0;
  const pct = hasTarget ? Math.min(1, Math.max(0, distributedUsdc / targetUsdc)) : 0;
  const cleared = hasTarget && distributedUsdc >= targetUsdc;

  return (
    <div className="flex flex-col gap-3 bg-surface-card p-5 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="ct-bento-label">Cumulative target progress</span>
        <span className="ct-metric-caption">
          {hasTarget ? `${Math.round(pct * 100)}%` : "—"}
        </span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-inset">
        {hasTarget && pct > 0 ? (
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct * 100}%`,
              background: cleared ? "var(--ct-accent)" : "var(--ct-chart-band-stroke)",
            }}
          />
        ) : null}
        {hasTarget ? (
          <div
            aria-hidden="true"
            className="absolute top-0 h-full"
            style={{ right: 0, width: 2, background: "var(--ct-text-strong)" }}
          />
        ) : null}
      </div>

      <span className="ct-metric-caption">
        {hasTarget
          ? `${formatUsdFull(distributedUsdc)} distributed of ${formatUsdFull(targetUsdc)} target`
          : "Set by methodology · coming with Yield History"}
      </span>
    </div>
  );
}
