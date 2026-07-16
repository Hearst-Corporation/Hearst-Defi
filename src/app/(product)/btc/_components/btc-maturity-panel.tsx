// src/app/(product)/btc/_components/btc-maturity-panel.tsx
//
// PROMPT 236 — Zone 5. The final answer the /btc page owes the investor:
// "where is my BTC delivered, and when?". BTC-only maturity, custody status,
// and a short delivery progression. Reserve Health collapses into a single
// "operating reserve" line here rather than living as its own card.
//
// Product-absolute: maturity delivery is BTC only — no USDC redemption is ever
// shown on the investor surface. The destination wallet reads "Pending contract
// deployment" while PermissionedDynaVault v2.1 is undeployed (CLAUDE.md #8) —
// honest, not fabricated; the BTC-only TARGET is stated regardless.

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { StepTimeline, type StepTimelineItem } from "@/components/catalyst/step-timeline";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import { formatIsoDate, formatPeriodMonth } from "@/features/investor-ui/format-btc";
import type { BitcoinReserveViewModel } from "@/features/investor-ui/types/btc";
import type { BtcCustodyViewModel } from "../_data/btc-page-types";

interface Row {
  label: string;
  value: React.ReactNode;
}

/** `asOf` (+ months remaining) -> "Mar 2028" — the estimated maturity month.
 *  Month precision only: the exact delivery day is a contract detail we do
 *  not fabricate. Returns null when either input is missing/invalid. */
function estimatedMaturityLabel(
  asOf: string | null | undefined,
  monthsRemaining: number | null,
): string | null {
  if (asOf == null || monthsRemaining == null) return null;
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return null;
  const totalMonths = d.getUTCFullYear() * 12 + d.getUTCMonth() + monthsRemaining;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  const period = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return `${formatPeriodMonth(period)} ${year}`;
}

export function BtcMaturityPanel({
  monthsElapsed,
  monthsTotal,
  custody,
  reserve,
  asOf = null,
  provenance = "simulated",
}: {
  monthsElapsed: number | null;
  monthsTotal: number | null;
  custody: BtcCustodyViewModel | null;
  reserve: BitcoinReserveViewModel | null;
  /** ISO reference date the month count refers to (page `generatedAt`) —
   *  anchors the estimated maturity date. */
  asOf?: string | null;
  provenance?: Provenance;
}) {
  const monthsRemaining =
    monthsElapsed != null && monthsTotal != null ? Math.max(0, monthsTotal - monthsElapsed) : null;

  // P1.7 dedup — the "Month x / 24" term bar lives in the hero (single
  // occurrence on the surface); this card contributes NEW information
  // instead: the estimated maturity month.
  const estimatedMaturity = estimatedMaturityLabel(asOf, monthsRemaining);

  const custodyLinked = custody?.provider != null && custody.provider !== "unknown";
  const custodyCurrent = custody?.proofOfReserveAttestedAt != null;

  const electricityMonths = reserve?.electricityCoveredMonths ?? null;

  const rows: Row[] = [
    { label: "Delivery asset", value: <span className="text-[var(--ct-asset-btc)] font-medium">BTC only</span> },
    {
      // Dedup (P1.7): the hero owns the "Month x / 24" term bar — this card
      // shows the estimated maturity month instead (new information).
      label: "Estimated maturity",
      value:
        estimatedMaturity != null ? (
          estimatedMaturity
        ) : (
          <span className="ct-text-muted">—</span>
        ),
    },
    { label: "Months remaining", value: monthsRemaining != null ? String(monthsRemaining) : "—" },
    {
      label: "Destination wallet",
      value: <span className="ct-text-muted">Pending contract deployment</span>,
    },
    {
      label: "Custody",
      value: custodyLinked
        ? `Fireblocks · vault ${custody?.vaultAccountId ?? "—"}`
        : "Not yet linked",
    },
    {
      label: "Operating reserve",
      value:
        electricityMonths != null
          ? `${electricityMonths} months of electricity covered`
          : "—",
    },
    { label: "Final delivery", value: "At product maturity" },
  ];

  const steps: StepTimelineItem[] = [
    { title: "Capital allocated", description: "Subscription settled into the note's three pockets.", tone: "accent" },
    {
      // In progress → neutral: the single green marks completed/verified
      // milestones only, never an unfinished one.
      title: "Mining & accumulation",
      description: monthsRemaining != null ? `In progress — ${monthsRemaining} months remaining.` : "In progress.",
      tone: "neutral",
    },
    {
      title: "Final custody verification",
      description: "Proof-of-reserve reconciled before delivery.",
      tone: "neutral",
    },
    { title: "BTC delivered to wallet", description: "At product maturity, in BTC.", tone: "neutral" },
  ];

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <AssetIcon variant="btc" size="sm" />
          <span className="ct-bento-label">BTC maturity delivery</span>
        </div>
        <span className="flex items-center gap-[var(--ct-space-3)]">
          <BentoBadge variant={custodyCurrent ? "success" : "warning"}>
            {custodyCurrent ? "Custody current" : "Custody pending"}
          </BentoBadge>
          <ProvenanceBadge kind={provenance} variant="compact" />
        </span>
      </div>

      {/* Product-absolute statement */}
      <div className="rounded-[var(--ct-radius-md)] border border-[var(--ct-asset-btc-border)] bg-[var(--ct-asset-btc-soft)] px-[var(--ct-space-4)] py-[var(--ct-space-3)]">
        <span className="body-sm ct-text-strong font-medium">Maturity delivery: BTC only</span>
        <span className="block ct-metric-caption text-[var(--ct-text-muted)]">
          The note accumulates over its 24-month term and delivers accumulated Bitcoin at maturity — there is no
          periodic cash payout.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-[var(--ct-space-5)] lg:grid-cols-2">
        <dl className="flex flex-col gap-[var(--ct-space-3)]">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-[var(--ct-space-4)] border-b border-[var(--ct-border-soft)] pb-[var(--ct-space-2)] last:border-b-0 last:pb-0">
              <dt className="ct-bento-label">{r.label}</dt>
              <dd className="body-sm ct-text-strong tabular m-0 text-right">{r.value}</dd>
            </div>
          ))}
          {custodyCurrent ? (
            <p className="ct-metric-caption text-[var(--ct-text-muted)] m-0">
              Last proof-of-reserve attested {formatIsoDate(custody?.proofOfReserveAttestedAt ?? null)}.
            </p>
          ) : null}
          {custody?.withdrawalPolicy ? (
            <p className="ct-metric-caption text-[var(--ct-text-muted)] m-0">
              Withdrawal policy: {custody.withdrawalPolicy}
            </p>
          ) : null}
        </dl>

        <div className="flex flex-col gap-[var(--ct-space-3)]">
          <span className="ct-bento-label">Delivery progression</span>
          <StepTimeline steps={steps} aria-label="BTC delivery progression" />
        </div>
      </div>
    </Card>
  );
}
