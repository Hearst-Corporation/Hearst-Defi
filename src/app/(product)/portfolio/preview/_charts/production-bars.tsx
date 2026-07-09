/**
 * HcProductionBars — operation-level BTC produced per period, compact calendar-style bars.
 *
 * Same discreet treatment as the distribution calendar: thin monthly bars, month labels, no
 * heavy cumulative overlay. This chart shows cbBTC PRODUCED, so realized months read BITCOIN
 * ORANGE (asset identity, not danger — never red); a not-yet-closed (estimated) month reads
 * GREY graphite — never a barred/hatched fill, never orange/accent — so a placeholder can
 * never look attested. Pure CSS (no SVG, no <text>) so nothing stretches: bars scale to the
 * real data with headroom and fill their fixed-height box; HTML month labels stay crisp under
 * each bar. GENERAL/operation-level — not per-investor.
 */
import { ASSET_COLOR } from "../_data/brand";

export interface HcProductionDatum {
  label: string;
  btc: number;
  /** Not-yet-closed period → greyed, not accent. */
  estimated?: boolean;
}

export interface HcProductionBarsProps {
  data: readonly HcProductionDatum[];
  height?: number;
  "aria-label": string;
}

/** Grey graphite fill for a not-yet-closed period — never accent, never red. */
const ESTIMATED_FILL = "color-mix(in srgb, var(--ct-text-strong) 18%, transparent)";

export function HcProductionBars({
  data,
  height = 190,
  ...rest
}: HcProductionBarsProps) {
  const ariaLabel = rest["aria-label"];

  if (data.length === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        data-hc-empty="true"
        style={{
          height,
          borderRadius: "var(--ct-radius-md)",
          border: "1px dashed var(--ct-border)",
        }}
      />
    );
  }

  // Scale to real data with 12% headroom so the tallest bar sits ~89% up the plot
  // (airy top, no squash). `|| 1` guards an all-zero series.
  const dataMax = Math.max(...data.map((d) => d.btc));
  const scaleMax = dataMax * 1.12 || 1;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex flex-col"
      style={{ height }}
    >
      {/* Plot area — bars grow from a hairline baseline */}
      <div className="flex w-full min-w-0 flex-1 items-end gap-2 border-b border-[var(--ct-border-soft)]">
        {data.map((d) => {
          const pct = Math.max(0, Math.min(100, (d.btc / scaleMax) * 100));
          return (
            <div
              key={d.label}
              className="flex min-w-0 flex-1 flex-col items-center justify-end self-stretch"
            >
              <div
                className="w-[62%] max-w-[34px] rounded-t-[3px]"
                style={{
                  height: `${pct}%`,
                  minHeight: 4,
                  background: d.estimated ? ESTIMATED_FILL : ASSET_COLOR.bitcoin,
                  opacity: d.estimated ? 1 : 0.9,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Month-label row — HTML spans, one per column, centered under their bar */}
      <div className="flex w-full min-w-0 gap-2 pt-1.5">
        {data.map((d) => (
          <span
            key={d.label}
            className="ct-text-muted min-w-0 flex-1 truncate text-center text-[length:var(--ct-text-nano)]"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
