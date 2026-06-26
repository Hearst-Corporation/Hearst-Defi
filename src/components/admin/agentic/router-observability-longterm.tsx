// Admin · Agentic Control Center — Router Observability LONG-TERM (presentational).
//
// READ-ONLY. Renders a RouterLongTermSummary as ONE compact module: header badges
// + (when data) a short per-UTC-day bar strip beside the horizon-total rows. NO
// write controls, NO forms, NO inputs. Honest "unavailable" state when the durable
// store could not be read. Dependency-free bars, DS tokens only (no hardcoded hex).
// Pure component — unit-testable via SSR.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  RouterLongTermDay,
  RouterLongTermSummary,
} from "@/lib/agentic/observability/types";

// Token-only category colors, render order top→bottom in the stacked bar.
const CATEGORIES: {
  key: keyof Pick<
    RouterLongTermDay,
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

/** A short per-day stacked bar — reuses the observability trend-bar grammar. */
function DayBar({ day, max }: { day: RouterLongTermDay; max: number }) {
  const heightPct = max > 0 ? Math.round((day.total / max) * 100) : 0;
  return (
    <div className="agentic-obs-trend-bar" title={`${day.date}: ${day.total} decisions`}>
      <div className="agentic-obs-trend-bar-track">
        {day.total === 0 ? (
          <div
            className="w-full"
            style={{ height: "2px", background: "var(--ct-border-soft)" }}
            aria-hidden
          />
        ) : (
          CATEGORIES.map((c) => {
            const v = day[c.key];
            if (v <= 0) return null;
            const segPct = (v / day.total) * heightPct;
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
      <span className="agentic-obs-trend-label tabular-nums">{day.date.slice(5)}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="agentic-obs-legend" aria-label="Outcome categories">
      {CATEGORIES.map((c) => (
        <span key={c.key} className="agentic-obs-legend-item">
          <span aria-hidden className="agentic-obs-legend-swatch" style={{ background: c.token }} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

export function RouterObservabilityLongTerm({
  longTerm,
}: {
  longTerm: RouterLongTermSummary;
}) {
  const { available, horizonDays, retention, days, total, totals, note } =
    longTerm;
  const maxDay = days.reduce((m, d) => Math.max(m, d.total), 0);

  return (
    <Card hoverOverlay={false} material="flat" density="compact" contentClassName="agentic-lt">
      <div className="admin-doc-inline-row admin-doc-inline-row--start flex-wrap">
        <span className="h3 m-0">Long-term</span>
        <Badge variant={available ? "success" : "warning"}>
          {available ? "durable" : "unavailable"}
        </Badge>
        <Badge variant="default">last {horizonDays}d</Badge>
        <Badge variant="default">
          retention {retention.retentionDays}d
          {retention.fromEnv ? " · env" : " · default"}
        </Badge>
      </div>
      <p className="body-xs ct-text-muted m-0">{note}</p>

      {!available ? null : total === 0 ? (
        <p className="body-xs ct-text-muted m-0">
          No durable router traces in the last {horizonDays} days yet. Send chat
          traffic to build long-term history.
        </p>
      ) : (
        <div className="agentic-lt-body">
          <div className="agentic-lt-block">
            <span className="stat-label ct-text-muted">
              Per-day outcomes ({total} total)
            </span>
            <div className="agentic-obs-trend-bars">
              {days.map((d) => (
                <DayBar key={d.date} day={d} max={maxDay} />
              ))}
            </div>
            <Legend />
          </div>

          <div className="agentic-lt-block">
            <span className="stat-label ct-text-muted">Horizon totals</span>
            <table className="agentic-qr-table w-full">
              <tbody>
                {CATEGORIES.map((c) => {
                  const value = totals[c.key];
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <tr key={c.key} className="agentic-qr-row">
                      <td className="agentic-qr-rate-label body-xs ct-text-body">
                        {c.label}
                      </td>
                      <td className="agentic-qr-bar-cell">
                        <span className="agentic-qr-bar" aria-hidden>
                          <span
                            className="agentic-qr-bar-fill"
                            style={{ width: `${pct}%`, background: c.token }}
                          />
                        </span>
                      </td>
                      <td className="agentic-qr-pct body-xs ct-text-strong tabular-nums">
                        {pct}%
                      </td>
                      <td className="agentic-qr-frac body-xs ct-text-faint tabular-nums">
                        {value}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
