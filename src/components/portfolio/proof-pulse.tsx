import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { NestedCallout, NestedPanel, ProofRow } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { ModuleChrome } from "@/components/ui/module-chrome";
import { WidgetPanelHeader } from "@/components/ui/widget-panel-header";
import { cn } from "@/lib/cn";

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

function formatUsdc(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1,
    notation: "compact",
    compactDisplay: "short",
  }).format(amount);
}

function formatDateHuman(date: Date): string {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatTimeUtc(date: Date): string {
  return date
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    })
    .concat(" UTC");
}

function formatIso(date: Date): string {
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

  // `attested` only when on-chain figures actually match; preview tier stays stale.
  const headerProvenance: "attested" | "stale" =
    previewZeros || !(state === "matched" || state === "attested")
      ? "stale"
      : "attested";

  // Nothing real to show (no attestation AND no methodology) → render a LIGHT
  // empty surface instead of a full dash-cell-premium with header + Stale badge
  // + nested callout, which reads as a big black placeholder box. The outer
  // section already labels this slot "Proof of reserves".
  if (!hasData && !hasMethodologyData && !previewZeros) {
    return (
      <AwaitingMetricState
        message="No attestation has been published yet."
        detail="The first proof will appear here once vault activity is attested."
        link={{
          label: "Open proof center",
          href: proofCenterHref,
          ariaLabel: "Open proof center",
        }}
      />
    );
  }

  return (
    <ModuleChrome aria-label="Proof and methodology">
      <WidgetPanelHeader
        title="Proof & methodology"
        provenance={headerProvenance}
      />

      {/* ── Last PoR block — only when an attestation actually exists ──────────
          With no attestation we show a single calm callout instead of a grid of
          "Awaiting proof / Awaiting record / no attestation yet" placeholder
          rows that fake an active widget. */}
      {hasData ? (
        <section aria-label="Last Proof of Reserves" className="relative z-10">
          <h3 className="h3 mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            Last PoR
            <time
              dateTime={formatIso(timestamp)}
              className="body-xs ct-text-faint font-normal"
            >
              {formatDateHuman(timestamp)} · {formatTimeUtc(timestamp)}
            </time>
          </h3>

          <NestedPanel>
            <ProofRow label="Vault TVL">{formatUsdc(statedTvlUsdc)}</ProofRow>

            <ProofRow label="On-chain">
              <span className="inline-flex items-center justify-end gap-2">
                {formatUsdc(onChainTvlUsdc)}
                {indicator !== null ? (
                  <span
                    role="status"
                    aria-label={indicator.label}
                    className={cn(
                      "body-sm font-semibold leading-none select-none",
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
        <NestedCallout className="mt-4 relative z-10" role="status">
          <p className="body-sm ct-text-primary font-semibold">
            {state === "pending"
              ? "On-chain proof is being reconciled."
              : "No attestation has been published yet."}
          </p>
          <p className="body-xs ct-text-muted mt-1">
            {state === "pending"
              ? "Vault TVL is available, but the on-chain confirmation has not landed."
              : "The first proof will appear here once vault activity is attested."}
          </p>
        </NestedCallout>
      )}

      {/* ── Methodology block — only when it carries at least one real value ──
          A bare "— + Manual" is not data; we omit the whole section rather than
          render an empty-looking methodology. */}
      {hasMethodologyData && (
        <section aria-label="Methodology" className="mt-6 relative z-10">
          <h3 className="h3 mb-3">Methodology</h3>

          <NestedPanel>
            {methodologyVersion ? (
              <ProofRow label="Version">
                <span className="inline-flex items-center justify-end gap-2">
                  <span className="ct-text-primary">{methodologyVersion}</span>
                  <ProvenanceBadge kind="attested" />
                  {methodologyLocked && (
                    <Badge variant="default" aria-label="Methodology is locked">
                      locked
                    </Badge>
                  )}
                </span>
              </ProofRow>
            ) : null}

            {nextAttestation !== null ? (
              <ProofRow label="Next attest">
                <time dateTime={formatIso(nextAttestation)}>
                  {formatDateHuman(nextAttestation)} ·{" "}
                  {formatTimeUtc(nextAttestation)}
                </time>
              </ProofRow>
            ) : null}

            {auditor ? <ProofRow label="Auditor">{auditor}</ProofRow> : null}
          </NestedPanel>
        </section>
      )}

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <div className="mt-auto pt-6 flex justify-end relative z-10">
        <Link
          href={proofCenterHref}
          className="body-xs ct-text-muted hover:ct-text-primary transition-colors underline underline-offset-2 decoration-(--ct-border)"
          aria-label="Open proof center"
        >
          Open proof center
        </Link>
      </div>
    </ModuleChrome>
  );
}
