// BtcHeroBand — /btc cockpit KPI band, the orange sibling of the /dashboard
// hero (dashboard-hero.tsx is the reference skeleton: 5-column grid, hairline
// vertical separators, page provenance badge pinned bottom-right, BitcoinOrb
// integrated at the right edge). Server component, presentation-only: every
// figure arrives pre-formatted from the page (string | null), no math here.
//
// Honesty contract:
//  - "Your attributed BTC" = the investor's economic share, per-holder — it
//    carries its own attribution provenance badge;
//  - "Mining-produced BTC" is fleet production, labelled as such, with the
//    production block's own provenance;
//  - null figures render "—" (never a fake number, never a fake badge);
//  - direction FLAT: no glow, no box-shadow, no halo anywhere in the band.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { BitcoinOrb } from "../../dashboard/_components/bitcoin-orb";
import type { BtcProvenanceKind } from "@/features/investor-ui/format-btc";

export interface BtcHeroBandProps {
  attributedBtc: string | null;
  vaultReserveBtc: string | null;
  miningProducedBtc: string | null;
  currentValueUsd: string | null;
  monthsElapsed: number | null;
  monthsTotal: number;
  attributionProvenance: BtcProvenanceKind;
  productionProvenance: BtcProvenanceKind;
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
}: BtcHeroBandProps) {
  const termPct =
    monthsElapsed != null && monthsTotal > 0 ? (monthsElapsed / monthsTotal) * 100 : null;
  const termPctLabel =
    termPct != null ? `${termPct.toFixed(1).replace(/\.0$/, "")}% complete` : null;

  // KPI band cells — same institutional strip as the dashboard hero, orange
  // dominance: the attributed-BTC figure leads in --ct-asset-btc.
  const cells: KpiCell[] = [
    {
      label: "Your attributed BTC",
      value: attributedBtc ?? "—",
      sub: "Your economic share",
      tone: "btc-lead",
      badge: attributionProvenance,
    },
    {
      label: "Vault BTC reserve",
      value: vaultReserveBtc ?? "—",
      sub: "Held in custody",
    },
    {
      label: "Mining-produced BTC",
      value: miningProducedBtc ?? "—",
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

  return (
    <Card className="w-full overflow-hidden p-0" contentClassName="flex flex-col">
      {/* KPI band + orb — one compact row; page-level provenance badge in the
          bottom-right corner (mirrors the dashboard band). */}
      <div className="relative flex flex-col xl:flex-row items-center gap-[var(--ct-space-3)] px-[var(--ct-space-5)] py-[var(--ct-space-3)]">
        <span className="absolute bottom-[var(--ct-space-2)] right-[var(--ct-space-3)]">
          <ProvenanceBadge kind="simulated" variant="compact" />
        </span>
        <div className="grid w-full flex-1 min-w-0 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {cells.map((c, i) => (
            <KpiBandCell key={c.label} cell={c} first={i === 0} />
          ))}

          {/* Reporting period cell (5th) — term progress, FLAT orange fill */}
          <div className="flex min-w-0 flex-col justify-center gap-[var(--ct-space-1)] px-[var(--ct-space-4)] py-[var(--ct-space-1)] border-l border-[var(--ct-border-soft)]">
            <span className="ct-bento-label truncate">Reporting period</span>
            {monthsElapsed != null ? (
              <>
                <span className="ct-text-strong text-[length:var(--ct-text-lg)] font-medium leading-tight">
                  Month <span className="text-[var(--ct-asset-btc)] tabular">{monthsElapsed}</span>
                  <span className="ct-text-muted"> / {monthsTotal}</span>
                </span>
                {/* Decorative bar — the adjacent "% complete" caption carries
                    the same info for screen readers (no double announcement). */}
                <div
                  aria-hidden="true"
                  className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,#ffffff_8%,transparent)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--ct-asset-btc)]"
                    style={{ width: `${Math.min(100, termPct ?? 0)}%` }}
                  />
                </div>
                {termPctLabel ? <span className="ct-metric-caption">{termPctLabel}</span> : null}
              </>
            ) : (
              <>
                <span className="ct-text-strong text-[length:var(--ct-text-lg)] font-medium leading-tight">
                  —
                </span>
                <span className="ct-metric-caption truncate">Term not started</span>
              </>
            )}
          </div>
        </div>

        <div className="hidden xl:flex items-center justify-center px-[var(--ct-space-2)]">
          <BitcoinOrb tone="btc" size={88} />
        </div>
      </div>
    </Card>
  );
}

interface KpiCell {
  label: string;
  value: string;
  sub: string;
  /** "btc-lead" = the dominant orange figure (xl size); default = neutral. */
  tone?: "btc-lead" | "default";
  icon?: "mining";
  badge?: BtcProvenanceKind;
}

function KpiBandCell({ cell, first }: { cell: KpiCell; first: boolean }) {
  const valueClass = cell.tone === "btc-lead" ? "text-[var(--ct-asset-btc)]" : "ct-text-strong";
  const valueSize = cell.tone === "btc-lead" ? "var(--ct-text-xl)" : "var(--ct-text-lg)";
  return (
    <div
      className={`flex min-w-0 flex-col gap-[var(--ct-space-1)] px-[var(--ct-space-4)] py-[var(--ct-space-1)]${
        first ? "" : " border-l border-[var(--ct-border-soft)]"
      }`}
    >
      <span className="flex items-center gap-[var(--ct-space-1_5)] min-w-0">
        {cell.icon === "mining" ? <AssetIcon variant="mining" size="sm" label="" /> : null}
        <span className="ct-bento-label truncate">{cell.label}</span>
        {cell.badge ? <ProvenanceBadge kind={cell.badge} variant="strip" /> : null}
      </span>
      <span
        className={`${valueClass} font-medium tabular tracking-tight leading-none`}
        style={{ fontSize: valueSize }}
      >
        {cell.value}
      </span>
      <span className="ct-metric-caption truncate">{cell.sub}</span>
    </div>
  );
}
