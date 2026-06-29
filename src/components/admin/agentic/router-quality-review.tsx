// Admin · Agentic Control Tower — Router Quality Review (presentational).
//
// READ-ONLY. Rewritten 2026-06-26 to fit the line/table console. Lives nested
// INSIDE the Observability group as a collapsible row-detail. Interprets the
// existing router observability data as: a dense health-rates TABLE (metric ·
// value · status) plus the negated-no-nav count, and a compact WATCHLIST table
// of degraded patterns toned by severity. Top matched rules are NOT repeated
// here — they live once in the Observability trends module above.
// NO write controls, NO action buttons, NO rule/prompt editor, NO fake data.
// Pure component — all data passed in, unit-testable via SSR.
//
// Canon migration (Mission #064): `agentic-tag` → BentoBadge, `agentic-table` →
// Catalyst dense Table, `agentic-cell-*` → tokenised utilities. The
// `.agentic-rowdetail` disclosure chrome is kept (section primitive).

import { cn } from "@/lib/cn";
import { BentoBadge, type BentoBadgeVariant } from "@/components/catalyst/bento-badge";
import type { AgenticTone } from "@/components/admin/agentic/agentic-group";
import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/catalyst/table";
import type {
  RouterQualityRate,
  RouterQualityReview,
  RouterQualitySeverity,
  RouterQualitySignal,
} from "@/lib/agentic/observability/types";

const FAINT = "text-[var(--ct-text-faint)]";
const EMPTY_LINE = "text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]";

/** Maps the legacy AgenticTone scale onto the canon BentoBadge variant scale. */
function toneToVariant(tone: AgenticTone): BentoBadgeVariant {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    case "accent":
      return "accent";
    case "info":
    case "neutral":
    default:
      return "default";
  }
}

/** Map a watchlist severity to a tag tone. */
function severityTone(severity: RouterQualitySeverity): AgenticTone {
  switch (severity) {
    case "alert":
      return "danger";
    case "watch":
      return "warning";
    default:
      return "info";
  }
}

/**
 * Health-rate status from its share: higher share = noisier outcome. This is a
 * presentational hint only (drives the row's tone rail + status tag); the data
 * already carries the authoritative watchlist severities.
 */
function rateTone(rate: number): AgenticTone {
  if (rate >= 0.15) return "warning";
  if (rate >= 0.3) return "danger";
  return "success";
}

/** One dense health-rate row: label · % + count/total · status tag. */
function RateRow({ rate }: { rate: RouterQualityRate }) {
  const pct = Math.round(rate.rate * 1000) / 10; // one decimal %
  const tone = rateTone(rate.rate);
  return (
    <TableRow data-tone={tone === "success" ? undefined : tone}>
      <TableCell className="ct-metric-value">{rate.label}</TableCell>
      <TableCell className="text-right tabular-nums">
        {pct}%
        <span className={FAINT}>
          {" · "}
          {rate.count}/{rate.total}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <BentoBadge variant={toneToVariant(tone)}>
          {tone === "success" ? "ok" : tone}
        </BentoBadge>
      </TableCell>
    </TableRow>
  );
}

/** One read-only watchlist row. Active rows are toned by severity; inactive read "ok". */
function WatchRow({ signal }: { signal: RouterQualitySignal }) {
  const tone: AgenticTone = signal.active ? severityTone(signal.severity) : "success";
  return (
    <TableRow data-tone={signal.active ? severityTone(signal.severity) : undefined}>
      <TableCell className="ct-metric-value">{signal.label}</TableCell>
      <TableCell className="ct-metric-caption">{signal.detail}</TableCell>
      <TableCell className="whitespace-nowrap">
        <BentoBadge variant={toneToVariant(tone)}>
          {signal.active ? signal.severity : "ok"}
        </BentoBadge>
      </TableCell>
    </TableRow>
  );
}

export function RouterQualityReview({
  review,
}: {
  review: RouterQualityReview | null | undefined;
}) {
  if (!review) return null;

  const { total, rates, negatedNoNav, watchlist, activeSignalCount, note } = review;

  return (
    <details className="agentic-rowdetail" open>
      <summary className="agentic-rowdetail-summary">
        Router Quality Review
        <BentoBadge variant={activeSignalCount > 0 ? "warning" : "success"}>
          {activeSignalCount > 0
            ? `${activeSignalCount} signal${activeSignalCount > 1 ? "s" : ""}`
            : "healthy"}
        </BentoBadge>
      </summary>
      <div className="agentic-rowdetail-body">
        <p className="m-0">
          Read-only interpretation of the observability data above — health rates
          and a watchlist of degraded patterns. No rule, prompt, guard, or HITL
          change; no action — visibility only.
        </p>

        {total === 0 ? (
          <p className={cn(EMPTY_LINE, "m-0")}>
            <BentoBadge variant="default">no data</BentoBadge>
            No router decisions in this window to review. Send chat traffic (or
            widen the window) to populate the quality review.
          </p>
        ) : (
          <>
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Health rate</TableHeader>
                  <TableHeader className="text-right tabular-nums">Value</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {rates.map((r) => (
                  <RateRow key={r.key} rate={r} />
                ))}
                <TableRow>
                  <TableCell className="ct-metric-value">Negated · no nav</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {negatedNoNav}
                    <span className={FAINT}>{" · blocked"}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <BentoBadge variant="success">ok</BentoBadge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Watchlist</TableHeader>
                  <TableHeader>Detail</TableHeader>
                  <TableHeader>Severity</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {watchlist.map((s) => (
                  <WatchRow key={s.key} signal={s} />
                ))}
              </TableBody>
            </Table>
          </>
        )}

        <p className={cn(FAINT, "m-0")}>{note}</p>
      </div>
    </details>
  );
}
