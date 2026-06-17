"use client";

/**
 * TimelockCountdown — live countdown widget for a governance proposal in TIMELOCK state.
 *
 * Displays "Proposal #<id> — Executable in HH h MM m SS s" with a Cockpit
 * progress bar and a "Live" provenance badge. When the countdown reaches zero
 * the bar fills fully and an "Executable" badge replaces the time display.
 *
 * Props:
 *   proposalId    — short display id (e.g. "42")
 *   queueTime     — ISO string of when the proposal entered TIMELOCK (queuedAt)
 *   delayHours    — total timelock duration in hours
 */

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { NestedPanel } from "@/components/ui/nested-panel";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Remaining milliseconds between now and etaMs, clamped to [0, ∞). */
function remainingMs(etaMs: number, nowMs: number): number {
  return Math.max(0, etaMs - nowMs);
}

/** Format milliseconds as "HH h MM m SS s". */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "0h 0m 0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

/** Progress percentage (0–100) consumed out of the total delay. */
function progressPct(etaMs: number, totalMs: number, nowMs: number): number {
  if (totalMs <= 0) return 100;
  const elapsed = totalMs - remainingMs(etaMs, nowMs);
  return Math.min(100, Math.max(0, (elapsed / totalMs) * 100));
}

// ── exported pure helpers (also used in tests) ───────────────────────────────

export { remainingMs, formatRemaining, progressPct };

// ── component ─────────────────────────────────────────────────────────────────

export interface TimelockCountdownProps {
  /** Short identifier shown as "#<proposalId>" in the label. */
  proposalId: string;
  /** ISO datetime string of when the proposal entered TIMELOCK (queuedAt). */
  queueTime: string;
  /** Total timelock delay in hours (from proposal.timelockHours or TIMELOCK_DELAY_HOURS). */
  delayHours: number;
}

export function TimelockCountdown({
  proposalId,
  queueTime,
  delayHours,
}: TimelockCountdownProps) {
  const totalMs = delayHours * 60 * 60 * 1000;
  const etaMs = new Date(queueTime).getTime() + totalMs;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Tick every second until the countdown expires
    intervalRef.current = setInterval(() => {
      const n = Date.now();
      setNowMs(n);
      if (n >= etaMs && intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [etaMs]);

  const remaining = remainingMs(etaMs, nowMs);
  const isExecutable = remaining === 0;
  const pct = progressPct(etaMs, totalMs, nowMs);

  return (
    <NestedPanel
      className="flex flex-col gap-[var(--ct-space-3)]"
      data-proposal-id={proposalId}
      aria-label={`Governance proposal #${proposalId} timelock countdown`}
    >
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-[var(--ct-space-2)]">
        <span className="body-sm font-medium ct-text-strong">
          Proposal #{proposalId}
        </span>

        <div className="flex items-center gap-[var(--ct-space-2)]">
          <ProvenanceBadge kind="live" />

          {isExecutable ? (
            <Badge
              variant="success"
              className="ct-text-accent"
              aria-label="Proposal is executable"
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
              />
              Executable
            </Badge>
          ) : (
            <span className="body-xs ct-text-muted tabular-nums">
              Executable in{" "}
              <span className="font-medium ct-text-strong">
                {formatRemaining(remaining)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <Progress
        value={pct}
        max={100}
        label={`Timelock progress for proposal #${proposalId}`}
        fillClassName={
          isExecutable
            ? "bg-[var(--ct-accent)]"
            : "bg-[var(--ct-status-warning)]"
        }
      />

      {/* ── ETA line ─────────────────────────────────────────────────────── */}
      {!isExecutable && (
        <p className="body-xs ct-text-muted">
          ETA:{" "}
          <time dateTime={new Date(etaMs).toISOString()}>
            {new Date(etaMs).toLocaleString()}
          </time>
        </p>
      )}
    </NestedPanel>
  );
}
