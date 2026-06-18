import Link from "next/link";

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { PortfolioLeafLink } from "@/components/portfolio/portfolio-leaf-link";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrustPanelProps {
  risk: RiskPulseProps;
  proof: ProofPulseProps;
  /** Render the full Trust shell at zero (layout preview). */
  previewZeros?: boolean;
  /** Hub-only link to the focused leaf page. */
  leafHref?: string;
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

/** Compact trust strip — risk composite + proof status for the portfolio sidebar. */
export function deriveTrustSummaryKpis({
  risk,
  proof,
  previewZeros = false,
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
  const compositeUnavailable = previewZeros || riskNoData || !dimensionsAvailable;

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
  const headerProvenance: Provenance | undefined = previewZeros
    ? undefined
    : showRiskBadge
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
  let proofMeta = previewZeros ? "Preview" : "Awaiting attestation";
  let proofValueClass = "ct-text-faint";

  if (proofResolved === "matched" || proofResolved === "attested") {
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
      ? "ct-text-faint"
      : compositeLabel
        ? compositeLabelColor(compositeLabel)
        : "ct-text-primary",
    proofValue,
    proofMeta,
    proofValueClass,
    headerProvenance,
  };
}

/** Sidebar trust summary — KPI headers only; full detail on leaf when linked. */
export function TrustProofCompact({
  leafHref,
  ...props
}: TrustPanelProps) {
  const { previewZeros = false } = props;
  const kpis = deriveTrustSummaryKpis(props);

  if (previewZeros) {
    return (
      <PfCockpitPanel
        variant="compact"
        aria-label="Trust and proof summary"
        className="pf-trust-compact"
      >
        <PfCockpitPanelHeader title="Trust & proof" />
        <div className="pf-trust-compact__zero-body">
          <span className="pf-trust-compact__status stat-label ct-text-muted">
            <span
              className="pf-status-dot pf-status-dot--active pf-trust-compact__status-dot"
              aria-hidden
            />
            Proof system active
          </span>
          <p className="body-xs ct-text-faint m-0">
            On-chain attestation and risk snapshots will appear here once a position is confirmed.
          </p>
        </div>
        <Link href="/proof-center" className="pf-trust-compact__see-more">
          Open proof center →
        </Link>
      </PfCockpitPanel>
    );
  }

  return (
    <PfCockpitPanel
      variant="compact"
      aria-label="Trust and proof summary"
      className="pf-trust-compact"
    >
      <PfCockpitPanelHeader
        title="Trust & proof"
        provenance={kpis.headerProvenance}
      />

      <dl className="pf-trust-compact-kpis">
        <div className="pf-trust-compact-kpi">
          <dt className="stat-label">Risk composite</dt>
          <dd className={cn("pf-trust-compact-kpi__value tabular-nums", kpis.compositeValueClass)}>
            {kpis.compositeValue}
          </dd>
          <dd className="body-xs ct-text-muted m-0">{kpis.compositeMeta}</dd>
        </div>

        <div className="pf-trust-compact-kpi">
          <dt className="stat-label">Proof status</dt>
          <dd className={cn("pf-trust-compact-kpi__value", kpis.proofValueClass)}>
            {kpis.proofValue}
          </dd>
          <dd className="body-xs ct-text-muted m-0">{kpis.proofMeta}</dd>
        </div>
      </dl>

      {leafHref ? (
        <PortfolioLeafLink
          href={leafHref}
          className="pf-trust-compact__see-more"
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled
          className="pf-trust-compact__see-more"
          aria-label="Full trust detail — coming soon"
          title="Detailed trust view coming soon"
        >
          See more
        </Button>
      )}
    </PfCockpitPanel>
  );
}
