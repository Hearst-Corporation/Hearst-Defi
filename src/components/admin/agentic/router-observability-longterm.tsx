// Admin · Agentic Control Center — Router Observability LONG-TERM (presentational).
//
// READ-ONLY. Renders a RouterLongTermSummary: a per-UTC-day stacked bar history
// over the durable table (beyond the capped recent window), horizon totals, and
// the retention config in effect. NO write controls, NO forms, NO inputs. Honest
// "unavailable" state when the durable store could not be read. Dependency-free
// bars, DS tokens only (no hardcoded hex). Pure component — unit-testable via SSR.

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

function DayBar({ day, max }: { day: RouterLongTermDay; max: number }) {
  const heightPct = max > 0 ? Math.round((day.total / max) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-[var(--ct-space-1)]">
      <div
        className="flex w-full flex-col-reverse overflow-hidden rounded-[var(--ct-radius-xs)]"
        style={{ height: "6rem" }}
        title={`${day.date}: ${day.total} decisions`}
      >
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
      <span className="ct-text-faint tabular-nums whitespace-nowrap text-[length:var(--ct-text-micro-size)]">
        {day.date.slice(5)}
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

export function RouterObservabilityLongTerm({
  longTerm,
}: {
  longTerm: RouterLongTermSummary;
}) {
  const { available, horizonDays, retention, days, total, totals, note } =
    longTerm;
  const maxDay = days.reduce((m, d) => Math.max(m, d.total), 0);

  return (
    <div className="admin-doc-stack" aria-label="Router Observability long-term">
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
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
          <span className="flex-1" />
        </div>
        <p className="body-xs ct-text-muted">{note}</p>
      </Card>

      {!available ? null : total === 0 ? (
        <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
          <Badge variant="default">empty</Badge>
          <p className="body-xs ct-text-muted">
            No durable router traces in the last {horizonDays} days yet. Send chat
            traffic to build long-term history.
          </p>
        </Card>
      ) : (
        <>
          <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-3)]">
            <span className="stat-label ct-text-muted">
              Per-day outcomes ({total} total)
            </span>
            <div className="flex items-end gap-[var(--ct-space-1)]">
              {days.map((d) => (
                <DayBar key={d.date} day={d} max={maxDay} />
              ))}
            </div>
            <Legend />
          </Card>

          <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
            <span className="stat-label ct-text-muted">Horizon totals</span>
            <div className="flex flex-col gap-[var(--ct-space-2)]">
              {CATEGORIES.map((c) => {
                const value = totals[c.key];
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <div key={c.key} className="flex flex-col gap-[var(--ct-space-1)]">
                    <div className="admin-doc-inline-row admin-doc-inline-row--start">
                      <span className="body-xs ct-text-body flex-1">{c.label}</span>
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
                        style={{ width: `${pct}%`, background: c.token }}
                        aria-hidden
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
