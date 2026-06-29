// Admin · Agentic Control Tower — Router Observability (presentational).
//
// READ-ONLY. Rewritten 2026-06-26 to fit the line/table console: a collapsible
// group with an inline status + window selector, the stat counters as a facts
// line, and the recent decisions as the shared dense table. No box grids, no
// hardcoded values, honest empty/unavailable lines. Pure component.
//
// Canon migration (Mission #064): bespoke `agentic-tag` → BentoBadge, the
// `agentic-table` → Catalyst dense Table, the `agentic-cell-*` helpers and the
// `agentic-statusline` facts-line → tokenised Tailwind utilities. The
// `ObservabilityWindowSelector` keeps `.ct-pill` (already tokenised) — left as-is.

import Link from "next/link";
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
import { RouterObservabilityTrends } from "@/components/admin/agentic/router-observability-trends";
import { RouterObservabilityLongTerm } from "@/components/admin/agentic/router-observability-longterm";
import { RouterQualityReview } from "@/components/admin/agentic/router-quality-review";
import type {
  RouterDecisionTrace,
  RouterObservabilityAggregationMode,
  RouterObservabilitySummary,
  RouterObservabilityStorage,
  RouterObservabilityWindow,
} from "@/lib/agentic/observability/types";

/** Maps the legacy AgenticTone scale onto the canon BentoBadge variant scale. */
function toneToVariant(tone: AgenticTone | undefined): BentoBadgeVariant {
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

/** Tone → fact-value text colour (token-only) for the counters line. */
const FACT_TONE_CLASS: Record<"success" | "warning" | "danger" | "accent", string> = {
  success: "text-[var(--ct-status-success)]",
  warning: "text-[var(--ct-status-warning)]",
  danger: "text-[var(--ct-status-danger)]",
  accent: "text-[var(--ct-accent)]",
};

const FACT_VALUE_BASE =
  "text-[length:var(--ct-text-base)] font-bold tabular-nums tracking-tight text-[var(--ct-text-strong)]";
const FACT_LABEL =
  "text-[length:var(--ct-text-micro)] uppercase tracking-wider text-[var(--ct-text-muted)]";

function factValueClass(tone: AgenticTone | undefined): string {
  if (tone === "success" || tone === "warning" || tone === "danger" || tone === "accent") {
    return cn(FACT_VALUE_BASE, FACT_TONE_CLASS[tone]);
  }
  return FACT_VALUE_BASE;
}

const FAINT = "text-[var(--ct-text-faint)]";
const SECTION_CAPTION = "text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]";
const EMPTY_LINE = "text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]";

const OUTCOME_LABEL: Record<string, string> = {
  nav_fast_path: "nav fast-path",
  negated_no_nav: "negated",
  dangerous_refusal: "refusal",
  educational_llm: "educational",
  normal_llm: "normal",
  legacy_fallback_nav: "fallback nav",
  unknown: "unknown",
};

function outcomeTone(outcome: string): AgenticTone {
  switch (outcome) {
    case "nav_fast_path":
    case "educational_llm":
      return "success";
    case "dangerous_refusal":
      return "danger";
    case "negated_no_nav":
    case "legacy_fallback_nav":
      return "warning";
    default:
      return "neutral";
  }
}

const WINDOWS: { value: RouterObservabilityWindow; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const STORAGE_LABEL: Record<RouterObservabilityStorage, string> = {
  durable: "durable",
  redis_fallback: "redis fallback",
  memory_fallback: "memory fallback",
  unavailable: "unavailable",
};

function storageTone(storage: RouterObservabilityStorage): AgenticTone {
  if (storage === "durable") return "success";
  if (storage === "unavailable") return "danger";
  return "warning";
}

const AGGREGATION_LABEL: Record<RouterObservabilityAggregationMode, string> = {
  sql: "SQL aggregates",
  in_memory: "in-memory fallback",
  fallback: "in-memory fallback",
};

/** Time-window pill selector — exported so the canon section card can host it
 *  in its header trailing slot (the section body itself is now frameless). */
export function ObservabilityWindowSelector({
  current,
}: {
  current: RouterObservabilityWindow;
}) {
  return (
    <span className="agentic-windowbar" role="group" aria-label="Time window">
      {WINDOWS.map((w) => (
        <Link
          key={w.value}
          href={`?routerWindow=${w.value}`}
          aria-current={w.value === current ? "true" : undefined}
          className={cn("ct-pill body-xs", w.value === current ? "accent" : "ct-text-muted")}
        >
          {w.label}
        </Link>
      ))}
    </span>
  );
}

function shortTime(iso: string): string {
  const t = iso.includes("T") ? iso.split("T")[1] : iso;
  return t ? t.replace("Z", "").slice(0, 8) : iso;
}

function DecisionRow({ trace }: { trace: RouterDecisionTrace }) {
  return (
    <TableRow>
      <TableCell className={cn(FAINT, "tabular-nums whitespace-nowrap")}>
        {shortTime(trace.createdAt)}
      </TableCell>
      <TableCell className="ct-metric-value">{trace.kind}</TableCell>
      <TableCell className="ct-metric-caption">{trace.actionPolicy}</TableCell>
      <TableCell className="whitespace-nowrap">
        <BentoBadge variant={toneToVariant(outcomeTone(trace.outcome))}>
          {OUTCOME_LABEL[trace.outcome] ?? trace.outcome}
        </BentoBadge>
        {trace.negated && <span className={FAINT}> · negated</span>}
      </TableCell>
      <TableCell className="ct-metric-caption tabular-nums">
        {typeof trace.confidence === "number" ? trace.confidence.toFixed(2) : "—"}
      </TableCell>
      <TableCell className="ct-metric-caption font-mono">{trace.routeKey ?? "—"}</TableCell>
    </TableRow>
  );
}

export function RouterObservabilitySection({
  summary,
}: {
  summary: RouterObservabilitySummary | null;
}) {
  if (!summary || summary.state === "unavailable") {
    return (
      <div id="router-observability" className="agentic-group-body min-w-0 border-t-0 p-5">
        <p className={cn(SECTION_CAPTION, "m-0")}>
          <BentoBadge variant="danger">unavailable</BentoBadge>
        </p>
        <p className={cn(EMPTY_LINE, "m-0")}>
          Router trace storage is unavailable. Router behaviour is unaffected.
        </p>
      </div>
    );
  }

  const {
    state,
    storage,
    recent,
    stats,
    privacyMode,
    retentionNote,
    window: activeWindow,
    retentionPolicyNote,
    windowLimitationNote,
    aggregationMode,
  } = summary;

  const facts: { id: string; label: string; value: number; tone?: AgenticTone }[] = [
    { id: "total", label: "Decisions", value: stats.total },
    { id: "nav", label: "Nav fast-paths", value: stats.navigationFastPaths, tone: "success" },
    { id: "refusal", label: "Dangerous refusals", value: stats.dangerousRefusals, tone: "danger" },
    { id: "edu", label: "Educational", value: stats.educationalTurns, tone: "success" },
    { id: "negated", label: "Negated", value: stats.negatedNoNav, tone: "warning" },
    {
      id: "normal",
      label: "Normal / unknown",
      value: (stats.byOutcome.normal_llm ?? 0) + (stats.byOutcome.unknown ?? 0),
    },
  ];

  return (
    <div
      id="router-observability"
      className="agentic-group-body flex min-w-0 flex-col gap-3 border-t-0 p-5"
    >
      {/* Status strip — inline badges, one line. */}
      <p className={SECTION_CAPTION}>
        <BentoBadge variant={toneToVariant(state === "enabled" ? "success" : "neutral")}>
          {state}
        </BentoBadge>{" "}
        <BentoBadge variant={toneToVariant(storageTone(storage))}>
          {storage === "durable" && activeWindow === "30d" ? "durable 30d" : STORAGE_LABEL[storage]}
        </BentoBadge>{" "}
        {aggregationMode && aggregationMode !== "sql" && (
          <BentoBadge variant="warning">{AGGREGATION_LABEL[aggregationMode]}</BentoBadge>
        )}{" "}
        <span className={FAINT}>
          {privacyMode}
          {retentionNote ? ` · ${retentionNote}` : ""}
          {windowLimitationNote ? ` · ${windowLimitationNote}` : ""}
          {retentionPolicyNote ? ` · ${retentionPolicyNote}` : ""}
        </span>
      </p>

      {/* Counters as a facts line. */}
      <header
        className="flex flex-wrap items-center gap-x-4 gap-y-2"
        aria-label="Observability counters"
      >
        {facts.map((f) => (
          <span key={f.id} className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            <span className={factValueClass(f.tone)}>{f.value}</span>
            <span className={FACT_LABEL}>{f.label}</span>
          </span>
        ))}
      </header>

      {/* Recent decisions — shared dense table (canon Catalyst). */}
      {state === "empty" || recent.length === 0 ? (
        <p className={cn(EMPTY_LINE, "m-0")}>
          No router traces in this window. Send chat traffic or widen the window.
        </p>
      ) : (
        <Table dense>
          <TableHead>
            <TableRow>
              {["Time", "Kind", "Policy", "Outcome", "Conf.", "Route"].map((h) => (
                <TableHeader key={h}>{h}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {recent.map((t) => (
              <DecisionRow key={t.id} trace={t} />
            ))}
          </TableBody>
        </Table>
      )}

      {state === "enabled" && recent.length > 0 && (
        <RouterObservabilityTrends
          window={summary.trendWindow}
          buckets={summary.trendBuckets}
          topMatchedRules={summary.topMatchedRules}
          bufferLimitNote={summary.bufferLimitNote}
        />
      )}

      <RouterQualityReview review={summary.qualityReview} />

      {summary.longTerm && <RouterObservabilityLongTerm longTerm={summary.longTerm} />}
    </div>
  );
}
