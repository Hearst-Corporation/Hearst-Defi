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
    <Card className="w-full overflow-hidden p-0" contentClassName="relative">
      {/* Page-level provenance badge — top-right of the band. */}
      <span className="absolute right-[var(--ct-space-3)] top-[var(--ct-space-2)] z-10">
        <ProvenanceBadge kind="simulated" variant="compact" />
      </span>

      {/* KPI band — Tailwind Plus "stats with hairline separators" skeleton
          rebuilt on tokens (mirrors the dashboard band, orange dominance). */}
      <dl className="grid grid-cols-1 gap-px bg-[var(--ct-border-soft)] sm:grid-cols-2 xl:grid-cols-6">
        {cells.map((c) => (
          <KpiBandCell key={c.label} cell={c} />
        ))}

        {/* Reporting period cell — always rendered, honest fallback. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-2)] bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-6)]">
          <dt className="body-xs font-medium ct-text-muted">Reporting period</dt>
          {monthsElapsed != null ? (
            <>
              <dd className="text-xs font-medium ct-text-muted">{termPctLabel}</dd>
              <dd className="w-full flex-none text-[length:var(--ct-text-2xl)] font-medium tracking-tight leading-none ct-text-strong">
                Month <span className="text-[var(--ct-asset-btc)] tabular">{monthsElapsed}</span>
                <span className="ct-text-muted text-[length:var(--ct-text-base)] font-normal"> / {monthsTotal}</span>
              </dd>
              {/* Decorative bar — the "% complete" qualifier above carries the
                  same info for screen readers (no double announcement). */}
              <dd aria-hidden="true" className="w-full flex-none">
                <div className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,#ffffff_8%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[var(--ct-asset-btc)]"
                    style={{ width: `${Math.min(100, termPct ?? 0)}%` }}
                  />
                </div>
              </dd>
            </>
          ) : (
            <>
              <dd className="text-xs font-medium ct-text-muted">Term not started</dd>
              <dd className="w-full flex-none text-[length:var(--ct-text-2xl)] font-medium ct-text-strong">—</dd>
            </>
          )}
        </div>

        {/* Orb column — same surface, same rhythm */}
        <div className="hidden xl:flex items-center justify-center bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-4)]">
          <BitcoinOrb tone="btc" size={96} />
        </div>
      </dl>
    </Card>
  );
}

interface KpiCell {
  label: string;
  value: string;
  sub: string;
  /** "btc-lead" = the dominant orange figure; default = neutral. */
  tone?: "btc-lead" | "default";
  icon?: "mining";
  badge?: BtcProvenanceKind;
}

function KpiBandCell({ cell }: { cell: KpiCell }) {
  const valueClass = cell.tone === "btc-lead" ? "text-[var(--ct-asset-btc)]" : "ct-text-strong";
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-2)] bg-[var(--ct-bg-deep)] px-[var(--ct-space-5)] py-[var(--ct-space-6)] min-w-0">
      <dt className="flex items-center gap-[var(--ct-space-1_5)] body-xs font-medium ct-text-muted min-w-0">
        {cell.icon === "mining" ? <AssetIcon variant="mining" size="sm" label="" /> : null}
        <span className="truncate">{cell.label}</span>
        {cell.badge ? <ProvenanceBadge kind={cell.badge} variant="strip" /> : null}
      </dt>
      <dd
        className={`${valueClass} w-full flex-none text-[length:var(--ct-text-2xl)] font-medium tabular tracking-tight leading-none`}
      >
        {cell.value}
      </dd>
    </div>
  );
}
