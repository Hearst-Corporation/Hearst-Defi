// KpiBandCell + ReportingPeriodCell — the SHARED hero-band cells (P1.2).
// One skeleton serves both cockpit heroes (/dashboard green, /btc orange):
// the tone prop drives the figure colour via the .ct-text-accent /
// .ct-text-btc utilities (cockpit.css) — no divergent colour mechanism left
// in the heroes. Server components, presentation-only: every figure arrives
// pre-formatted (string), no math here.
//
// Rendering contract (post-P0.2 / P0.6, preserved EXACTLY):
//   dt  = micro-label — ct-bento-label (uppercase, tracking-widest, muted),
//         optional AssetIcon + per-cell provenance badge (strip);
//   dd (small) = qualifier `sub` — baseline-right, body-xs muted;
//   dd (full)  = the figure via <Figure> — lead cell 32px semibold (ONE
//         master figure per band), others 22px medium, unit at 55% baseline.
//
// P1.5 — ReportingPeriodCell spans 2 columns between sm and xl
// (sm:col-span-2 xl:col-span-1) so the 6th grid slot (the orb column,
// hidden below xl) never shows through as a --ct-border-soft ghost.

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { AssetIcon, type AssetIconVariant } from "@/features/investor-ui/components/asset-icon";
import { Figure } from "@/features/investor-ui/components/figure";
import { HairlineProgress } from "@/features/investor-ui/components/hairline-progress";
import type { BtcProvenanceKind } from "@/features/investor-ui/format-btc";

export type KpiBandTone = "accent" | "btc";

export interface KpiBandCellData {
  label: string;
  /** Pre-formatted digits — "$262,700", "0.5170", "—". No math here. */
  value: string;
  /** Unit suffix typeset by <Figure> ("BTC") — omitted on "—" and $-prefixed figures. */
  unit?: string;
  /** Qualifier line — the second reading level ("Program cumulative", …). */
  sub: string;
  /** Figure colour: "accent" green · "btc" orange · default neutral strong. */
  tone?: KpiBandTone | "default";
  /** Optical primacy — ONE master figure per band (32px semibold), P0.2. */
  lead?: boolean;
  icon?: AssetIconVariant;
  badge?: BtcProvenanceKind;
}

const TONE_TEXT: Record<KpiBandTone, string> = {
  accent: "ct-text-accent",
  btc: "ct-text-btc",
};

export function KpiBandCell({ cell }: { cell: KpiBandCellData }) {
  const valueClass =
    cell.tone === "accent" || cell.tone === "btc" ? TONE_TEXT[cell.tone] : "ct-text-strong";
  return (
    <div className="ct-kpi-cell flex flex-wrap items-baseline justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-2)] bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-6)] min-w-0">
      {/* Micro-label — ONE voice across the page: ct-bento-label (uppercase,
          tracking-widest, muted), same convention as the Zone 3 cards (P0.6). */}
      <dt className="flex items-center gap-[var(--ct-space-1_5)] ct-bento-label min-w-0">
        {cell.icon ? <AssetIcon variant={cell.icon} size="sm" label="" /> : null}
        <span className="truncate">{cell.label}</span>
        {cell.badge ? <ProvenanceBadge kind={cell.badge} variant="strip" /> : null}
      </dt>
      {/* Qualifier — baseline-right, single caption idiom (body-xs muted). */}
      <dd className="body-xs ct-text-muted">{cell.sub}</dd>
      {/* Lead cell = the band's master figure (32px semibold); others 22px medium. */}
      <dd className="w-full flex-none">
        <Figure
          value={cell.value}
          unit={cell.unit}
          size={cell.lead ? "lead" : "base"}
          className={valueClass}
        />
      </dd>
    </div>
  );
}

export interface ReportingPeriodCellProps {
  /** Current month of the term (1-based) — null = term not started. */
  currentMonth: number | null;
  totalMonths: number;
  /** Figure + progress-fill colour: green on /dashboard, orange on /btc. */
  tone: KpiBandTone;
}

export function ReportingPeriodCell({ currentMonth, totalMonths, tone }: ReportingPeriodCellProps) {
  const termPct =
    currentMonth != null && totalMonths > 0 ? (currentMonth / totalMonths) * 100 : null;
  const termPctLabel =
    termPct != null ? `${termPct.toFixed(1).replace(/\.0$/, "")}% complete` : null;

  return (
    <div className="ct-kpi-cell flex flex-wrap items-baseline justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-2)] bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-6)] sm:col-span-2 xl:col-span-1">
      <dt className="ct-bento-label">Reporting period</dt>
      {currentMonth != null ? (
        <>
          <dd className="body-xs ct-text-muted">{termPctLabel}</dd>
          <dd className="w-full flex-none text-[length:var(--ct-text-2xl)] font-medium tracking-tight leading-none ct-text-strong">
            Month <Figure value={currentMonth} unit={`/ ${totalMonths}`} className={TONE_TEXT[tone]} />
          </dd>
          {/* Decorative bar — the "% complete" qualifier above carries the
              same info for screen readers (no double announcement). */}
          <dd className="w-full flex-none">
            <HairlineProgress pct={termPct ?? 0} tone={tone} />
          </dd>
        </>
      ) : (
        <>
          <dd className="body-xs ct-text-muted">Term not started</dd>
          <dd className="w-full flex-none text-[length:var(--ct-text-2xl)] font-medium ct-text-strong">—</dd>
        </>
      )}
    </div>
  );
}

/** Derives the page-level provenance badge from the provenance kinds of the
 *  sources actually present in the band (no more hardcoded "simulated"):
 *  all sources simulated -> "simulated"; otherwise the dominant REAL (non
 *  simulated) kind — most frequent, ties broken conservatively (never
 *  over-claim: estimated > partial > stale > live). The day the data goes
 *  Live, the surface stops lying in the other direction. */
const CONSERVATIVE_ORDER: readonly BtcProvenanceKind[] = [
  "estimated",
  "partial",
  "stale",
  "live",
  "simulated",
];

export function deriveBandProvenance(kinds: readonly BtcProvenanceKind[]): BtcProvenanceKind {
  if (kinds.length === 0) return "simulated";
  const real = kinds.filter((k) => k !== "simulated");
  if (real.length === 0) return "simulated";
  const counts = new Map<BtcProvenanceKind, number>();
  for (const k of real) counts.set(k, (counts.get(k) ?? 0) + 1);
  let dominant: BtcProvenanceKind = "estimated";
  let best = -1;
  for (const kind of CONSERVATIVE_ORDER) {
    const n = counts.get(kind) ?? 0;
    if (n > best) {
      best = n;
      dominant = kind;
    }
  }
  return dominant;
}
