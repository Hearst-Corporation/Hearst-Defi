// Dashboard hero (D5/D10) — full-width program KPI band, green dominance (D1).
// Replaces DashboardPositionPanel + the old flex-7/flex-5 top row. Composed
// locally from Card / Progress / AssetIcon / ProvenanceBadge / CockpitButton.
//
// Honesty contract:
//  - "BTC accumulated" = the PROGRAM cumulative series (same series as the
//    accumulation chart below), never mining.totalBtcEarnedSats (that figure
//    is fleet production, surfaced in MiningPulsePanel with its own label);
//  - every source carries its own provenance: position block badge in the
//    header, accumulation-series badge on its tile (FIXTURE -> simulated via
//    the unified toProvenance mapping);
//  - no "View Bitcoin" CTA — the rail's Bitcoin entry is the navigation
//    (design pass 2026-07-16, retired the redundant hero button);
//  - empty states preserved from the retired position panel (NOT_CONFIGURED /
//    UNAVAILABLE / no-position CTA).

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { Figure } from "@/features/investor-ui/components/figure";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import { BitcoinOrb } from "./bitcoin-orb";
import type { ResolvedViewModel, InvestorPositionViewModel, MiningViewModel } from "@/features/investor-ui/types";
import type { AccumulationPoint } from "@/features/investor-ui/charts/accumulation-series";
import {
  toProvenance,
  formatUsdCompactAmount,
  formatBtcAmount,
} from "@/features/investor-ui/format-btc";
import { investDepositPath } from "@/lib/vaults/invest-routes";

const VAULT_ID = "hearst-yield-vault";

export interface DashboardHeroProps {
  position: ResolvedViewModel<InvestorPositionViewModel>;
  mining: MiningViewModel;
  /** Program cumulative accumulation series — the SAME series the chart plots. */
  accumulationPoints: readonly AccumulationPoint[];
  /** DataStatus of the production block backing the accumulation series. */
  accumulationStatus: string;
}

export function DashboardHero({
  position,
  mining,
  accumulationPoints,
  accumulationStatus,
}: DashboardHeroProps) {
  if (position.status === "NOT_CONFIGURED") {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataNotConfigured label="Position" detail="PermissionedDynaVault v2.1 is not deployed on this network yet." />
      </Card>
    );
  }

  if (position.status === "UNAVAILABLE" || position.status === "ERROR") {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Position" />
      </Card>
    );
  }

  const value = position.value;

  if (value == null || value.positionsCount === 0) {
    return (
      <Card className="w-full flex items-center justify-center p-[var(--ct-space-8)]">
        <div className="flex flex-col items-center gap-[var(--ct-space-3)] text-center">
          <span className="ct-bento-label ct-text-strong">No active position yet</span>
          <span className="body-sm ct-text-muted">Subscribe to the Hearst Mining Note to start accumulating Bitcoin.</span>
          <CockpitButton href={investDepositPath(VAULT_ID)} variant="secondary" shape="rect" size="lg" className="mt-[var(--ct-space-2)]">
            Allocate capital
          </CockpitButton>
        </div>
      </Card>
    );
  }

  const miningVal = mining.mining.value;
  const currentMonth = miningVal?.currentMonth ?? null;
  const totalMonths = miningVal?.productDurationMonths ?? 24;
  const termPct = currentMonth != null && totalMonths > 0 ? (currentMonth / totalMonths) * 100 : null;
  const termPctLabel = termPct != null ? `${termPct.toFixed(1).replace(/\.0$/, "")}% complete` : null;

  const lastPoint = accumulationPoints[accumulationPoints.length - 1];
  // Digits only — the "BTC" unit is typeset by <Figure> (uppercase, tracked,
  // muted, 55% baseline-locked), the term-sheet convention (P0.6).
  const btcAccumulated =
    lastPoint != null
      ? formatBtcAmount(lastPoint.cumulativeBtc.toFixed(8)).replace(/ BTC$/, "")
      : null;

  // KPI band cells — the institutional summary strip (design target). Each
  // carries its own tone; separators are hairline verticals between cells.
  const cells: KpiCell[] = [
    {
      label: "Current position",
      value: formatUsdCompactAmount(value.value) ?? "—",
      sub: "Principal + BTC value",
      tone: "accent",
      lead: true,
      badge: toProvenance(position.status),
    },
    {
      label: "Capital allocated",
      value: formatUsdCompactAmount(value.principal) ?? "—",
      sub: "Committed to the note",
    },
    {
      // Program-level cumulative series (the chart's line) — labelled as such
      // so it never reads as the investor's personal holding. No badge on a
      // "—" (honesty: never a fake number, never a badge on nothing).
      label: "BTC accumulated",
      value: btcAccumulated ?? "—",
      unit: btcAccumulated != null ? "BTC" : undefined,
      sub: "Program cumulative",
      tone: "btc",
      icon: "btc",
      badge: btcAccumulated != null ? toProvenance(accumulationStatus) : undefined,
    },
    {
      // Investor-level figure (position.accrued) — YOUR share, marked to spot.
      label: "Your BTC value",
      value: formatUsdCompactAmount(value.accrued) ?? "—",
      sub: "Your share, at spot",
    },
  ];

  return (
    <Card className="w-full overflow-hidden p-0" contentClassName="relative">
      {/* Page-level provenance badge — top-right of the band. */}
      <span className="absolute right-[var(--ct-space-3)] top-[var(--ct-space-2)] z-10">
        <ProvenanceBadge kind="simulated" variant="compact" />
      </span>

      {/* KPI band — Tailwind Plus "stats with hairline separators" skeleton
          rebuilt on tokens: dl grid gap-px on a hairline ground, each cell a
          full surface. dt = label · dd (small) = qualifier · dd (3xl, full
          width) = the figure. Orb rides the last column. */}
      <dl className="grid grid-cols-1 gap-px bg-[var(--ct-border-soft)] sm:grid-cols-2 xl:grid-cols-6">
        {cells.map((c) => (
          <KpiBandCell key={c.label} cell={c} />
        ))}

        {/* Reporting period cell — always rendered (same skeleton as the /btc
            band) with an honest fallback instead of a phantom empty column. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-2)] bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-6)]">
          <dt className="ct-bento-label">Reporting period</dt>
          {currentMonth != null ? (
            <>
              <dd className="body-xs ct-text-muted">{termPctLabel}</dd>
              <dd className="w-full flex-none text-[length:var(--ct-text-2xl)] font-medium tracking-tight leading-none ct-text-strong">
                Month <Figure value={currentMonth} unit={`/ ${totalMonths}`} className="ct-text-accent" />
              </dd>
              {/* Decorative bar — the "% complete" qualifier above carries the
                  same info for screen readers (no double announcement). */}
              <dd aria-hidden="true" className="w-full flex-none">
                <div className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,#ffffff_8%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[var(--ct-accent)]"
                    style={{ width: `${Math.min(100, termPct ?? 0)}%` }}
                  />
                </div>
              </dd>
            </>
          ) : (
            <>
              <dd className="body-xs ct-text-muted">Term not started</dd>
              <dd className="w-full flex-none text-[length:var(--ct-text-2xl)] font-medium ct-text-strong">—</dd>
            </>
          )}
        </div>

        {/* Orb column — same surface, same rhythm */}
        <div className="hidden xl:flex items-center justify-center bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]">
          <BitcoinOrb tone="accent" size={96} />
        </div>
      </dl>
    </Card>
  );
}

interface KpiCell {
  label: string;
  value: string;
  /** Unit suffix typeset by <Figure> ("BTC") — omitted on "—" and $-prefixed figures. */
  unit?: string;
  sub: string;
  tone?: "accent" | "btc" | "default";
  /** Optical primacy — ONE master figure per band (32px semibold), P0.2. */
  lead?: boolean;
  icon?: "btc";
  badge?: ReturnType<typeof toProvenance>;
}

function KpiBandCell({ cell }: { cell: KpiCell }) {
  const valueClass =
    cell.tone === "accent"
      ? "ct-text-accent"
      : cell.tone === "btc"
        ? "text-[var(--ct-asset-btc)]"
        : "ct-text-strong";
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-2)] bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-6)] min-w-0">
      {/* Micro-label — ONE voice across the page: ct-bento-label (uppercase,
          tracking-widest, muted), same convention as the Zone 3 cards (P0.6). */}
      <dt className="flex items-center gap-[var(--ct-space-1_5)] ct-bento-label min-w-0">
        {cell.icon === "btc" ? <AssetIcon variant="btc" size="sm" label="" /> : null}
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
