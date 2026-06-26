// Admin · Agentic Control Center — Router Observability TRENDS (presentational).
//
// READ-ONLY. Renders time-bucketed outcome trends, an outcome distribution, and
// the top matched rules, all derived from the existing capped trace buffer. NO
// write controls, NO forms, NO inputs — window selection lives in the parent
// Observability section header. Dependency-free bars built from DS tokens only.

import { Card } from "@/components/ui/card";
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

// Outcome categories shown in the stacked bars + distribution, in render order.
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
  token: string;
}[] = [
  { key: "navigationFastPaths", label: "Nav fast-path", token: "var(--ct-accent)" },
  { key: "dangerousRefusals", label: "Refusal", token: "var(--ct-status-danger)" },
  { key: "educationalTurns", label: "Educational", token: "var(--ct-status-success)" },
  { key: "negatedNoNav", label: "Negated", token: "var(--ct-status-warning)" },
  { key: "normalOrUnknown", label: "Normal", token: "var(--ct-text-faint)" },
];

/** Show sparse x-axis ticks so hourly/daily labels do not overlap. */
function shouldShowBucketLabel(index: number, total: number): boolean {
  if (total <= 8) return true;
  if (total <= 12) return index % 2 === 0 || index === total - 1;
  if (total <= 24) return index % 4 === 0 || index === total - 1;
  return index % 6 === 0 || index === total - 1;
}

function TrendBar({
  bucket,
  max,
  showLabel,
}: {
  bucket: RouterDecisionTrendBucket;
  max: number;
  showLabel: boolean;
}) {
  const heightPct = max > 0 ? Math.round((bucket.total / max) * 100) : 0;
  return (
    <div className="agentic-obs-trend-bar" title={`${bucket.label}: ${bucket.total} decisions`}>
      <div className="agentic-obs-trend-bar-track">
        {bucket.total === 0 ? (
          <div
            className="w-full"
            style={{ height: "2px", background: "var(--ct-border-soft)" }}
            aria-hidden
          />
        ) : (
          CATEGORIES.map((c) => {
            const v = bucket[c.key];
            if (v <= 0) return null;
            const segPct = (v / bucket.total) * heightPct;
            return (
              <div
                key={c.key}
                className="w-full"
                style={{ height: `${segPct}%`, background: c.token }}
              />
            );
          })
        )}
      </div>
      <span
        className={
          showLabel
            ? "agentic-obs-trend-label tabular-nums"
            : "agentic-obs-trend-label agentic-obs-trend-label--spacer tabular-nums"
        }
        aria-hidden={!showLabel}
      >
        {bucket.label}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="agentic-obs-legend" aria-label="Outcome categories">
      {CATEGORIES.map((c) => (
        <span key={c.key} className="agentic-obs-legend-item">
          <span
            aria-hidden
            className="agentic-obs-legend-swatch"
            style={{ background: c.token }}
          />
          {c.label}
        </span>
      ))}
    </div>
  );
}

function DistributionRow({
  label,
  token,
  value,
  total,
}: {
  label: string;
  token: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="agentic-obs-dist-row">
      <div className="admin-doc-inline-row admin-doc-inline-row--start">
        <span className="body-xs ct-text-body flex-1 min-w-0">{label}</span>
        <span className="body-xs ct-text-muted tabular-nums whitespace-nowrap">
          {value} · {pct}%
        </span>
      </div>
      <div className="agentic-obs-dist-track">
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: token }}
          aria-hidden
        />
      </div>
    </div>
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

  // Only render the time-bucketed bar chart when the sample is large enough to
  // read. With a handful of decisions spread over 24 buckets the chart is a row
  // of empty slots with overlapping axis labels — show a "low sample" line and
  // let the distribution rows below carry the signal instead.
  const showBars = windowTotal >= 12 && filledBuckets >= 3;

  const dist = CATEGORIES.map((c) => ({
    ...c,
    value: buckets.reduce((sum, b) => sum + b[c.key], 0),
  }));

  return (
    <Card
      hoverOverlay={false}
      density="compact"
      aria-label="Router Observability trends"
      contentClassName="agentic-obs-trends-module"
    >
      <div className="agentic-obs-trends-head">
        <span className="stat-label ct-text-muted m-0">Outcome trend</span>
        <span className="body-xs ct-text-faint tabular-nums">
          {windowTotal} decision{windowTotal === 1 ? "" : "s"} · {WINDOW_LABEL[window]}
        </span>
      </div>

      {windowTotal === 0 ? (
        <p className="body-xs ct-text-muted m-0">
          No router decisions in this window yet. Pick a wider window or send chat
          traffic to populate the trend.
        </p>
      ) : showBars ? (
        <>
          <div className="agentic-obs-trend-bars">
            {buckets.map((b, i) => (
              <TrendBar
                key={b.start}
                bucket={b}
                max={maxBucket}
                showLabel={shouldShowBucketLabel(i, buckets.length)}
              />
            ))}
          </div>
          <Legend />
        </>
      ) : (
        <p className="body-xs ct-text-faint m-0">
          Low sample ({windowTotal} decision{windowTotal === 1 ? "" : "s"} over{" "}
          {WINDOW_LABEL[window]}) — a time trend needs more traffic to read. The
          distribution below summarises the outcomes.
        </p>
      )}

      <div className="agentic-obs-side-grid">
        <div className="agentic-obs-subpanel">
          <span className="stat-label ct-text-muted">Outcome distribution</span>
          {windowTotal === 0 ? (
            <p className="body-xs ct-text-faint m-0">No decisions to distribute.</p>
          ) : (
            dist.map((d) => (
              <DistributionRow
                key={d.key}
                label={d.label}
                token={d.token}
                value={d.value}
                total={windowTotal}
              />
            ))
          )}
        </div>

        <div className="agentic-obs-subpanel">
          <span className="stat-label ct-text-muted">Top matched rules</span>
          {topMatchedRules.length === 0 ? (
            <p className="body-xs ct-text-faint m-0">
              No matched rules recorded in the buffer yet.
            </p>
          ) : (
            <ul className="agentic-obs-rules-list">
              {topMatchedRules.map((r) => (
                <li key={r.ruleId} className="agentic-obs-rules-row">
                  <span className="body-xs ct-text-body font-mono break-all flex-1 min-w-0">
                    {r.ruleId}
                  </span>
                  <span className="body-xs ct-text-muted tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="body-xs ct-text-faint m-0">{bufferLimitNote}</p>
    </Card>
  );
}
