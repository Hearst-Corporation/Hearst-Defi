// Admin · Agentic Control Center — Router Observability TRENDS (presentational).
//
// READ-ONLY. Renders the time-bucketed outcome trend, the outcome distribution,
// and the top matched rules — all derived from the existing capped trace buffer
// — as dense token-only tables. NO write controls, NO forms, NO inputs: window
// selection lives in the parent Observability section header.

import { AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
import type {
  RouterDecisionTrendBucket,
  RouterMatchedRuleStat,
  RouterTrendWindow,
} from "@/lib/agentic/observability/types";

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
          <span className="agentic-cell-faint tabular-nums">
            {" · "}
            {windowTotal} decision{windowTotal === 1 ? "" : "s"} · {WINDOW_LABEL[window]}
          </span>
        </summary>
        <div className="agentic-rowdetail-body">
          {windowTotal === 0 ? (
            <p className="agentic-empty-line m-0">
              No router decisions in this window yet. Pick a wider window or send
              chat traffic to populate the trend.
            </p>
          ) : showTrend ? (
            <table className="agentic-table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Decisions</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {trendRows.map((b) => {
                  const pct = maxBucket > 0 ? Math.round((b.total / maxBucket) * 100) : 0;
                  return (
                    <tr key={b.start}>
                      <td className="agentic-cell-mono">{b.label}</td>
                      <td className="agentic-cell-num">{b.total}</td>
                      <td>
                        <CellBar pct={pct} tone="accent" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="agentic-empty-line m-0">
              Low sample ({windowTotal} decision{windowTotal === 1 ? "" : "s"} over{" "}
              {WINDOW_LABEL[window]}) — a time trend needs more traffic to read.
              The distribution below summarises the outcomes.
            </p>
          )}
        </div>
      </details>

      {/* Outcome distribution — one row per category. */}
      <p className="agentic-section-caption">Outcome distribution</p>
      {windowTotal === 0 ? (
        <p className="agentic-empty-line m-0">No decisions to distribute.</p>
      ) : (
        <table className="agentic-table">
          <thead>
            <tr>
              <th>Outcome</th>
              <th>Count</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {dist.map((d) => {
              const pct = windowTotal > 0 ? Math.round((d.value / windowTotal) * 100) : 0;
              return (
                <tr key={d.key} data-tone={d.tone === "neutral" ? undefined : d.tone}>
                  <td className="agentic-cell-strong">
                    <AgenticTag tone={d.tone}>{d.label}</AgenticTag>
                  </td>
                  <td className="agentic-cell-num">{d.value}</td>
                  <td>
                    <div className="admin-doc-inline-row admin-doc-inline-row--start">
                      <CellBar pct={pct} tone={d.tone} />
                      <span className="agentic-cell-muted tabular-nums whitespace-nowrap">
                        {pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Top matched rules — one row per rule. */}
      <p className="agentic-section-caption">Top matched rules</p>
      {topMatchedRules.length === 0 ? (
        <p className="agentic-empty-line m-0">
          No matched rules recorded in the buffer yet.
        </p>
      ) : (
        <table className="agentic-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {topMatchedRules.map((r) => (
              <tr key={r.ruleId}>
                <td className="agentic-cell-mono">{r.ruleId}</td>
                <td className="agentic-cell-num">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="agentic-section-caption agentic-cell-faint">{bufferLimitNote}</p>
    </div>
  );
}
