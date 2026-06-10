// Term sheet preview for /vaults/[id] — Step 2 of 4.
// Server Component. No I/O. Composed from locked DS primitives.
// APY via <ApyRange> (#1). Provenance badges on every KPI (#2).
// Disclaimers section present (#10). No forbidden words (#5).

import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { VaultProduct } from "@/lib/data/vaults";
import {
  SHARE_CLASS_A,
  SHARE_CLASS_B,
  type ShareClassTerms,
} from "@/lib/engine/share-class";

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const USD_FULL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const SPV_LABELS: Record<string, string> = {
  cayman: "Cayman Islands Exempted Limited Partnership",
  bvi: "British Virgin Islands LP",
  delaware: "Delaware LP",
  lux: "Luxembourg RAIF",
};

const REG_LABELS: Record<string, string> = {
  regD_506c: "Reg D, Rule 506(c) — US Accredited Investors",
  regS: "Reg S — Non-US Qualified Investors",
  art2_lux: "Art. 2 RAIF — EU Professional Investors",
};

const ALLOCATION_ROWS = (vault: VaultProduct) => [
  {
    label: "Bitcoin Mining Operations",
    bps: vault.targetMiningBps,
    description:
      "Directly deployed hashrate — revenue share from partner mining facilities. Primary yield engine.",
  },
  {
    label: "BTC Tactical Delta",
    bps: vault.targetBtcTacticalBps,
    description:
      "Spot BTC exposure for directional upside. Sized within a realised-volatility guardrail (≤ 35v).",
  },
  {
    label: "USDC Base Lending",
    bps: vault.targetUsdcBaseBps,
    description:
      "T-bills + on-chain lending (Aave/Compound weighted average). Distributable in stable periods.",
  },
  {
    label: "Stable Reserve",
    bps: vault.targetStableReserveBps,
    description:
      "USDC native yield buffer. Funds 60-day soft lock-up window and redemption queue.",
  },
];

interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

function Section({ id, title, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="h2">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface KpiRowProps {
  label: string;
  value: React.ReactNode;
  provenance?: "estimated" | "attested" | "live" | "manual";
}

function KpiRow({ label, value, provenance = "manual" }: KpiRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--ct-border-soft)] last:border-0">
      <span className="stat-label min-w-0 shrink">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <ProvenanceBadge kind={provenance} />
        <span className="tabular text-sm font-semibold ct-text-strong text-right">
          {value}
        </span>
      </div>
    </div>
  );
}

interface TermSheetPreviewProps {
  vault: VaultProduct;
}

/**
 * Full term sheet for /vaults/[id].
 * Sections: KPIs, Strategy, Allocation policy, Legal, Disclaimers.
 */
export function TermSheetPreview({ vault }: TermSheetPreviewProps) {
  const allocRows = ALLOCATION_ROWS(vault);

  // Engine presets are the single source of truth for class economics
  // (min ticket, lock-up, fees, hurdle). The vault row only selects the class.
  const terms: ShareClassTerms =
    vault.shareClass === "B" ? SHARE_CLASS_B : SHARE_CLASS_A;
  const mgmtPct = (terms.mgmtFeeBps / 100).toFixed(2);
  const perfPct = (terms.perfFeeBps / 100).toFixed(0);
  const hurdlePct = (terms.hurdleBps / 100).toFixed(0);

  return (
    // Two-column layout (desktop) to halve vertical height. Left column holds
    // the long "Key metrics" list; right column stacks Strategy + Legal +
    // Disclaimers so both columns end at a comparable height. Allocation policy
    // spans full width below the grid. Single column < md.
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {/* ── Left column — KPIs ──────────────────────────────────────── */}
        <Section id="sec-kpis" title="Key metrics">
          <Card className="flex flex-col gap-0">
            {/* APY range — mandatory primitive (#1), provenance badge (#2) */}
            <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--ct-border-soft)]">
              <span className="stat-label min-w-0 shrink">Target APY range</span>
              <div className="flex items-center gap-2 shrink-0">
                <ProvenanceBadge kind="estimated" />
                <ApyRange
                  low={vault.apyLow}
                  high={vault.apyHigh}
                  precision={1}
                  className="text-sm"
                />
              </div>
            </div>

            <KpiRow
              label="Soft lock-up period"
              value={`${terms.softLockupDays} days`}
              provenance="manual"
            />
            <KpiRow
              label="Minimum subscription"
              value={USD_FULL.format(terms.minTicketUsdc)}
              provenance="manual"
            />
            <KpiRow
              label="Management fee"
              value={`${mgmtPct}% p.a.`}
              provenance="manual"
            />
            <KpiRow
              label="Performance fee"
              value={`${perfPct}%${terms.hurdleBps > 0 ? ` above ${hurdlePct}% hurdle` : " (no hurdle)"}`}
              provenance="manual"
            />
            <KpiRow
              label="Vault capacity"
              value={USD_COMPACT.format(vault.capacityUsdc)}
              provenance="manual"
            />
            {/* Distribution Coverage = net mining cash flow ÷ target monthly
                distribution. The headline RWA metric. Pending until the first
                live mining revenue period is attested — never shown as Live. */}
            <KpiRow
              label="Distribution coverage"
              value="Pending — first mining revenue period"
              provenance="estimated"
            />
            <KpiRow
              label="Current AUM (USDC reserve)"
              value={USD_COMPACT.format(vault.currentAumUsdc)}
              provenance="manual"
            />
            <KpiRow
              label="Distribution cadence"
              value="Indicative — Monthly, Day 1 (T+5)"
              provenance="manual"
            />
            <KpiRow
              label="Methodology"
              value="v1.0 (active)"
              provenance="manual"
            />
          </Card>
        </Section>

        {/* ── Right column — Strategy + Legal + Disclaimers ───────────── */}
        <div className="flex flex-col gap-6">
          <Section id="sec-strategy" title="Strategy & provenance">
            <Card className="flex flex-col gap-3">
              <p className="body-md ct-text-body">{vault.description}</p>
              {/* Model B one-liner — mandatory per ADR-006 (RR-SC-07) */}
              <p className="body-sm ct-text-muted">
                Principal held in a USDC cash reserve — not deployed on-chain; yield is a monthly mining-revenue-share distribution
              </p>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--ct-border-soft)]">
                <Badge variant="brand">Mining-backed</Badge>
                <Badge variant="default">Rule-based rebalancing</Badge>
                <Badge variant="default">Monthly USDC distributions</Badge>
                <Badge variant="default">No leverage</Badge>
              </div>
              <div className="pt-2 border-t border-[var(--ct-border-soft)]">
                <p className="body-sm ct-text-muted">
                  <strong className="ct-text-body">Methodology:</strong> Yield
                  projections follow{" "}
                  <span className="mono">v1.0</span> — a weighted-bucket model
                  combining mining net distributable yield, USDC base lending,
                  BTC tactical P&L, and stable reserve yield. APY ranges use
                  ±10–30% assumption risk factors and include a minimum display
                  spread, so a range is never read as a precise figure.
                  Published and immutable; any change requires a version bump
                  and an Architecture Decision Record.
                </p>
              </div>
            </Card>
          </Section>

          <Section id="sec-legal" title="Legal & structure">
            <Card className="flex flex-col gap-0">
              <KpiRow
                label="SPV structure"
                value={
                  SPV_LABELS[vault.spvJurisdiction] ?? vault.spvJurisdiction
                }
                provenance="manual"
              />
              <KpiRow
                label="Share class"
                value={`Class ${vault.shareClass}`}
                provenance="manual"
              />
              <KpiRow
                label="Regulatory exemption"
                value={REG_LABELS[vault.regExemption] ?? vault.regExemption}
                provenance="manual"
              />
              <KpiRow
                label="Custodian"
                value="Custody configuration pending"
                provenance="manual"
              />
              <KpiRow
                label="Multisig threshold"
                value="Multisig approval required"
                provenance="manual"
              />
              <KpiRow
                label="Audit"
                value="Spearbit · scheduled"
                provenance="manual"
              />
            </Card>
          </Section>

          {/* Disclaimers (#10 — mandatory "not guaranteed") */}
          <Section id="sec-disclaimers" title="Disclaimers">
            <Card
              className="border border-[var(--ct-border-strong)]"
              role="note"
              aria-label="Important disclaimers"
            >
              <p className="body-sm ct-text-muted leading-relaxed">
                {vault.disclaimers}
              </p>
              <p className="body-xs ct-text-faint mt-3 pt-3 border-t border-[var(--ct-border-soft)]">
                APY ranges are not a projection of returns. Past performance
                does not indicate future results. Allocations shown are targets
                and may deviate. This document is informational only and does
                not constitute an offer or solicitation where prohibited by law.
              </p>
            </Card>
          </Section>
        </div>
      </div>

      {/* ── Allocation policy — full width below the grid ─────────────── */}
      <Section id="sec-alloc" title="Allocation policy">
        <Card className="grid gap-x-8 gap-y-0 md:grid-cols-2">
          {allocRows.map((row, i) => {
            // On md+ the rows split into two columns: the soft divider should
            // be hidden on the last row of each column, not just the last row.
            const isLastInSingle = i === allocRows.length - 1;
            const isLastInColumn = i >= allocRows.length - 2;
            return (
              <div
                key={row.label}
                className={cn(
                  "flex flex-col gap-1 py-3 border-b border-[var(--ct-border-soft)]",
                  isLastInSingle && "border-0",
                  isLastInColumn && "md:border-0",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="body-md font-semibold ct-text-primary">
                    {row.label}
                  </span>
                  <span className="tabular mono font-semibold text-sm ct-text-strong">
                    {(row.bps / 100).toFixed(0)}%
                  </span>
                </div>
                <p className="body-sm ct-text-muted">{row.description}</p>
              </div>
            );
          })}
        </Card>
      </Section>
    </div>
  );
}
