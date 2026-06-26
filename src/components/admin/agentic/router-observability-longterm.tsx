// Admin · Agentic Control Tower — Router Observability LONG-TERM (presentational).
//
// READ-ONLY. Renders a RouterLongTermSummary as a nested disclosure inside the
// Observability group: a per-UTC-day outcome table + a horizon-totals table with
// token-only proportional bars. NO write controls, NO forms, NO inputs. Honest
// "unavailable" / "empty" lines when the durable store has nothing to show.
// Dense line/table vocabulary only, DS tokens only (no hardcoded hex). Pure
// component — unit-testable via SSR.

import { AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
import type {
  RouterLongTermDay,
  RouterLongTermSummary,
} from "@/lib/agentic/observability/types";

// Outcome categories, render order top→bottom. Each carries a tone that drives
// the tag colour, the row rail, and the proportional bar fill — all token-only
// via the shared .agentic-bar grammar (no literal hex, no inline colour).
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
  tone: AgenticTone;
}[] = [
  { key: "navigationFastPaths", label: "Navigation fast-path", tone: "accent" },
  { key: "dangerousRefusals", label: "Dangerous refusal", tone: "danger" },
  { key: "educationalTurns", label: "Educational", tone: "success" },
  { key: "negatedNoNav", label: "Negated · no nav", tone: "warning" },
  { key: "normalOrUnknown", label: "Normal / unknown", tone: "neutral" },
];

export function RouterObservabilityLongTerm({
  longTerm,
}: {
  longTerm: RouterLongTermSummary;
}) {
  const { available, horizonDays, retention, days, total, totals, note } =
    longTerm;

  return (
    <details className="agentic-rowdetail">
      <summary className="agentic-rowdetail-summary">
        Long-term{" "}
        <AgenticTag tone={available ? "success" : "danger"}>
          {available ? "durable" : "unavailable"}
        </AgenticTag>{" "}
        <AgenticTag tone="neutral">last {horizonDays}d</AgenticTag>{" "}
        <AgenticTag tone="neutral">
          retention {retention.retentionDays}d
          {retention.fromEnv ? " · env" : " · default"}
        </AgenticTag>
      </summary>

      <div className="agentic-rowdetail-body">
        <p className="agentic-section-caption m-0">{note}</p>

        {!available ? null : total === 0 ? (
          <p className="agentic-empty-line m-0">
            No durable router traces in the last {horizonDays} days yet. Send chat
            traffic to build long-term history.
          </p>
        ) : (
          <>
            {/* Per-day outcomes — one dense row per UTC day. */}
            <p className="agentic-section-caption m-0">
              Per-day outcomes ({total} total)
            </p>
            <table className="agentic-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Total</th>
                  {CATEGORIES.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date}>
                    <td className="agentic-cell-strong agentic-cell-mono">{d.date}</td>
                    <td className="agentic-cell-num agentic-cell-strong">{d.total}</td>
                    {CATEGORIES.map((c) => (
                      <td key={c.key} className="agentic-cell-num agentic-cell-muted">
                        {d[c.key] > 0 ? d[c.key] : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Horizon totals — share-of-decisions with a token-only bar. */}
            <p className="agentic-section-caption m-0">Horizon totals</p>
            <table className="agentic-table">
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th>Share</th>
                  <th>%</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => {
                  const value = totals[c.key];
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <tr key={c.key} data-tone={c.tone === "neutral" ? undefined : c.tone}>
                      <td className="agentic-cell-strong">
                        <AgenticTag tone={c.tone}>{c.label}</AgenticTag>
                      </td>
                      <td>
                        <span
                          className="agentic-bar"
                          aria-hidden
                          style={{ ["--agentic-bar-pct" as string]: `${pct}%` }}
                        >
                          <span
                            className="agentic-bar-fill"
                            data-tone={c.tone === "neutral" ? undefined : c.tone}
                          />
                        </span>
                      </td>
                      <td className="agentic-cell-num agentic-cell-strong">{pct}%</td>
                      <td className="agentic-cell-num agentic-cell-faint">{value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </details>
  );
}
