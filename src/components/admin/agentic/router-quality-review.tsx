// Admin · Agentic Control Tower — Router Quality Review (presentational).
//
// READ-ONLY. Interprets the existing router observability data as a COMPACT
// strip: health rates (unknown / dangerous-refusal / educational / nav /
// fallback) + the negated-no-nav count rendered as dense table rows, and a
// compact read-only WATCHLIST of degraded patterns. Top matched rules are NOT
// repeated here — they live once in the Observability trends module above.
// NO write controls, NO action buttons, NO rule/prompt editor, NO fake data.
// Pure component — all data passed in, unit-testable via SSR.

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

/** One dense health-rate row: label · proportion bar · % · count/total. */
function RateRow({ rate }: { rate: RouterQualityRate }) {
  const pct = Math.round(rate.rate * 1000) / 10; // one decimal %
  return (
    <tr className="agentic-qr-row">
      <td className="agentic-qr-rate-label body-xs ct-text-body">{rate.label}</td>
      <td className="agentic-qr-bar-cell">
        <span className="agentic-qr-bar" aria-hidden>
          <span
            className="agentic-qr-bar-fill"
            style={{ width: `${Math.min(100, Math.max(0, rate.rate * 100))}%` }}
          />
        </span>
      </td>
      <td className="agentic-qr-pct body-xs ct-text-strong tabular-nums">{pct}%</td>
      <td className="agentic-qr-frac body-xs ct-text-faint tabular-nums">
        {rate.count}/{rate.total}
      </td>
    </tr>
  );
}

/** One read-only watchlist row. Active rows are toned by severity; inactive are muted. */
function WatchRow({ signal }: { signal: RouterQualitySignal }) {
  return (
    <li className="agentic-qr-watch-row">
      <Badge variant={signal.active ? severityTone(signal.severity) : "default"}>
        {signal.active ? signal.severity : "ok"}
      </Badge>
      <span className="body-xs flex-1 min-w-0">
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

  const { total, rates, negatedNoNav, watchlist, activeSignalCount, note } = review;

  return (
    <section
      id="router-quality-review"
      className="admin-doc-stack admin-doc-stack--tight"
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
      <p className="body-xs ct-text-muted m-0">
        Read-only interpretation of the observability data above — health rates and
        a watchlist of degraded patterns. No rule, prompt, guard, or HITL change; no
        action — visibility only.
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
        <Card hoverOverlay={false} material="flat" contentClassName="agentic-qr-grid">
          <div className="agentic-qr-block">
            <span className="stat-label ct-text-muted">Health rates</span>
            <table className="agentic-qr-table w-full">
              <tbody>
                {rates.map((r) => (
                  <RateRow key={r.key} rate={r} />
                ))}
                <tr className="agentic-qr-row">
                  <td className="agentic-qr-rate-label body-xs ct-text-body">
                    Negated · no nav
                  </td>
                  <td className="agentic-qr-bar-cell" aria-hidden />
                  <td className="agentic-qr-pct body-xs ct-text-strong tabular-nums">
                    {negatedNoNav}
                  </td>
                  <td className="agentic-qr-frac body-xs ct-text-faint">blocked</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="agentic-qr-block">
            <span className="stat-label ct-text-muted">Watchlist</span>
            <ul className="agentic-qr-watchlist">
              {watchlist.map((s) => (
                <WatchRow key={s.key} signal={s} />
              ))}
            </ul>
          </div>
        </Card>
      )}

      <p className="body-xs ct-text-faint m-0">{note}</p>
    </section>
  );
}
