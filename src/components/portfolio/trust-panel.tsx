import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import {
  PfCockpitPanel,
} from "@/components/portfolio/pf-cockpit-panel";
import type { Provenance } from "@/components/ui/provenance-badge";
import {
  compositeLabelColor,
  type RiskPulseProps,
} from "@/components/portfolio/risk-pulse";
import {
  attestationState,
  computeDeltaPct,
  type ProofPulseProps,
} from "@/components/portfolio/proof-pulse";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";

export interface TrustPanelProps {
  risk: RiskPulseProps;
  proof: ProofPulseProps;
  /** Hub-only link to the focused leaf page. */
  leafHref?: string;
  embedded?: boolean;
}

export interface TrustSummaryKpis {
  compositeValue: string;
  compositeMeta: string;
  compositeValueClass: string;
  proofValue: string;
  proofMeta: string;
  proofValueClass: string;
  headerProvenance: Provenance | undefined;
}

export function deriveTrustSummaryKpis({
  risk,
  proof,
}: TrustPanelProps): TrustSummaryKpis {
  const {
    scores,
    composite,
    compositeLabel,
    source: riskSource = "live",
    updatedAt: riskUpdatedAt,
  } = risk;

  const riskNoData =
    compositeLabel === undefined &&
    composite === 0 &&
    scores.every((s) => s.score === 0);
  const dimensionsAvailable = scores.some((s) => s.score > 0);
  const compositeUnavailable = riskNoData || !dimensionsAvailable;

  const { lastPor, proofState } = proof;
  const { statedTvlUsdc, onChainTvlUsdc } = lastPor;
  const derivedProofState = attestationState(statedTvlUsdc, onChainTvlUsdc);
  const proofResolved =
    proofState === "attested" ? "attested" : derivedProofState;
  const proofHasData =
    proofResolved === "matched" ||
    proofResolved === "mismatch" ||
    proofResolved === "attested";
  const deltaPct = proofHasData
    ? computeDeltaPct(statedTvlUsdc, onChainTvlUsdc)
    : 0;

  const showRiskBadge = !compositeUnavailable;
  const headerProvenance: Provenance | undefined = showRiskBadge
    ? resolveProvenance(
        riskSource === "stale" ? "stale" : riskSource,
        riskUpdatedAt,
        "estimated",
      )
    : proofResolved === "matched" || proofResolved === "attested"
      ? "attested"
      : proofResolved === "mismatch" || proofResolved === "pending"
        ? "stale"
        : undefined;

  let proofValue = "—";
  let proofMeta = "Awaiting attestation";
  let proofValueClass = "ct-text-tertiary";

  if (compositeUnavailable) {
    proofValue = "—";
    proofMeta = "Position pending";
    proofValueClass = "ct-text-tertiary";
  } else if (proofResolved === "matched" || proofResolved === "attested") {
    proofValue = "Verified";
    proofMeta = proofHasData ? `Delta ${deltaPct.toFixed(2)}%` : "On-chain match";
    proofValueClass = "ct-status-success";
  } else if (proofResolved === "mismatch") {
    proofValue = "Mismatch";
    proofMeta = proofHasData ? `Delta ${deltaPct.toFixed(2)}%` : "Review required";
    proofValueClass = "ct-status-danger";
  } else if (proofResolved === "pending") {
    proofValue = "Pending";
    proofMeta = "On-chain confirmation";
    proofValueClass = "ct-status-warning";
  }

  return {
    compositeValue: compositeUnavailable ? "—" : String(composite),
    compositeMeta: compositeUnavailable
      ? "Snapshot pending"
      : (compositeLabel ?? "Composite score"),
    compositeValueClass: compositeUnavailable
      ? "ct-text-tertiary"
      : compositeLabel
        ? compositeLabelColor(compositeLabel)
        : "ct-text-primary",
    proofValue,
    proofMeta,
    proofValueClass,
    headerProvenance,
  };
}

function trustHeaderTrailing(leafHref?: string) {
  if (leafHref) {
    return <PortfolioLeafLink href={leafHref} />;
  }
  return <PortfolioLeafLink href="/proof-center" label="Proof center" />;
}

export function TrustProofCompact({
  leafHref,
  embedded = false,
  ...props
}: TrustPanelProps) {
  const kpis = deriveTrustSummaryKpis(props);

  return (
    <PfCockpitPanel
      variant="compact"
      chrome={embedded ? "embedded" : "panel"}
      aria-label="Trust and proof summary"
      className={cn("pf-trust-compact", !embedded && "h-full", embedded && "pf-trust-compact--embedded")}
    >
      <DashboardPanelHeader
        title="Trust & Proof"
        tone="primary"
        provenance={kpis.headerProvenance}
        trailing={trustHeaderTrailing(leafHref)}
      />

      <dl className="pf-trust-compact-kpis">
        <div className="pf-trust-compact-kpi">
          <dt className="stat-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Risk composite
          </dt>
          {kpis.compositeValue !== "—" ? (
            <dd className={cn("pf-trust-compact-kpi__value tabular", kpis.compositeValueClass)}>
              {kpis.compositeValue}
            </dd>
          ) : null}
          <dd className="body-xs ct-text-muted m-0">{kpis.compositeMeta}</dd>
        </div>

        <div className="pf-trust-compact-kpi">
          <dt className="stat-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Proof status
          </dt>
          {kpis.proofValue !== "—" ? (
            <dd className={cn("pf-trust-compact-kpi__value tabular", kpis.proofValueClass)}>
              {kpis.proofValue}
            </dd>
          ) : null}
          <dd className="body-xs ct-text-muted m-0">{kpis.proofMeta}</dd>
        </div>
      </dl>
    </PfCockpitPanel>
  );
}
