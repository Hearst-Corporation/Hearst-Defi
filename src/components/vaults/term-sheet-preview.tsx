// Term sheet preview for /vaults/[id] — Step 2 of 4.
// Server Component. No I/O. Composed from locked DS primitives.
// APY via <ApyRange> (#1). Provenance grouped per section (#2) — not per row.
// Disclaimers section present (#10). No forbidden words (#5).

import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
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
      "Directly deployed hashrate — revenue share from partner mining facilities.",
  },
  {
    label: "BTC Tactical Delta",
    bps: vault.targetBtcTacticalBps,
    description:
      "Spot BTC exposure for directional upside within a realised-volatility guardrail.",
  },
  {
    label: "USDC Base Lending",
    bps: vault.targetUsdcBaseBps,
    description: "T-bills + on-chain lending weighted average.",
  },
  {
    label: "Stable Reserve",
    bps: vault.targetStableReserveBps,
    description: "USDC yield buffer for soft lock-up and redemption queue.",
  },
];

interface SectionProps {
  id: string;
  title: string;
  provenance?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function Section({ id, title, provenance, children, className }: SectionProps) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id={id} className="h2">
          {title}
        </h2>
        {provenance}
      </div>
      {children}
    </section>
  );
}

function LightPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--ct-border-soft)] ct-surface-1 p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="stat-label">{label}</span>
      <span className="tabular text-base font-semibold ct-text-strong">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--ct-border-soft)] last:border-0">
      <span className="stat-label shrink-0">{label}</span>
      <span className="body-sm ct-text-body text-right">{value}</span>
    </div>
  );
}

interface TermSheetPreviewProps {
  vault: VaultProduct;
}

/**
 * Term sheet sections for /vaults/[id].
 * Provenance is grouped per section — not repeated on every KPI row.
 */
export function TermSheetPreview({ vault }: TermSheetPreviewProps) {
  const allocRows = ALLOCATION_ROWS(vault);

  const terms: ShareClassTerms =
    vault.shareClass === "B" ? SHARE_CLASS_B : SHARE_CLASS_A;
  const mgmtPct = (terms.mgmtFeeBps / 100).toFixed(2);
  const perfPct = (terms.perfFeeBps / 100).toFixed(0);
  const hurdlePct = (terms.hurdleBps / 100).toFixed(0);

  const aumProvenance =
    vault.currentAumUsdc > 0 ? ("live" as const) : ("manual" as const);

  return (
    <div className="flex flex-col gap-10">
      {/* ── At a glance — 6 headline metrics, one provenance line ── */}
      <Section
        id="sec-glance"
        title="At a glance"
        provenance={
          <p className="body-xs ct-text-faint flex flex-wrap items-center gap-1.5">
            <span>Metrics:</span>
            <ProvenanceBadge kind="estimated" />
            <ProvenanceBadge kind="manual" />
            {vault.currentAumUsdc > 0 ? <ProvenanceBadge kind={aumProvenance} /> : null}
          </p>
        }
      >
        <LightPanel>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <MetricRow
              label="Target APY range"
              value={
                <ApyRange low={vault.apyLow} high={vault.apyHigh} precision={1} />
              }
            />
            <MetricRow
              label="Minimum subscription"
              value={USD_FULL.format(terms.minTicketUsdc)}
            />
            <MetricRow
              label="Soft lock-up"
              value={`${terms.softLockupDays} days`}
            />
            <MetricRow
              label="Management / performance"
              value={`${mgmtPct}% · ${perfPct}%${terms.hurdleBps > 0 ? ` (${hurdlePct}% hurdle)` : ""}`}
            />
            <MetricRow
              label="Vault capacity"
              value={USD_COMPACT.format(vault.capacityUsdc)}
            />
            <MetricRow
              label="Current AUM"
              value={
                vault.currentAumUsdc > 0
                  ? USD_COMPACT.format(vault.currentAumUsdc)
                  : "Pending snapshot"
              }
            />
          </div>
          <p className="body-xs ct-text-faint mt-5 pt-4 border-t border-[var(--ct-border-soft)]">
            Distribution coverage pending first attested mining period ·
            Indicative cadence (monthly, T+5) · Methodology v1.0 active
          </p>
        </LightPanel>
      </Section>

      {/* ── Strategy ── */}
      <Section
        id="sec-strategy"
        title="Strategy"
        provenance={<ProvenanceBadge kind="manual" />}
      >
        <LightPanel className="flex flex-col gap-4">
          <p className="body-md ct-text-body leading-relaxed">{vault.description}</p>
          <p className="body-sm ct-text-muted">
            Principal held in a USDC cash reserve — not deployed on-chain; yield
            is a monthly mining-revenue-share distribution.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="brand">Mining-backed</Badge>
            <Badge variant="default">Rule-based rebalancing</Badge>
            <Badge variant="default">Monthly USDC distributions</Badge>
          </div>
          <p className="body-sm ct-text-muted pt-2 border-t border-[var(--ct-border-soft)]">
            Projections follow Methodology{" "}
            <span className="mono">v1.0</span> — weighted buckets with ±10–30%
            assumption risk factors. APY is always shown as a range, never a
            point estimate. Immutable once published; changes require a version
            bump and ADR.
          </p>
        </LightPanel>
      </Section>

      {/* ── Allocation policy — compact ── */}
      <Section id="sec-alloc" title="Allocation policy">
        <div className="grid gap-px rounded-lg border border-[var(--ct-border-soft)] overflow-hidden md:grid-cols-2">
          {allocRows.map((row) => (
            <div
              key={row.label}
              className="ct-surface-1 px-4 py-3 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="body-sm font-semibold ct-text-primary">
                  {row.label}
                </span>
                <span className="tabular mono text-sm font-semibold ct-text-strong">
                  {(row.bps / 100).toFixed(0)}%
                </span>
              </div>
              <p className="body-xs ct-text-muted">{row.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Legal & risk — secondary, compact ── */}
      <Section
        id="sec-legal"
        title="Legal & risk"
        provenance={<ProvenanceBadge kind="manual" />}
        className="opacity-95"
      >
        <LightPanel className="py-3 px-4">
          <DetailRow
            label="SPV structure"
            value={SPV_LABELS[vault.spvJurisdiction] ?? vault.spvJurisdiction}
          />
          <DetailRow label="Share class" value={`Class ${vault.shareClass}`} />
          <DetailRow
            label="Regulatory exemption"
            value={REG_LABELS[vault.regExemption] ?? vault.regExemption}
          />
          <DetailRow
            label="Custodian"
            value="Custody configuration pending"
          />
          <DetailRow
            label="Multisig threshold"
            value="Multisig approval required"
          />
          <DetailRow label="Audit" value="Spearbit · scheduled" />
        </LightPanel>
      </Section>

      {/* ── Disclaimers — sober, not a premium card ── */}
      <Section id="sec-disclaimers" title="Disclaimers">
        <div role="note" aria-label="Important disclaimers" className="max-w-3xl">
          <p className="body-sm ct-text-muted leading-relaxed">{vault.disclaimers}</p>
          <p className="body-xs ct-text-faint mt-3 leading-relaxed">
            APY ranges are not a projection of returns. Past performance does not
            indicate future results. Allocations shown are targets and may deviate.
            This document is informational only and does not constitute an offer
            or solicitation where prohibited by law.
          </p>
        </div>
      </Section>
    </div>
  );
}
