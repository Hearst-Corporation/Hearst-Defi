// Term sheet preview for /vaults/[id] — Step 2 of 4.
// Server Component. No I/O. Composed from locked DS primitives.
// APY via <ApyRange> (#1). Provenance grouped per section (#2) — not per row.
// Disclaimers section present (#10). No forbidden words (#5).

import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { DynamicAllocationCards } from "@/components/vaults/dynamic-allocation-cards";
import { cn } from "@/lib/cn";
import type { VaultProduct } from "@/lib/data/vaults";
import type { AllocationBucket } from "@/lib/engine/types";
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

/** Web UI bucket accents — same mapping as `allocation-colors.ts` / portfolio donut. */
const ALLOCATION_BUCKET_CLASS: Record<
  AllocationBucket,
  { border: string; value: string; dot: string }
> = {
  mining: {
    border: "border-l-[var(--ct-text-primary)]",
    value: "ct-text-primary",
    dot: "dot-primary",
  },
  btc_tactical: {
    border: "border-l-[var(--ct-accent-strong)]",
    value: "ct-text-accent",
    dot: "dot-accent",
  },
  usdc_base: {
    border: "border-l-[var(--ct-status-info)]",
    value: "ct-status-info",
    dot: "dot-soft",
  },
  stable_reserve: {
    border: "border-l-[var(--ct-status-warning)]",
    value: "ct-status-warning",
    dot: "dot-muted",
  },
};

const ALLOCATION_ROWS = (vault: VaultProduct) =>
  [
    {
      bucket: "mining" as const,
      label: "Bitcoin Mining Operations",
      bps: vault.targetMiningBps,
      description:
        "Directly deployed hashrate — revenue share from partner mining facilities.",
    },
    {
      bucket: "btc_tactical" as const,
      label: "BTC Tactical Delta",
      bps: vault.targetBtcTacticalBps,
      description:
        "Spot BTC exposure for directional upside within a realised-volatility guardrail.",
    },
    {
      bucket: "usdc_base" as const,
      label: "USDC Base Lending",
      bps: vault.targetUsdcBaseBps,
      description: "T-bills + on-chain lending weighted average.",
    },
    {
      bucket: "stable_reserve" as const,
      label: "Stable Reserve",
      bps: vault.targetStableReserveBps,
      description: "USDC yield buffer for soft lock-up and redemption queue.",
    },
  ] as const;

interface SectionProps {
  id: string;
  title: string;
  provenance?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function Section({ id, title, provenance, children, className }: SectionProps) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-3", className)}>
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
        "rounded-lg border border-[var(--ct-border-soft)] ct-surface-1 p-4",
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
      <span className="h4 tabular mono ct-text-strong">{value}</span>
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
    <div className="flex flex-col gap-6">
      {/* ── At a glance — 6 headline metrics, one provenance line ── */}
      <Section
        id="sec-glance"
        title="At a glance"
        provenance={
          <div className="body-xs ct-text-faint flex flex-wrap items-center gap-1.5">
            <span>Metrics:</span>
            <ProvenanceBadge kind="estimated" />
            <ProvenanceBadge kind="manual" />
            {vault.currentAumUsdc > 0 ? <ProvenanceBadge kind={aumProvenance} /> : null}
          </div>
        }
      >
        <LightPanel>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid gap-3 md:grid-cols-2">
          {allocRows.map((row) => {
            const tone = ALLOCATION_BUCKET_CLASS[row.bucket];
            return (
              <div
                key={row.label}
                className={cn(
                  "glass-panel-subtle flex flex-col gap-1 border-l-[3px] px-4 py-3",
                  tone.border,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={cn("dash-legend-dot shrink-0", tone.dot)}
                    />
                    <span className="body-sm font-semibold ct-text-primary truncate">
                      {row.label}
                    </span>
                  </span>
                  <span className={cn("h4 tabular mono shrink-0", tone.value)}>
                    {(row.bps / 100).toFixed(0)}%
                  </span>
                </div>
                <p className="body-xs ct-text-muted">{row.description}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Market regimes — follows allocation targets in the same document ── */}
      <Section
        id="sec-regimes"
        title="Market regimes"
        provenance={
          <div className="body-xs ct-text-faint flex items-center gap-1.5">
            <span>Scenarios:</span>
            <ProvenanceBadge kind="estimated" />
          </div>
        }
      >
        <p className="body-sm ct-text-muted max-w-2xl">
          Target postures under Bull, Sideways, and Bear scenarios from
          Methodology v1.0. APY ranges are conditional — not a projection.
        </p>
        <DynamicAllocationCards />
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
    </div>
  );
}
