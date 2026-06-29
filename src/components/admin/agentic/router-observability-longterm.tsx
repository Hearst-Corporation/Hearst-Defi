// Admin · Agentic Control Tower — Router Observability LONG-TERM (presentational).
//
// READ-ONLY. Renders a RouterLongTermSummary as a nested disclosure inside the
// Observability group: a per-UTC-day outcome table + a horizon-totals table with
// token-only proportional bars. NO write controls, NO forms, NO inputs. Honest
// "unavailable" / "empty" lines when the durable store has nothing to show.
// Dense line/table vocabulary only, DS tokens only (no hardcoded hex). Pure
// component — unit-testable via SSR.
//
// Canon migration (Mission #064): `agentic-tag` → BentoBadge, `agentic-table` →
// Catalyst dense Table, `agentic-cell-*` → tokenised utilities. The
// `.agentic-rowdetail` disclosure chrome and the `.agentic-bar` proportional bar
// grammar are kept (section primitives, not table cells).

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
  RouterLongTermDay,
  RouterLongTermSummary,
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
        <BentoBadge variant={available ? "success" : "danger"}>
          {available ? "durable" : "unavailable"}
        </BentoBadge>{" "}
        <BentoBadge variant="default">last {horizonDays}d</BentoBadge>{" "}
        <BentoBadge variant="default">
          retention {retention.retentionDays}d
          {retention.fromEnv ? " · env" : " · default"}
        </BentoBadge>
      </summary>

      <div className="agentic-rowdetail-body">
        <p className={cn(SECTION_CAPTION, "m-0")}>{note}</p>

        {!available ? null : total === 0 ? (
          <p className={cn(EMPTY_LINE, "m-0")}>
            No durable router traces in the last {horizonDays} days yet. Send chat
            traffic to build long-term history.
          </p>
        ) : (
          <>
            {/* Per-day outcomes — one dense row per UTC day. */}
            <p className={cn(SECTION_CAPTION, "m-0")}>
              Per-day outcomes ({total} total)
            </p>
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Day</TableHeader>
                  <TableHeader>Total</TableHeader>
                  {CATEGORIES.map((c) => (
                    <TableHeader key={c.key}>{c.label}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {days.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="ct-metric-value font-mono">{d.date}</TableCell>
                    <TableCell className="text-right tabular-nums ct-metric-value">{d.total}</TableCell>
                    {CATEGORIES.map((c) => (
                      <TableCell key={c.key} className="text-right tabular-nums ct-metric-caption">
                        {d[c.key] > 0 ? d[c.key] : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Horizon totals — share-of-decisions with a token-only bar. */}
            <p className={cn(SECTION_CAPTION, "m-0")}>Horizon totals</p>
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Outcome</TableHeader>
                  <TableHeader>Share</TableHeader>
                  <TableHeader>%</TableHeader>
                  <TableHeader>Count</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {CATEGORIES.map((c) => {
                  const value = totals[c.key];
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <TableRow key={c.key} data-tone={c.tone === "neutral" ? undefined : c.tone}>
                      <TableCell className="ct-metric-value">
                        <BentoBadge variant={toneToVariant(c.tone)}>{c.label}</BentoBadge>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-right tabular-nums ct-metric-value">{pct}%</TableCell>
                      <TableCell className={cn("text-right tabular-nums", FAINT)}>{value}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </details>
  );
}
