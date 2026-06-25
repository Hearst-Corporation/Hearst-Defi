// Admin · Agentic Control Center — Router Quality Review (presentational).
//
// READ-ONLY. Interprets the existing router observability data: health rates
// (unknown / dangerous-refusal / educational / nav / fallback), a negated-no-nav
// count, the top matched rules, and a read-only WATCHLIST of degraded patterns.
// NO write controls, NO action buttons, NO rule/prompt editor, NO fake data.
// Pure component — all data passed in, unit-testable via SSR. The only thing it
// can do is render flags for a human to look at.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  RouterQualityRate,
  RouterQualityReview,
  RouterQualitySeverity,
  RouterQualitySignal,
} from "@/lib/agentic/observability/types";

type Tone = "success" | "warning" | "danger" | "default";

/** Map a watchlist severity to a badge tone. */
function severityTone(severity: RouterQualitySeverity): Tone {
  switch (severity) {
    case "alert":
      return "danger";
    case "watch":
      return "warning";
    default:
      return "default";
  }
}

/** A single read-only rate card with a token-only proportion bar. */
function RateCard({ rate }: { rate: RouterQualityRate }) {
  const pct = Math.round(rate.rate * 1000) / 10; // one decimal %
  return (
    <Card
      hoverOverlay={false}
      contentClassName="flex flex-col gap-[var(--ct-space-2)]"
    >
      <span className="stat-label ct-text-muted">{rate.label}</span>
      <div className="admin-doc-inline-row admin-doc-inline-row--start">
        <span className="h3 m-0 tabular-nums">{pct}%</span>
        <span className="flex-1" />
        <span className="body-xs ct-text-faint tabular-nums">
          {rate.count}/{rate.total}
        </span>
      </div>
      {/* Token-only proportion bar — no hardcoded hex. */}
      <div
        className="h-1 w-full rounded-full overflow-hidden"
        style={{ background: "var(--ct-surface-2)" }}
        aria-hidden
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, rate.rate * 100))}%`,
            background: "var(--ct-accent)",
          }}
        />
      </div>
    </Card>
  );
}

/** One read-only watchlist row. Active rows are toned by severity; inactive are muted. */
function WatchRow({ signal }: { signal: RouterQualitySignal }) {
  return (
    <li className="admin-doc-inline-row admin-doc-inline-row--start align-top">
      <Badge variant={signal.active ? severityTone(signal.severity) : "default"}>
        {signal.active ? signal.severity : "ok"}
      </Badge>
      <span className="body-xs flex-1">
        <span className="ct-text-strong">{signal.label}</span>
        <span className="ct-text-muted"> — {signal.detail}</span>
      </span>
    </li>
  );
}

export function RouterQualityReview({
  review,
}: {
  review: RouterQualityReview | null | undefined;
}) {
  if (!review) return null;

  const { total, rates, negatedNoNav, topMatchedRules, watchlist, activeSignalCount, note } =
    review;

  return (
    <section
      id="router-quality-review"
      className="admin-doc-stack"
      aria-label="Router Quality Review"
    >
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <h3 className="h3 m-0">Router Quality Review</h3>
        <span className="flex-1" />
        <Badge variant={activeSignalCount > 0 ? "warning" : "success"}>
          {activeSignalCount > 0
            ? `${activeSignalCount} signal${activeSignalCount > 1 ? "s" : ""}`
            : "healthy"}
        </Badge>
      </div>
      <p className="body-xs ct-text-muted">
        Read-only interpretation of the router observability data above — health
        rates and a watchlist of degraded patterns. No rule, prompt, guard, or
        HITL change; no action — visibility only.
      </p>

      {total === 0 ? (
        <Card
          hoverOverlay={false}
          contentClassName="flex flex-col gap-[var(--ct-space-2)]"
        >
          <Badge variant="default">no data</Badge>
          <p className="body-xs ct-text-muted">
            No router decisions in this window to review. Send chat traffic (or
            widen the window) to populate the quality review.
          </p>
        </Card>
      ) : (
        <div className="admin-doc-card-grid-3">
          {rates.map((r) => (
            <RateCard key={r.key} rate={r} />
          ))}
          <Card
            hoverOverlay={false}
            contentClassName="flex flex-col gap-[var(--ct-space-2)]"
          >
            <span className="stat-label ct-text-muted">Negated · no nav</span>
            <span className="h3 m-0 tabular-nums">{negatedNoNav}</span>
            <span className="body-xs ct-text-faint">
              negations that blocked a would-be navigation
            </span>
          </Card>
        </div>
      )}

      {/* Watchlist — read-only flags (every signal shown, active or not). */}
      <Card
        hoverOverlay={false}
        contentClassName="flex flex-col gap-[var(--ct-space-2)]"
      >
        <span className="stat-label ct-text-muted">Watchlist</span>
        <ul className="flex flex-col gap-[var(--ct-space-2)]">
          {watchlist.map((s) => (
            <WatchRow key={s.key} signal={s} />
          ))}
        </ul>
      </Card>

      {/* Top matched rules (echoed read-only from the summary). */}
      {topMatchedRules.length > 0 && (
        <Card
          hoverOverlay={false}
          contentClassName="flex flex-col gap-[var(--ct-space-2)]"
        >
          <span className="stat-label ct-text-muted">Top matched rules</span>
          <ul className="flex flex-col gap-[var(--ct-space-1)]">
            {topMatchedRules.map((r) => (
              <li
                key={r.ruleId}
                className="admin-doc-inline-row admin-doc-inline-row--start"
              >
                <span className="body-xs ct-text-body font-mono flex-1 break-all">
                  {r.ruleId}
                </span>
                <span className="body-xs ct-text-muted tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="body-xs ct-text-faint">{note}</p>
    </section>
  );
}
