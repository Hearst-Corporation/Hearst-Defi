"use client";

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
 *
 * Client component (preview-only): each bar reveals a token-only hover tooltip with the
 * month, the exact cbBTC amount + unit, an optional USD-equivalent estimate, and an
 * "estimated · not yet closed" note for periods that have not settled. Hover only dims the
 * other bars and lifts the hovered one to full opacity — it NEVER changes a bar's colour, so
 * amber stays amber (realized) and graphite stays graphite (estimated). No red anywhere.
 */
import { useState } from "react";

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
  /**
   * Optional BTC→USD reference (est.). When set, each bar's tooltip adds a
   * "≈ $… est." line (btc × btcPriceUsd). Estimated only — never a live quote.
   */
  btcPriceUsd?: number;
  "aria-label": string;
}

/** Grey graphite fill for a not-yet-closed period — never accent, never red. */
const ESTIMATED_FILL = "color-mix(in srgb, var(--ct-text-strong) 18%, transparent)";

/** cbBTC amount with 2–3 decimals (e.g. 0.31 → "0.31", 0.315 → "0.315"). */
function formatBtc(btc: number): string {
  return btc.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

/** Thousands-separated USD, no cents (e.g. 29760 → "29,760"). */
function formatUsd(usd: number): string {
  return usd.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function HcProductionBars({
  data,
  height = 190,
  btcPriceUsd,
  ...rest
}: HcProductionBarsProps) {
  const ariaLabel = rest["aria-label"];
  const [hovered, setHovered] = useState<number | null>(null);

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

  const tip = hovered !== null ? data[hovered] : undefined;
  // Horizontal centre of the hovered column; anchor the tooltip so edge bars
  // never push the card past its own bounds (no horizontal body scroll).
  const centerPct = hovered !== null ? ((hovered + 0.5) / data.length) * 100 : 50;
  const tipTranslateX = centerPct <= 16 ? "0%" : centerPct >= 84 ? "-100%" : "-50%";

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex flex-col"
      style={{ height }}
    >
      {/* Plot area — bars grow from a hairline baseline; relative so the tooltip anchors here */}
      <div className="relative flex w-full min-w-0 flex-1 items-end gap-2 border-b border-[var(--ct-border-soft)]">
        {/* Hover tooltip — token-only card floated near the top of the plot */}
        {tip && (
          <div
            className="pointer-events-none absolute z-10 flex flex-col gap-0.5 rounded-[var(--ct-radius-md)] border border-[var(--ct-border)] px-2.5 py-1.5"
            style={{
              top: "var(--ct-space-1)",
              left: `${centerPct}%`,
              transform: `translateX(${tipTranslateX})`,
              background: "var(--ct-surface-card)",
              boxShadow: "var(--ct-shadow-soft)",
            }}
          >
            <span className="ct-text-muted whitespace-nowrap text-[length:var(--ct-text-nano)] uppercase tracking-wide">
              {tip.label}
            </span>
            <span className="ct-text-strong whitespace-nowrap text-[length:var(--ct-text-micro)] font-semibold tabular-nums">
              {formatBtc(tip.btc)} BTC
            </span>
            <span className="ct-text-muted whitespace-nowrap text-[length:var(--ct-text-nano)]">
              cbBTC produced
            </span>
            {typeof btcPriceUsd === "number" && (
              <span className="ct-text-body whitespace-nowrap text-[length:var(--ct-text-nano)] tabular-nums">
                ≈ ${formatUsd(tip.btc * btcPriceUsd)} est.
              </span>
            )}
            {tip.estimated && (
              <span className="ct-text-muted whitespace-nowrap text-[length:var(--ct-text-nano)]">
                estimated · not yet closed
              </span>
            )}
          </div>
        )}

        {data.map((d, i) => {
          const pct = Math.max(0, Math.min(100, (d.btc / scaleMax) * 100));
          const isHovered = i === hovered;
          const baseOpacity = d.estimated ? 1 : 0.9;
          // Dim the field only while another bar is hovered; the hovered bar
          // goes to full opacity. Colours never change (amber / graphite).
          const opacity =
            hovered === null
              ? baseOpacity
              : isHovered
                ? 1
                : d.estimated
                  ? 0.4
                  : 0.45;
          return (
            <div
              key={d.label}
              className="flex min-w-0 flex-1 flex-col items-center justify-end self-stretch"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((cur) => (cur === i ? null : cur))}
            >
              <div
                className="w-[62%] max-w-[34px] rounded-t-[3px] transition-[opacity,transform] duration-150"
                style={{
                  height: `${pct}%`,
                  minHeight: 4,
                  background: d.estimated ? ESTIMATED_FILL : ASSET_COLOR.bitcoin,
                  opacity,
                  transform: isHovered ? "scaleY(1.02)" : undefined,
                  transformOrigin: "bottom",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Month-label row — HTML spans, one per column, centered under their bar */}
      <div className="flex w-full min-w-0 gap-2 pt-1.5">
        {data.map((d, i) => (
          <span
            key={d.label}
            className="min-w-0 flex-1 truncate text-center text-[length:var(--ct-text-nano)] transition-colors duration-150"
            style={{
              color:
                hovered === i ? "var(--ct-text-body)" : "var(--ct-text-muted)",
            }}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
