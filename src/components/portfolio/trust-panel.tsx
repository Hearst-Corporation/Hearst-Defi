import Link from "next/link";

import { NestedPanel, ProofRow } from "@/components/ui/nested-panel";
import {
  PanelStatus,
  PfCockpitPanel,
  PfCockpitPanelHeader,
  PfCockpitSubhead,
} from "@/components/portfolio/pf-cockpit-panel";
import type { Provenance } from "@/components/ui/provenance-badge";
import {
  CompositeSection,
  ScoreRow,
  type RiskPulseProps,
} from "@/components/portfolio/risk-pulse";
import {
  attestationState,
  computeDeltaPct,
  deltaLevel,
  formatDateHuman,
  formatIso,
  formatTimeUtc,
  type ProofPulseProps,
} from "@/components/portfolio/proof-pulse";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveProvenance } from "@/lib/portfolio/provenance";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrustPanelProps {
  risk: RiskPulseProps;
  proof: ProofPulseProps;
  /** Render the full Trust shell at zero (layout preview). */
  previewZeros?: boolean;
}

// ── Security audit (3-row checklist — no live feed yet) ───────────────────────

const AUDIT_ROWS = [
  { label: "Smart contract audit", status: "Pending" },
  { label: "Key custody posture", status: "Pending" },
  { label: "Operational controls", status: "Pending" },
] as const;

// ── Main component ────────────────────────────────────────────────────────────

export function TrustPanel({ risk, proof, previewZeros = false }: TrustPanelProps) {
  // ── Risk pulse logic (mirrors RiskPulse) ────────────────────────────────────
  const {
    scores,
    composite,
    compositeLabel,
    composite30dTrend,
    source: riskSource = "live",
    updatedAt: riskUpdatedAt,
  } = risk;

  const riskNoData =
    compositeLabel === undefined &&
    composite === 0 &&
    scores.every((s) => s.score === 0);
  const dimensionsAvailable = scores.some((s) => s.score > 0);
  const compositeUnavailable = previewZeros || riskNoData || !dimensionsAvailable;

  // ── Proof & methodology logic (mirrors ProofPulse) ──────────────────────────
  const {
    lastPor,
    methodologyVersion,
    methodologyLocked,
    nextAttestation,
    auditor,
    proofCenterHref = "/proof-center",
    proofState,
  } = proof;
  const { timestamp, statedTvlUsdc, onChainTvlUsdc } = lastPor;

  const derivedProofState = attestationState(statedTvlUsdc, onChainTvlUsdc);
  const proofResolved =
    proofState === "attested" ? "attested" : derivedProofState;
  const proofHasData =
    proofResolved === "matched" ||
    proofResolved === "mismatch" ||
    proofResolved === "attested";
  const hasMethodologyData =
    Boolean(methodologyVersion) || nextAttestation !== null || Boolean(auditor);
  const deltaPct = proofHasData
    ? computeDeltaPct(statedTvlUsdc, onChainTvlUsdc)
    : 0;
  const level = proofHasData ? deltaLevel(deltaPct) : null;

  const deltaColorClass = cn({
    "ct-status-success": level === "green",
    "ct-status-warning": level === "orange",
    "ct-status-danger": level === "red",
    "ct-text-faint": level === null,
  });

  const indicator: { glyph: string; label: string; colorClass: string } | null =
    proofResolved === "matched" || proofResolved === "attested"
      ? {
          glyph: "✓",
          label: "On-chain TVL matches stated TVL",
          colorClass: "ct-status-success",
        }
      : proofResolved === "mismatch"
        ? {
            glyph: "✗",
            label: "On-chain TVL mismatch detected",
            colorClass: "ct-status-danger",
          }
        : proofResolved === "pending"
          ? {
              glyph: "…",
              label: "On-chain confirmation pending",
              colorClass: "ct-status-warning",
            }
          : null; // "none" — no glyph at all

  // ── Header provenance — strongest relevant signal ───────────────────────────
  // Lead with the risk snapshot provenance (the densest, primary subsection);
  // fall back to a stale badge when the risk shell is empty but proof carries
  // an attestation. Hidden entirely in preview.
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

  return (
    <PfCockpitPanel variant="wide" aria-label="Trust & proof">
      <PfCockpitPanelHeader title="Trust & proof" provenance={headerProvenance} />

      <div className="pf-trust-grid">
      {/* ── 1. Risk pulse ───────────────────────────────────────────────────── */}
      <section className="pf-trust-section" aria-label="Risk pulse">
        <PfCockpitSubhead
          title={
            <Tooltip content="Composite risk score based on market, mining, liquidity, smart contract, and counterparty risks">
              <span className="cursor-help border-b border-dotted border-[var(--ct-border-soft)]">
                Risk pulse
              </span>
            </Tooltip>
          }
        />

        {compositeUnavailable ? (
          <PanelStatus
            message="Snapshot pending"
            detail="Risk scores populate after the first snapshot."
          />
        ) : null}

        <ul aria-label="Risk dimension scores">
          {scores.map((item) => (
            <ScoreRow
              key={item.dimension}
              item={item}
              unavailable={compositeUnavailable}
            />
          ))}
        </ul>

        <CompositeSection
          composite={composite}
          compositeLabel={compositeLabel}
          trend={composite30dTrend}
          noData={compositeUnavailable}
        />

        {!compositeUnavailable ? (
          <p className="body-xs ct-text-faint m-0">
            0–100 scale · conditional — not guaranteed
          </p>
        ) : null}
      </section>

      {/* ── 2. Proof & methodology ──────────────────────────────────────────── */}
      <section className="pf-trust-section" aria-label="Proof and methodology">
        <PfCockpitSubhead title="Proof &amp; methodology" />

        {/* Last PoR block — only when an attestation actually exists. */}
        {proofHasData ? (
          <div aria-label="Last Proof of Reserves" className="ct-panel-status-section">
            <PfCockpitSubhead
              title="Last PoR"
              meta={
                <time dateTime={formatIso(timestamp)}>
                  {formatDateHuman(timestamp)} · {formatTimeUtc(timestamp)}
                </time>
              }
            />

            <NestedPanel>
              <ProofRow label="Vault TVL">
                {formatUsdCompact(statedTvlUsdc)}
              </ProofRow>

              <ProofRow label="On-chain">
                <span className="pf-proof-row__stack">
                  <span>{formatUsdCompact(onChainTvlUsdc)}</span>
                  {indicator !== null ? (
                    <span
                      role="status"
                      aria-label={indicator.label}
                      className={cn(
                        "pf-proof-row__meta body-xs leading-tight select-none",
                        indicator.colorClass,
                      )}
                    >
                      {indicator.glyph}
                    </span>
                  ) : null}
                </span>
              </ProofRow>

              <ProofRow label="Delta">
                <span className={deltaColorClass}>
                  {deltaPct === 0 ? "0.00" : deltaPct.toFixed(2)}%
                </span>
              </ProofRow>
            </NestedPanel>
          </div>
        ) : (
          <PanelStatus
            message={
              proofResolved === "pending"
                ? "On-chain proof is being reconciled."
                : "No vault attestation yet."
            }
            detail={
              proofResolved === "pending"
                ? "Vault TVL is available, but the on-chain confirmation has not landed."
                : "PoR publish appears here once vault TVL is attested on-chain."
            }
          />
        )}

        {/* Methodology block — only when it carries at least one real value. */}
        {hasMethodologyData ? (
          <div aria-label="Methodology" className="ct-panel-status-section">
            <PfCockpitSubhead title="Methodology" />

            <div className="ct-panel-fields">
              {methodologyVersion ? (
                <ProofRow label="Version">
                  <span className="pf-proof-row__stack">
                    <span className="ct-text-primary">{methodologyVersion}</span>
                    <span className="pf-proof-row__meta body-xs ct-text-faint">
                      {proofHasData ? "Methodology attested" : "Methodology published"}
                      {methodologyLocked ? (
                        <span
                          className="uppercase ct-tracking-wide"
                          aria-label="Methodology is locked"
                        >
                          {" "}
                          · LOCKED
                        </span>
                      ) : null}
                    </span>
                  </span>
                </ProofRow>
              ) : null}

              {nextAttestation !== null ? (
                <ProofRow label="Next attest">
                  <time
                    dateTime={formatIso(nextAttestation)}
                    className="pf-proof-row__datetime"
                  >
                    {formatDateHuman(nextAttestation)} ·{" "}
                    {formatTimeUtc(nextAttestation)}
                  </time>
                </ProofRow>
              ) : null}

              {auditor ? (
                <ProofRow label="Auditor">
                  <span className="pf-proof-row__truncate">{auditor}</span>
                </ProofRow>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="pt-[var(--ct-space-2)] flex justify-end">
          <Link
            href={proofCenterHref}
            className="body-xs ct-text-muted hover:ct-text-primary transition-colors underline underline-offset-2 decoration-[var(--ct-border)]"
            aria-label="Open proof center"
          >
            Open proof center
          </Link>
        </div>
      </section>

      {/* ── 3. Security audit ───────────────────────────────────────────────── */}
      <section className="pf-trust-section" aria-label="Security audit">
        <PfCockpitSubhead title="Security audit" />

        <ul className="pf-checklist-list" aria-label="Security audit checklist">
          {AUDIT_ROWS.map((row) => (
            <li key={row.label} className="pf-checklist-row">
              <span className="body-sm ct-text-muted">{row.label}</span>
              <span className="pf-checklist-row__status body-xs ct-text-muted">
                <span
                  className="pf-status-dot pf-status-dot--default opacity-[var(--ct-opacity-50)]"
                  aria-hidden
                />
                {row.status}
              </span>
            </li>
          ))}
        </ul>

        {!previewZeros ? (
          <p className="body-xs ct-text-faint m-0">
            Live status after account verification.
          </p>
        ) : null}
      </section>
      </div>
    </PfCockpitPanel>
  );
}
