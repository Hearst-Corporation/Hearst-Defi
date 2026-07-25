// Portfolio charts — the Qatar-cockpit visual band, on the canonical Hearst
// SURFACES (green accent kept). The reference design system exports three
// planes (Design system — Hearst Qatar Management Cockpit §Surfaces):
//   surfaceRaised = rounded-xl bg-zinc-900 ring-white/10 shadow-lg   (cards)
//   surfaceSunken = rounded-xl bg-zinc-950/50 ring-white/5           (dense zones)
// Here every chart card is a `surfaceClassName("primary")` pane — the Hearst
// token expression of surfaceRaised (raised zinc surface, hairline ring, depth
// shadow) — NOT the pure-black HcChartCard surface. That is the surface match.
//
// Every value is backend-sourced; an absent block renders an honest empty
// chart, never a fabricated wedge/bar.

import type { ReactNode } from "react";

import { HcBarChart } from "@/components/dataviz/his/HcBarChart";
import { HcCompositionRing } from "@/components/dataviz/his/HcCompositionRing";
import { POSITION_CARD_SURFACE } from "./position-surface";
import type { WiredFromBackend } from "@/lib/backend/resolved-view";
import type {
  MyPositionCapacity,
  MyPositionPocket,
  PositionActivityItem,
} from "../_data/position-loader";

/** A USDC decimal string → compact "$1.2M". The backend reports whole-USDC
 *  decimal strings, so we only group/abbreviate — never divide by 10^6. */
function compactUsdc(decimalString: string | null): string | null {
  if (decimalString === null) return null;
  const n = Number.parseFloat(decimalString);
  if (!Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** One chart pane — the canonical raised surface, a header (title + subtitle +
 *  trailing source), and the chart body. This is the reference's card idiom
 *  (figure + figcaption border-b + plot) on Hearst's surfaceRaised. */
function ChartPane({
  title,
  subtitle,
  trailing,
  children,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`flex flex-col ${POSITION_CARD_SURFACE}`} aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-[var(--ct-space-3)] border-b border-[var(--ct-border-soft)] px-[var(--ct-space-6)] py-[var(--ct-space-4)]">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-semibold text-[var(--ct-text-strong)]">{title}</h3>
          {subtitle ? (
            <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--ct-text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col justify-center px-[var(--ct-space-6)] py-[var(--ct-space-5)]">
        {children}
      </div>
    </section>
  );
}

/** A discreet source chip, matching the reference's uppercase micro-label. */
function SourceChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ct-surface-inset)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--ct-text-faint)] ring-1 ring-[var(--ct-border-soft)]">
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-[var(--ct-accent)]" />
      {label}
    </span>
  );
}

export function PositionCharts({
  allocation,
  capacity,
  activity,
}: {
  allocation: WiredFromBackend<readonly MyPositionPocket[]>;
  capacity: WiredFromBackend<MyPositionCapacity>;
  activity: readonly PositionActivityItem[];
}) {
  // ── Strategy composition — actual split when every pocket reports one,
  // otherwise the labelled product target.
  const pockets = allocation.status === "wired" ? allocation.data : null;
  const hasActual = pockets != null && pockets.length > 0 && pockets.every((p) => p.actualBps != null);
  const allocSegments =
    pockets != null && pockets.length > 0
      ? pockets.map((p) => ({
          label: `${p.pocket} · ${p.label}`,
          value: (hasActual && p.actualBps != null ? p.actualBps : p.targetBps) / 100,
        }))
      : [];

  // ── Capacity mix — committed vs available (whole-USDC decimal strings).
  const cap = capacity.status === "wired" ? capacity.data : null;
  const committedN = cap?.committed != null ? Number.parseFloat(cap.committed) : null;
  const availableN = cap?.available != null ? Number.parseFloat(cap.available) : null;
  const capSegments =
    committedN != null && availableN != null && (committedN > 0 || availableN > 0)
      ? [
          { label: "Committed", value: committedN },
          { label: "Available", value: availableN },
        ]
      : [];
  const utilPct = cap?.utilizationBps != null ? `${(cap.utilizationBps / 100).toFixed(1)}%` : null;

  // ── Contribution flow — recent movements as bars, oldest→newest.
  const flowBars = [...activity]
    .reverse()
    .slice(-8)
    .map((a) => ({ label: shortDate(a.occurredAt), value: Number.parseFloat(a.amountUsdc) || 0 }));

  return (
    <div className="flex w-full min-w-0 flex-col gap-[var(--ct-space-5)]">
      <div className="grid w-full min-w-0 grid-cols-1 gap-[var(--ct-space-5)] lg:grid-cols-2">
        <ChartPane
          title="Strategy composition"
          subtitle={hasActual ? "Measured on-chain split" : "Configured policy target — 40 / 27 / 33"}
          trailing={<SourceChip label={hasActual ? "Live" : "Configured"} />}
        >
          <div className="flex items-center justify-center py-[var(--ct-space-2)]">
            <HcCompositionRing
              segments={allocSegments}
              size={188}
              bars
              palette="accent"
              centerLabel={hasActual ? "Actual" : "Target"}
              centerValue="B1·B2·B3"
              aria-label="Allocation donut across the three Series 1 pockets"
            />
          </div>
        </ChartPane>

        <ChartPane
          title="Capacity mix"
          subtitle="Capital committed against the subscription cap"
          trailing={<SourceChip label="Live" />}
        >
          <div className="flex items-center justify-center py-[var(--ct-space-2)]">
            <HcCompositionRing
              segments={capSegments}
              size={188}
              bars
              palette="accent"
              centerLabel={utilPct ? `${utilPct} used` : "Committed"}
              centerValue={compactUsdc(cap?.committed ?? null) ?? "—"}
              aria-label="Capacity donut — committed versus available against the cap"
            />
          </div>
        </ChartPane>
      </div>

      <ChartPane
        title="Contribution flow"
        subtitle="Deposits, proceeds and withdrawals — most recent on the right"
        trailing={<SourceChip label="Live" />}
      >
        <HcBarChart
          bars={flowBars}
          height={200}
          highlightLast
          valueFormat={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`)}
          emptyMessage="No posted movements yet"
          aria-label="Recent contribution movements"
        />
      </ChartPane>
    </div>
  );
}
