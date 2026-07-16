// src/app/(product)/btc/_components/btc-composition-panel.tsx
//
// BtcCompositionPanel — the /btc cockpit's right-hand analytical panel, the
// orange sibling of the dashboard's StrategyOverviewPanel (same Card skeleton:
// h-full flex-col, ct-bento-label header, flex-1 centered core, mt-auto
// bordered footer). Instead of a qualitative health ring it renders the 40/27/33
// pocket COMPOSITION as a pure-SVG donut (strokeDasharray arcs — no recharts,
// stays a Server Component) with the total accumulated BTC in the center.
//
// Honesty contract:
//  - the donut shows the ACTUAL split only when every pocket reports actualBps;
//    otherwise it shows targetBps and says "Target allocation" explicitly;
//  - pockets null/empty -> honest DataUnavailable state, no fabricated 40/27/33;
//  - totalBtc null -> the center shows an em dash, never an invented figure;
//  - the block is covered by the provenance badge passed by the page.
//
// Palette: BTC-page orange dominance — var(--ct-asset-btc) for the BTC pouch,
// var(--ct-asset-mining) for Mining Power, var(--ct-chart-neutral) for the
// operating reserve. No product-green accent on this page. Flat: no glow,
// no shadow, no halo.

import Link from "next/link";
import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/catalyst/provenance-badge";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import type { AllocationPocketViewModel, PocketId } from "@/features/investor-ui/types/dashboard";

// Pocket → arc colour. NO green accent on the /btc page — orange dominates,
// the third pocket sits on the neutral chart tone.
const POCKET_COLOR: Record<PocketId, string> = {
  B1: "var(--ct-asset-mining)",
  B2: "var(--ct-asset-btc)",
  B3: "var(--ct-chart-neutral)",
};

const POCKET_FALLBACK_LABEL: Record<PocketId, string> = {
  B1: "Mining Power",
  B2: "Bitcoin Reserve",
  B3: "Operating Reserve",
};

// Donut geometry (viewBox 0 0 200 200) — same coordinate system as the
// dashboard ring for visual kinship across the two panels.
const R = 78;
const STROKE = 14;
const C = 2 * Math.PI * R;
// Hairline gap between segments, in circumference units.
const SEGMENT_GAP = 2.5;

export interface BtcCompositionPanelProps {
  /** The 40/27/33 pockets. Null / empty -> honest unavailable state. */
  pockets: readonly AllocationPocketViewModel[] | null;
  /** Pre-formatted total accumulated BTC (e.g. "6,120"). Null -> em dash. */
  totalBtc: string | null;
  /** Honesty badge covering the whole block. */
  provenance: Provenance;
}

export function BtcCompositionPanel({ pockets, totalBtc, provenance }: BtcCompositionPanelProps) {
  if (!pockets || pockets.length === 0) {
    return (
      <Card className="w-full h-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
        <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
          <span className="ct-bento-label">Strategy composition</span>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <DataUnavailable label="Allocation" />
        </div>
      </Card>
    );
  }

  // Actual split only when every pocket reports one; otherwise the product
  // target, labelled as such — never a silently blended figure.
  const hasActual = pockets.every((p) => p.actualBps != null);

  const rows = pockets.map((p) => ({
    pocket: p.pocket,
    label: p.label || POCKET_FALLBACK_LABEL[p.pocket],
    shownBps: hasActual && p.actualBps != null ? p.actualBps : p.targetBps,
    targetBps: p.targetBps,
    color: POCKET_COLOR[p.pocket],
  }));

  const totalBps = rows.reduce((sum, r) => sum + r.shownBps, 0);

  // Cumulative arc segments: each pocket is a strokeDasharray slice rotated to
  // start where the previous one ends (12 o'clock origin via rotate(-90)).
  // Pure fold — cumulative fraction threaded through the accumulator.
  const segments = rows.reduce<{
    cursor: number;
    out: Array<(typeof rows)[number] & { length: number; offset: number }>;
  }>(
    (acc, r) => {
      const fraction = totalBps > 0 ? r.shownBps / totalBps : 0;
      const length = Math.max(C * fraction - SEGMENT_GAP, 0);
      const offset = -acc.cursor * C;
      return { cursor: acc.cursor + fraction, out: [...acc.out, { ...r, length, offset }] };
    },
    { cursor: 0, out: [] },
  ).out;

  return (
    <Card className="w-full h-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="ct-bento-label">Strategy composition</span>
        <ProvenanceBadge kind={provenance} variant="compact" />
      </div>

      {/* Core: donut + legend */}
      <div className="flex-1 flex flex-col items-center justify-center gap-[var(--ct-space-4)] min-w-0">
        <div className="relative shrink-0 w-[150px] h-[150px]">
          <svg viewBox="0 0 200 200" role="img" aria-label="Capital allocation across the three pockets" className="w-full h-full">
            {/* track */}
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="var(--ct-border-soft)"
              strokeWidth={STROKE}
            />
            {/* pocket arcs */}
            {/* --seg-start feeds the first-paint settle (P2.2,
                dash-donut-draw keyframes): each segment slides from its own
                start angle into its mounted offset once, at entry — the
                transition path never plays on a server component. */}
            {segments.map((s) => (
              <circle
                key={s.pocket}
                className="dash-donut-seg"
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${s.length} ${C - s.length}`}
                strokeDashoffset={s.offset}
                transform="rotate(-90 100 100)"
                style={{ ["--seg-start" as string]: `${s.offset + s.length}` }}
              />
            ))}
          </svg>
          {/* Center: total accumulated BTC — labelled "Accumulated BTC" so the
              centre figure (BTC) is never confused with the ring (capital split). */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--ct-space-1)] pointer-events-none">
            <span className="text-[length:var(--ct-text-2xl)] font-semibold leading-none tabular-nums text-[var(--ct-asset-btc)]">
              {totalBtc ?? "—"}
            </span>
            <span className="ct-metric-caption">Accumulated BTC</span>
          </div>
        </div>

        {/* Legend — real percentages from the props. Actual split: XX.X% plus a
            muted "target XX%" delta reference; target-only: round XX%. */}
        <ul className="w-full m-0 p-0 list-none flex flex-col gap-[var(--ct-space-3)] min-w-0">
          {rows.map((r) => (
            <li key={r.pocket} className="flex items-center gap-[var(--ct-space-2_5)] min-w-0">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: r.color }}
              />
              <span className="body-xs ct-text-muted flex-1 min-w-0 truncate">{r.label}</span>
              {hasActual ? (
                <span className="body-xs ct-text-muted tabular-nums shrink-0">
                  target {formatTargetPct(r.targetBps)}
                </span>
              ) : null}
              <span className="body-xs font-medium ct-text-strong tabular-nums shrink-0">
                {hasActual ? formatPct(r.shownBps) : formatTargetPct(r.shownBps)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)] flex flex-col gap-[var(--ct-space-1)]">
        <span className="ct-metric-caption">
          {hasActual ? "Actual allocation" : "Target allocation"}
        </span>
        <span className="body-xs ct-text-muted">
          {hasActual
            ? "On-chain pocket split as last indexed."
            : "Product target — on-chain split not yet indexed."}
        </span>
        <Link
          href="/proof-center"
          className="body-xs ct-link-accent focus-visible:outline-none ct-focus-ring rounded-sm"
        >
          View attestations →
        </Link>
      </div>
    </Card>
  );
}

function formatPct(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

// Product targets are round figures (40/27/33) — render them round ("40%",
// never "40.0%"); a non-integer target keeps its single decimal honestly.
function formatTargetPct(bps: number): string {
  return bps % 100 === 0 ? `${bps / 100}%` : `${(bps / 100).toFixed(1)}%`;
}
