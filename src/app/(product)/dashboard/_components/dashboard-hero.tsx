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
import {
  KpiBandCell,
  ReportingPeriodCell,
  deriveBandProvenance,
  type KpiBandCellData,
} from "@/features/investor-ui/components/kpi-band-cell";
import { DataNotConfigured, DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import { BitcoinOrb } from "@/features/investor-ui/components/bitcoin-orb";
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

  const lastPoint = accumulationPoints[accumulationPoints.length - 1];
  // Digits only — the "BTC" unit is typeset by <Figure> (uppercase, tracked,
  // muted, 55% baseline-locked), the term-sheet convention (P0.6).
  const btcAccumulated =
    lastPoint != null
      ? formatBtcAmount(lastPoint.cumulativeBtc.toFixed(8)).replace(/ BTC$/, "")
      : null;

  // KPI band cells — the institutional summary strip (design target). Each
  // carries its own tone; separators are hairline verticals between cells.
  const cells: KpiBandCellData[] = [
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

  // Page-level badge — DERIVED from the provenance of the sources actually
  // present in the band (position block + accumulation series when shown),
  // never hardcoded: all simulated -> "simulated", otherwise the dominant
  // real status (P1.2).
  const pageProvenance = deriveBandProvenance([
    toProvenance(position.status),
    ...(btcAccumulated != null ? [toProvenance(accumulationStatus)] : []),
  ]);

  return (
    <Card className="w-full overflow-hidden p-0" contentClassName="relative">
      {/* Instrument identity — numbered-document microline (P2.3), band
          corner OPPOSITE the provenance badge. */}
      <span className="dash-instrument-id absolute left-[var(--ct-space-3)] top-[var(--ct-space-2)] z-10">
        Hearst Mining Note · Series 24-A · Cayman SPV
      </span>

      {/* Page-level provenance badge — top-right of the band, on an opaque
          --ct-bg-deep chip so it reads OVER the orb rings instead of
          colliding with them (P2.3). */}
      <span className="absolute right-[var(--ct-space-3)] top-[var(--ct-space-2)] z-10 inline-flex items-center rounded-full bg-[var(--ct-bg-deep)] px-[var(--ct-space-1_5)] py-[var(--ct-space-1)]">
        <ProvenanceBadge kind={pageProvenance} variant="compact" />
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
        <ReportingPeriodCell currentMonth={currentMonth} totalMonths={totalMonths} tone="accent" />

        {/* Orb column — same surface, same rhythm */}
        <div className="hidden xl:flex items-center justify-center bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]">
          <BitcoinOrb tone="accent" size={96} />
        </div>
      </dl>
    </Card>
  );
}
