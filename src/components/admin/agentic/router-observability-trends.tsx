// Admin · Agentic Control Center — Router Observability TRENDS (presentational).
//
// READ-ONLY. Renders time-bucketed outcome trends, an outcome distribution, and
// the top matched rules, all derived from the existing capped trace buffer. NO
// write controls, NO forms, NO inputs — the window selector is plain <Link>
// query-param navigation. Dependency-free bars built from DS tokens only (no
// hardcoded hex). Pure component — all data passed in, unit-testable via SSR.

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  RouterDecisionTrendBucket,
  RouterMatchedRuleStat,
  RouterTrendWindow,
} from "@/lib/agentic/observability/types";

const WINDOWS: RouterTrendWindow[] = ["1h", "24h", "7d"];

const WINDOW_LABEL: Record<RouterTrendWindow, string> = {
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
};

// Outcome categories shown in the stacked bars + distribution, in render order.
// Token names only — never a hardcoded hex (CLAUDE.md: dark-mode tokens).
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
  { key: "navigationFastPaths", label: "Navigation fast-path", token: "var(--ct-accent)" },
  { key: "dangerousRefusals", label: "Dangerous refusal", token: "var(--ct-status-danger)" },
  { key: "educationalTurns", label: "Educational", token: "var(--ct-status-success)" },
  { key: "negatedNoNav", label: "Negated · no nav", token: "var(--ct-status-warning)" },
  { key: "normalOrUnknown", label: "Normal / unknown", token: "var(--ct-text-faint)" },
];

function WindowSelector({ current }: { current: RouterTrendWindow }) {
  return (
    <div
      className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap"
      role="group"
      aria-label="Trend window"
    >
      <span className="stat-label ct-text-muted">Window</span>
      {WINDOWS.map((w) => {
        const active = w === current;
        return (
          <Link
            key={w}
            href={`/admin/agentic?routerWindow=${w}#router-observability`}
            aria-current={active ? "true" : undefined}
            className="no-underline"
          >
            <Badge variant={active ? "accent" : "default"}>{WINDOW_LABEL[w]}</Badge>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * One stacked vertical bar for a time bucket. Heights are percentages of the
 * window's busiest bucket so the tallest bar fills the track. Empty buckets show
 * a faint baseline so the time axis stays legible.
 */
function TrendBar({
  bucket,
  max,
}: {
  bucket: RouterDecisionTrendBucket;
  max: number;
}) {
  const heightPct = max > 0 ? Math.round((bucket.total / max) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-[var(--ct-space-1)]">
      <div
        className="flex w-full flex-col-reverse overflow-hidden rounded-[var(--ct-radius-xs)]"
        style={{ height: "5rem" }}
        title={`${bucket.label}: ${bucket.total} decisions`}
      >
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
            // Segment height = its share of the bar's filled height.
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
      <span className="ct-text-faint tabular-nums whitespace-nowrap text-[length:var(--ct-text-micro-size)]">
        {bucket.label}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
      {CATEGORIES.map((c) => (
        <span
          key={c.key}
          className="admin-doc-inline-row admin-doc-inline-row--start body-xs ct-text-muted"
        >
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: c.token }}
          />
          {c.label}
        </span>
      ))}
    </div>
  );
}

/** Horizontal distribution bar for one category across the whole window. */
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
    <div className="flex flex-col gap-[var(--ct-space-1)]">
      <div className="admin-doc-inline-row admin-doc-inline-row--start">
        <span className="body-xs ct-text-body flex-1">{label}</span>
        <span className="body-xs ct-text-muted tabular-nums">
          {value} · {pct}%
        </span>
      </div>
      <div
        className="w-full overflow-hidden rounded-[var(--ct-radius-xs)]"
        style={{ height: "6px", background: "var(--ct-surface-2)" }}
      >
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

  // Window-wide totals per category for the distribution view.
  const dist = CATEGORIES.map((c) => ({
    ...c,
    value: buckets.reduce((sum, b) => sum + b[c.key], 0),
  }));

  return (
    <div className="admin-doc-stack" aria-label="Router Observability trends">
      {/* Window selector + summary */}
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
        <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
          <span className="h3 m-0">Trends</span>
          <span className="flex-1" />
          <WindowSelector current={window} />
        </div>
        <p className="body-xs ct-text-muted">
          {windowTotal} decision{windowTotal === 1 ? "" : "s"} in the last{" "}
          {WINDOW_LABEL[window]}.
        </p>
      </Card>

      {/* Outcome trend (stacked bars over time) */}
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-3)]">
        <span className="stat-label ct-text-muted">Outcome trend</span>
        {windowTotal === 0 ? (
          <p className="body-xs ct-text-muted">
            No router decisions in this window yet. Pick a wider window or send
            chat traffic to populate the trend.
          </p>
        ) : (
          <>
            <div className="flex items-end gap-[var(--ct-space-1)]">
              {buckets.map((b) => (
                <TrendBar key={b.start} bucket={b} max={maxBucket} />
              ))}
            </div>
            <Legend />
          </>
        )}
      </Card>

      {/* Outcome distribution (horizontal bars over the window) */}
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-3)]">
        <span className="stat-label ct-text-muted">Outcome distribution</span>
        {windowTotal === 0 ? (
          <p className="body-xs ct-text-faint">No decisions to distribute.</p>
        ) : (
          <div className="flex flex-col gap-[var(--ct-space-2)]">
            {dist.map((d) => (
              <DistributionRow
                key={d.key}
                label={d.label}
                token={d.token}
                value={d.value}
                total={windowTotal}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Top matched rules */}
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">Top matched rules</span>
        {topMatchedRules.length === 0 ? (
          <p className="body-xs ct-text-faint">
            No matched rules recorded in the buffer yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--ct-space-1)]">
            {topMatchedRules.map((r) => (
              <li
                key={r.ruleId}
                className="admin-doc-inline-row admin-doc-inline-row--start"
              >
                <span className="body-xs ct-text-body font-mono break-words flex-1">
                  {r.ruleId}
                </span>
                <span className="body-xs ct-text-muted tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Buffer limitation note */}
      <p className="body-xs ct-text-faint">{bufferLimitNote}</p>
    </div>
  );
}
