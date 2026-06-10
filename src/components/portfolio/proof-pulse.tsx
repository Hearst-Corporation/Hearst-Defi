import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
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

interface DataRowProps {
  label: string;
  children: React.ReactNode;
}

function DataRow({ label, children }: DataRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-[var(--ct-border-soft)] last:border-0">
      <span className="body-xs ct-text-muted shrink-0">{label}</span>
      <span className="body-sm mono tabular-nums ct-text-primary text-right min-w-0 break-words">
        {children}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProofPulse({
  lastPor,
  methodologyVersion,
  methodologyLocked,
  nextAttestation,
  auditor,
  proofCenterHref = "/proof-center",
}: ProofPulseProps) {
  const { timestamp, statedTvlUsdc, onChainTvlUsdc } = lastPor;

  const state = attestationState(statedTvlUsdc, onChainTvlUsdc);
  const hasData = state === "matched" || state === "mismatch";
  const deltaPct = hasData ? computeDeltaPct(statedTvlUsdc, onChainTvlUsdc) : 0;
  const level = hasData ? deltaLevel(deltaPct) : null;

  const deltaColorClass = cn({
    "text-[var(--ct-status-success)]": level === "green",
    "text-[var(--ct-status-warning)]": level === "orange",
    "text-[var(--ct-status-danger)]": level === "red",
    "text-[var(--ct-text-faint)]": level === null,
  });

  // Indicator after On-chain figure: ✓ only when both figures > 0 and match.
  // For "none" (no attestation) and "pending" (on-chain missing) we render a
  // neutral/warning glyph — never ✓.
  const indicator: { glyph: string; label: string; colorClass: string } | null =
    state === "matched"
      ? {
          glyph: "✓",
          label: "On-chain TVL matches stated TVL",
          colorClass: "text-[var(--ct-status-success)]",
        }
      : state === "mismatch"
        ? {
            glyph: "✗",
            label: "On-chain TVL mismatch detected",
            colorClass: "text-[var(--ct-status-danger)]",
          }
        : state === "pending"
          ? {
              glyph: "…",
              label: "On-chain confirmation pending",
              colorClass: "text-[var(--ct-status-warning)]",
            }
          : null; // "none" — no glyph at all

  // `attested` only when on-chain figures actually match. "pending" (on-chain
  // not yet wired) and "none" must read `stale` — never claim attestation on an
  // unreconciled reserve.
  const headerProvenance: "attested" | "stale" =
    state === "matched" ? "attested" : "stale";

  return (
    <article className="dash-cell dash-cell-premium h-full flex flex-col">
      <div className="dash-label relative z-10">
        <span className="font-semibold text-[var(--ct-text-strong)]">Proof &amp; Methodology Pulse</span>
        <div className="flex items-center gap-2">
          {/* A2 — single provenance badge driven by the actual PoR match state.
              The previously hardcoded "Oracle" badge was not backed by any
              oracle feed and is removed. */}
          <ProvenanceBadge kind={headerProvenance} />
        </div>
      </div>

      {/* ── Last PoR block ─────────────────────────────────────────────────── */}
      <section aria-label="Last Proof of Reserves" className="relative z-10">
        <h4 className="body-xs font-semibold uppercase tracking-[var(--ct-tracking-wide)] text-[var(--ct-text-muted)] mb-3">
          Last PoR
          <time
            dateTime={formatIso(timestamp)}
            className="ml-2 font-normal normal-case tracking-normal text-[var(--ct-text-faint)]"
          >
            {formatDateHuman(timestamp)} · {formatTimeUtc(timestamp)}
          </time>
        </h4>

        <div className="rounded-[var(--ct-radius-lg)] bg-black/20 border border-[var(--ct-border-soft)] px-4 py-1">
          <DataRow label="Vault TVL">{formatUsdc(statedTvlUsdc)}</DataRow>

          <DataRow label="On-chain">
            <span className="flex items-center justify-end gap-2">
              {formatUsdc(onChainTvlUsdc)}
              {indicator !== null && (
                <span
                  role="status"
                  aria-label={indicator.label}
                  className={cn(
                    "text-[length:var(--ct-text-sm)] font-bold leading-none select-none",
                    indicator.colorClass,
                  )}
                >
                  {indicator.glyph}
                </span>
              )}
            </span>
          </DataRow>

          <DataRow label="Delta">
            {hasData ? (
              <span className={deltaColorClass}>
                {deltaPct === 0 ? "0.00" : deltaPct.toFixed(2)}%
              </span>
            ) : (
              <span className="text-[var(--ct-text-faint)] italic">
                {state === "pending"
                  ? "on-chain pending"
                  : "no attestation yet"}
              </span>
            )}
          </DataRow>
        </div>
      </section>

      {/* ── Methodology block ──────────────────────────────────────────────── */}
      <section aria-label="Methodology" className="mt-6 relative z-10">
        <h4 className="body-xs font-semibold uppercase tracking-[var(--ct-tracking-wide)] text-[var(--ct-text-muted)] mb-3">
          Methodology
        </h4>

        <div className="rounded-[var(--ct-radius-lg)] bg-black/20 border border-[var(--ct-border-soft)] px-4 py-1">
          <DataRow label="Version">
            <span className="flex items-center justify-end gap-2">
              <span className="text-[var(--ct-text-faint)]">{methodologyVersion}</span>
              {methodologyLocked && (
                <Badge variant="default" aria-label="Methodology is locked">
                  locked
                </Badge>
              )}
            </span>
          </DataRow>

          <DataRow label="Next attest">
            {nextAttestation !== null ? (
              <time dateTime={formatIso(nextAttestation)}>
                {formatDateHuman(nextAttestation)} ·{" "}
                {formatTimeUtc(nextAttestation)}
              </time>
            ) : (
              <span className="text-[var(--ct-text-faint)] italic">no scheduled</span>
            )}
          </DataRow>

          <DataRow label="Auditor">{auditor}</DataRow>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <div className="mt-auto pt-6 flex justify-end relative z-10">
        <Link
          href={proofCenterHref}
          className="body-xs text-[var(--ct-text-muted)] hover:text-[var(--ct-text-primary)] transition-colors underline underline-offset-2 decoration-[var(--ct-border)]"
          aria-label="Open proof center"
        >
          open proof center →
        </Link>
      </div>
    </article>
  );
}
