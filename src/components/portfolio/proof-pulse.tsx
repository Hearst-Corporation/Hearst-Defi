
import Link from "next/link";

import { NestedPanel, ProofRow } from "@/components/ui/nested-panel";
import {
  PanelStatus,
  PfCockpitPanel,
  PfCockpitPanelHeader,
  PfCockpitSubhead,
} from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { resolveWidgetView } from "@/lib/portfolio/view-state";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProofPulseProps {
  lastPor: {
    timestamp: Date;
    statedTvlUsdc: number;
    onChainTvlUsdc: number;
  };
  methodologyVersion: string; // e.g. "v1.0"
  methodologyLocked: boolean;
  nextAttestation: Date | null;
  auditor: string;
  proofCenterHref?: string; // defaults to "/proof-center"
  /** Provenance metadata from the loader. */
  source?: "live" | "stale" | "attested";
  updatedAt?: Date;
  /** Attestation state from the loader. */
  proofState?: "attested" | "stale";
  /** Render PoR shell at $0 (layout preview). */
  previewZeros?: boolean;
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/** Absolute delta between stated and on-chain TVL as a percentage. */
export function computeDeltaPct(
  statedTvlUsdc: number,
  onChainTvlUsdc: number,
): number {
  if (statedTvlUsdc === 0) return 0;
  return (Math.abs(statedTvlUsdc - onChainTvlUsdc) / statedTvlUsdc) * 100;
}

/** Whether the PoR passes the match threshold (delta < 0.5%). */
export function isMatch(deltaPct: number): boolean {
  return deltaPct < 0.5;
}

type DeltaLevel = "green" | "orange" | "red";

export function deltaLevel(deltaPct: number): DeltaLevel {
  if (deltaPct < 0.5) return "green";
  if (deltaPct < 2) return "orange";
  return "red";
}

/**
 * Attestation state derived from raw PoR figures.
 *
 * - "none": both stated and on-chain TVL are 0 → no attestation has happened
 *   yet. We must NOT show ✓ here; that would be a false positive on missing
 *   data.
 * - "pending": stated > 0 but on-chain still 0 → on-chain confirmation has not
 *   landed yet, surface a warning.
 * - "matched" / "mismatch": both > 0, fall back to the delta threshold.
 */
export type AttestationState = "none" | "pending" | "matched" | "mismatch";

export function attestationState(
  statedTvlUsdc: number,
  onChainTvlUsdc: number,
): AttestationState {
  if (statedTvlUsdc === 0 && onChainTvlUsdc === 0) return "none";
  if (statedTvlUsdc > 0 && onChainTvlUsdc === 0) return "pending";
  const delta = computeDeltaPct(statedTvlUsdc, onChainTvlUsdc);
  return isMatch(delta) ? "matched" : "mismatch";
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatDateHuman(date: Date): string {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatTimeUtc(date: Date): string {
  return date
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    })
    .concat(" UTC");
}

export function formatIso(date: Date): string {
  return date.toISOString();
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Main component ────────────────────────────────────────────────────────────

export function ProofPulse({
  lastPor,
  methodologyVersion,
  methodologyLocked,
  nextAttestation,
  auditor,
  proofCenterHref = "/proof-center",
  source: _source = "live",
  updatedAt: _updatedAt,
  proofState,
  previewZeros = false,
}: ProofPulseProps) {
  const { timestamp, statedTvlUsdc, onChainTvlUsdc } = lastPor;

  const derivedState = attestationState(statedTvlUsdc, onChainTvlUsdc);
  const state =
    proofState === "attested" ? "attested" : derivedState;
  const hasData = state === "matched" || state === "mismatch" || state === "attested";
  // Methodology section is shown only when it carries a real value — a bare
  // "— / Not scheduled / (no auditor)" is not data worth a panel.
  const hasMethodologyData =
    Boolean(methodologyVersion) || nextAttestation !== null || Boolean(auditor);
  const deltaPct = hasData ? computeDeltaPct(statedTvlUsdc, onChainTvlUsdc) : 0;
  const level = hasData ? deltaLevel(deltaPct) : null;

  const deltaColorClass = cn({
    "ct-status-success": level === "green",
    "ct-status-warning": level === "orange",
    "ct-status-danger": level === "red",
    "ct-text-faint": level === null,
  });

  // Indicator after On-chain figure: ✓ only when both figures > 0 and match.
  // For "none" (no attestation) and "pending" (on-chain missing) we render a
  // neutral/warning glyph — never ✓.
  const indicator: { glyph: string; label: string; colorClass: string } | null =
    state === "matched" || state === "attested"
      ? {
          glyph: "✓",
          label: "On-chain TVL matches stated TVL",
          colorClass: "ct-status-success",
        }
      : state === "mismatch"
        ? {
            glyph: "✗",
            label: "On-chain TVL mismatch detected",
            colorClass: "ct-status-danger",
          }
        : state === "pending"
          ? {
              glyph: "…",
              label: "On-chain confirmation pending",
              colorClass: "ct-status-warning",
            }
          : null; // "none" — no glyph at all

  const view = resolveWidgetView({
    previewZeros,
    hasData: hasData || hasMethodologyData,
    provenance: state === "matched" || state === "attested" ? "attested" : "stale",
  });

  return (
    <PfCockpitPanel variant="compact" aria-label="Proof and methodology">
      <PfCockpitPanelHeader
        title="Proof & methodology"
        provenance={view.provenance}
      />

      {/* ── Last PoR block — only when an attestation actually exists ──────────
          With no attestation we show a flat status stack instead of placeholder
          rows that fake an active widget. */}
      {hasData ? (
        <section aria-label="Last Proof of Reserves">
          <PfCockpitSubhead
            className="mb-[var(--ct-space-2)]"
            title="Last PoR"
            meta={
              <time dateTime={formatIso(timestamp)}>
                {formatDateHuman(timestamp)} · {formatTimeUtc(timestamp)}
              </time>
            }
          />

          <NestedPanel>
            <ProofRow label="Vault TVL">{formatUsdCompact(statedTvlUsdc)}</ProofRow>

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
        </section>
      ) : (
        <PanelStatus
          message={
            state === "pending"
              ? "On-chain proof is being reconciled."
              : "No vault attestation yet."
          }
          detail={
            state === "pending"
              ? "Vault TVL is available, but the on-chain confirmation has not landed."
              : "PoR publish appears here once vault TVL is attested on-chain."
          }
        />
      )}

      {/* ── Methodology block — only when it carries at least one real value ──
          A bare "— + Manual" is not data; we omit the whole section rather than
          render an empty-looking methodology. */}
      {hasMethodologyData && (
        <section aria-label="Methodology" className="ct-panel-status-section">
          <PfCockpitSubhead title="Methodology" />

          <div className="ct-panel-fields">
            {methodologyVersion ? (
              <ProofRow label="Version">
                <span className="pf-proof-row__stack">
                  <span className="ct-text-primary">{methodologyVersion}</span>
                  <span className="pf-proof-row__meta body-xs ct-text-faint">
                    {hasData ? "Methodology attested" : "Methodology published"}
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
        </section>
      )}

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <div className="mt-auto pt-[var(--ct-space-3)] flex justify-end">
        <Link
          href={proofCenterHref}
          className="body-xs ct-text-muted hover:ct-text-primary transition-colors underline underline-offset-2 decoration-[var(--ct-border)]"
          aria-label="Open proof center"
        >
          Open proof center
        </Link>
      </div>
    </PfCockpitPanel>
  );
}
