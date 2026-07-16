// BtcHeroBand — /btc cockpit KPI band, the orange sibling of the /dashboard
// hero (dashboard-hero.tsx is the reference skeleton: 5-column grid, hairline
// vertical separators, page provenance badge pinned top-right, BitcoinOrb
// integrated at the right edge). Server component, presentation-only: every
// figure arrives pre-formatted from the page (string | null), no math here.
// Cells are the SHARED KpiBandCell / ReportingPeriodCell (P1.2) with
// tone="btc" — no local cell duplication left.
//
// Honesty contract:
//  - "Your attributed BTC" = the investor's economic share, per-holder — it
//    carries its own attribution provenance badge, and its qualifier shows
//    the last reconciliation date when the page provides it (P1.7);
//  - "Mining-produced BTC" is fleet production, labelled as such, with the
//    production block's own provenance;
//  - null figures render "—" (never a fake number, never a fake badge);
//  - the page-level badge is DERIVED from the band's source provenances
//    (all simulated -> "simulated", else the dominant real status — P1.2);
//  - direction FLAT: no glow, no box-shadow, no halo anywhere in the band.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  KpiBandCell,
  ReportingPeriodCell,
  deriveBandProvenance,
  type KpiBandCellData,
} from "@/features/investor-ui/components/kpi-band-cell";
import { BitcoinOrb } from "@/features/investor-ui/components/bitcoin-orb";
import { formatIsoDate, type BtcProvenanceKind } from "@/features/investor-ui/format-btc";

export interface BtcHeroBandProps {
  attributedBtc: string | null;
  vaultReserveBtc: string | null;
  miningProducedBtc: string | null;
  currentValueUsd: string | null;
  monthsElapsed: number | null;
  monthsTotal: number;
  attributionProvenance: BtcProvenanceKind;
  productionProvenance: BtcProvenanceKind;
  /** ISO — attribution last reconciled (attribution.lastVerifiedAt). When
   *  provided, the lead cell's qualifier reads "Reconciled Jul 1, 2026"
   *  instead of the generic share label (P1.7). */
  attributionReconciledAt?: string | null;
}

export function BtcHeroBand({
  attributedBtc,
  vaultReserveBtc,
  miningProducedBtc,
  currentValueUsd,
  monthsElapsed,
  monthsTotal,
  attributionProvenance,
  productionProvenance,
  attributionReconciledAt,
}: BtcHeroBandProps) {
  // Figures arrive pre-formatted "x.xxxx BTC" — split the unit suffix so
  // <Figure> can typeset it (uppercase, tracked, muted, 55%, P0.6). String
  // presentation split only, no math.
  const attributed = splitBtcUnit(attributedBtc);
  const reserve = splitBtcUnit(vaultReserveBtc);
  const produced = splitBtcUnit(miningProducedBtc);

  // Reconciliation qualifier (P1.7) — only when the data carries the date.
  const attributedSub =
    attributionReconciledAt != null
      ? `Reconciled ${formatIsoDate(attributionReconciledAt)}`
      : "Your economic share";

  // KPI band cells — same institutional strip as the dashboard hero, orange
  // dominance: the attributed-BTC figure leads in --ct-asset-btc.
  const cells: KpiBandCellData[] = [
    {
      label: "Your attributed BTC",
      value: attributed?.value ?? "—",
      unit: attributed?.unit,
      sub: attributedSub,
      tone: "btc",
      lead: true,
      badge: attributionProvenance,
    },
    {
      label: "Vault BTC reserve",
      value: reserve?.value ?? "—",
      unit: reserve?.unit,
      sub: "Held in custody",
    },
    {
      label: "Mining-produced BTC",
      value: produced?.value ?? "—",
      unit: produced?.unit,
      sub: "Fleet production",
      icon: "mining",
      badge: productionProvenance,
    },
    {
      label: "Current value",
      value: currentValueUsd ?? "—",
      sub: "Marked to spot",
    },
  ];

  // Page-level badge — derived from the band's sources, never hardcoded.
  const pageProvenance = deriveBandProvenance([attributionProvenance, productionProvenance]);

  return (
    <Card className="w-full overflow-hidden p-0" contentClassName="relative">
      {/* Page-level provenance badge — top-right of the band. */}
      <span className="absolute right-[var(--ct-space-3)] top-[var(--ct-space-2)] z-10">
        <ProvenanceBadge kind={pageProvenance} variant="compact" />
      </span>

      {/* KPI band — Tailwind Plus "stats with hairline separators" skeleton
          rebuilt on tokens (mirrors the dashboard band, orange dominance). */}
      <dl className="grid grid-cols-1 gap-px bg-[var(--ct-border-soft)] sm:grid-cols-2 xl:grid-cols-6">
        {cells.map((c) => (
          <KpiBandCell key={c.label} cell={c} />
        ))}

        {/* Reporting period cell — always rendered, honest fallback. */}
        <ReportingPeriodCell currentMonth={monthsElapsed} totalMonths={monthsTotal} tone="btc" />

        {/* Orb column — same surface, same rhythm */}
        <div className="hidden xl:flex items-center justify-center bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]">
          <BitcoinOrb tone="btc" size={96} />
        </div>
      </dl>
    </Card>
  );
}

/** "0.5170 BTC" -> { value: "0.5170", unit: "BTC" } — presentation split only. */
function splitBtcUnit(v: string | null): { value: string; unit?: string } | null {
  if (v == null) return null;
  return v.endsWith(" BTC") ? { value: v.slice(0, -4), unit: "BTC" } : { value: v };
}
