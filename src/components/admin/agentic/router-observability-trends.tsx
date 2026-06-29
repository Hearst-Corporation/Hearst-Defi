// Admin · Agentic Control Center — Router Observability TRENDS (presentational).
//
// READ-ONLY. Renders the time-bucketed outcome trend, the outcome distribution,
// and the top matched rules — all derived from the existing capped trace buffer
// — as dense token-only tables. NO write controls, NO forms, NO inputs: window
// selection lives in the parent Observability section header.
//
// Canon migration (Mission #064): `agentic-tag` → BentoBadge, `agentic-table` →
// Catalyst dense Table, `agentic-cell-*` → tokenised utilities. The proportional
// `.agentic-bar` grammar and the `.agentic-rowdetail` / `.agentic-trends`
// section primitives are kept (they are section chrome, not table cells).

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
  RouterDecisionTrendBucket,
  RouterMatchedRuleStat,
  RouterTrendWindow,
} from "@/lib/agentic/observability/types";

const FAINT = "text-[var(--ct-text-faint)]";
const SECTION_CAPTION = "text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]";
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

const WINDOW_LABEL: Record<RouterTrendWindow, string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
};

// Outcome categories shown in the distribution + trend, in render order.
const CATEGORIES: {
  key: keyof Pick<
    RouterDecisionTrendBucket,
    | "navigationFastPaths"
    | "dangerousRefusals"
    | "educationalTurns"
    | "negatedNoNav"
    | "normalOrUnknown"
  >;
  label: string;
  tone: AgenticTone;
}[] = [
  { key: "navigationFastPaths", label: "Nav fast-path", tone: "accent" },
  { key: "dangerousRefusals", label: "Refusal", tone: "danger" },
  { key: "educationalTurns", label: "Educational", tone: "success" },
  { key: "negatedNoNav", label: "Negated", tone: "warning" },
  { key: "normalOrUnknown", label: "Normal", tone: "neutral" },
];

/** Show sparse trend rows so hourly/daily buckets do not overwhelm the table. */
function shouldShowBucketLabel(index: number, total: number): boolean {
  if (total <= 8) return true;
  if (total <= 12) return index % 2 === 0 || index === total - 1;
  if (total <= 24) return index % 4 === 0 || index === total - 1;
  return index % 6 === 0 || index === total - 1;
}

/** A token-only magnitude/share bar for a table cell. Width via CSS var, no hex. */
function CellBar({ pct, tone }: { pct: number; tone?: AgenticTone }) {
  return (
    <span
      className="agentic-bar"
      style={{ ["--agentic-bar-pct" as string]: `${pct}%` }}
      aria-hidden
    >
      <span
        className="agentic-bar-fill"
        data-tone={tone && tone !== "neutral" ? tone : undefined}
      />
    </span>
  );
}

export function RouterObservabilityTrends({
  window,
  buckets,
  topMatchedRules,
  bufferLimitNote,
}: {
  window: RouterTrendWindow;
  buckets: RouterDecisionTrendBucket[];
  topMatchedRules: RouterMatchedRuleStat[];
  bufferLimitNote: string;
}) {
  const windowTotal = buckets.reduce((sum, b) => sum + b.total, 0);
  const maxBucket = buckets.reduce((m, b) => Math.max(m, b.total), 0);
  const filledBuckets = buckets.reduce((n, b) => n + (b.total > 0 ? 1 : 0), 0);

  // Only render the time-bucketed trend rows when the sample is large enough to
  // read. With a handful of decisions spread over 24 buckets the trend is a wall
  // of empty rows — show a "low sample" line and let the distribution carry it.
  const showTrend = windowTotal >= 12 && filledBuckets >= 3;
  const trendRows = buckets.filter((_, i) => shouldShowBucketLabel(i, buckets.length));

  const dist = CATEGORIES.map((c) => ({
    ...c,
    value: buckets.reduce((sum, b) => sum + b[c.key], 0),
  }));

  return (
    <div className="agentic-trends" aria-label="Router Observability trends">
      {/* Outcome trend — compact time-bucketed table. */}
      <details className="agentic-rowdetail" open>
        <summary className="agentic-rowdetail-summary">
          Outcome trend
          <span className={cn(FAINT, "tabular-nums")}>
            {" · "}
            {windowTotal} decision{windowTotal === 1 ? "" : "s"} · {WINDOW_LABEL[window]}
          </span>
        </summary>
        <div className="agentic-rowdetail-body">
          {windowTotal === 0 ? (
            <p className={cn(EMPTY_LINE, "m-0")}>
              No router decisions in this window yet. Pick a wider window or send
              chat traffic to populate the trend.
            </p>
          ) : showTrend ? (
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Bucket</TableHeader>
                  <TableHeader>Decisions</TableHeader>
                  <TableHeader>Share</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {trendRows.map((b) => {
                  const pct = maxBucket > 0 ? Math.round((b.total / maxBucket) * 100) : 0;
                  return (
                    <TableRow key={b.start}>
                      <TableCell className="font-mono">{b.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.total}</TableCell>
                      <TableCell>
                        <CellBar pct={pct} tone="accent" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className={cn(EMPTY_LINE, "m-0")}>
              Low sample ({windowTotal} decision{windowTotal === 1 ? "" : "s"} over{" "}
              {WINDOW_LABEL[window]}) — a time trend needs more traffic to read.
              The distribution below summarises the outcomes.
            </p>
          )}
        </div>
      </details>

      {/* Outcome distribution — one row per category. */}
      <p className={SECTION_CAPTION}>Outcome distribution</p>
      {windowTotal === 0 ? (
        <p className={cn(EMPTY_LINE, "m-0")}>No decisions to distribute.</p>
      ) : (
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader>Outcome</TableHeader>
              <TableHeader>Count</TableHeader>
              <TableHeader>Share</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {dist.map((d) => {
              const pct = windowTotal > 0 ? Math.round((d.value / windowTotal) * 100) : 0;
              return (
                <TableRow key={d.key} data-tone={d.tone === "neutral" ? undefined : d.tone}>
                  <TableCell className="ct-metric-value">
                    <BentoBadge variant={toneToVariant(d.tone)}>{d.label}</BentoBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.value}</TableCell>
                  <TableCell>
                    <div className="admin-doc-inline-row admin-doc-inline-row--start">
                      <CellBar pct={pct} tone={d.tone} />
                      <span className="ct-metric-caption tabular-nums whitespace-nowrap">
                        {pct}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Top matched rules — one row per rule. */}
      <p className={SECTION_CAPTION}>Top matched rules</p>
      {topMatchedRules.length === 0 ? (
        <p className={cn(EMPTY_LINE, "m-0")}>
          No matched rules recorded in the buffer yet.
        </p>
      ) : (
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader>Rule</TableHeader>
              <TableHeader>Count</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {topMatchedRules.map((r) => (
              <TableRow key={r.ruleId}>
                <TableCell className="font-mono">{r.ruleId}</TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <p className={cn(SECTION_CAPTION, FAINT)}>{bufferLimitNote}</p>
    </div>
  );
}
