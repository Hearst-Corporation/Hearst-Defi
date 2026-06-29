// Admin · Agentic Control Tower — Status line (presentational).
//
// READ-ONLY. Replaces the hero box with a single dense status LINE: health on
// the left, the headline metrics as inline value/label facts, and any attention
// items as tight warning lines below. No box grid, no hardcoded values — every
// token is var(--ct-*). Pure component.
//
// Canon migration (Mission #064): the bespoke `agentic-statusline*` /
// `agentic-attention*` classes are inlined into tokenised Tailwind utilities
// (still 100% --ct-* tokens, no new chrome). Tone → text-colour mapping below.

import type { TowerSummary } from "@/lib/agentic/system-map/tower-summary";
import { cn } from "@/lib/cn";

const HEALTH_LABEL: Record<TowerSummary["health"], string> = {
  healthy: "All clear",
  watch: "Watch",
  alert: "Needs attention",
  no_data: "Limited data",
};

type FactTone = "success" | "warning" | "danger" | "accent" | "neutral";

const HEALTH_TONE: Record<TowerSummary["health"], FactTone> = {
  healthy: "success",
  watch: "warning",
  alert: "danger",
  no_data: "neutral",
};

// Tone → fact-value text colour (token-only). `neutral`/undefined keep the
// default strong text colour from the base value class.
const FACT_TONE_CLASS: Record<Exclude<FactTone, "neutral">, string> = {
  success: "text-[var(--ct-status-success)]",
  warning: "text-[var(--ct-status-warning)]",
  danger: "text-[var(--ct-status-danger)]",
  accent: "text-[var(--ct-accent)]",
};

const FACT_VALUE_BASE =
  "text-[length:var(--ct-text-base)] font-bold tabular-nums tracking-tight text-[var(--ct-text-strong)]";
const FACT_LABEL =
  "text-[length:var(--ct-text-micro)] uppercase tracking-wider text-[var(--ct-text-muted)]";

function factValueClass(tone: FactTone | undefined): string {
  if (!tone || tone === "neutral") return FACT_VALUE_BASE;
  return cn(FACT_VALUE_BASE, FACT_TONE_CLASS[tone]);
}

export function AgenticStatusLine({
  summary,
}: {
  summary: TowerSummary | null | undefined;
}) {
  if (!summary) return null;
  const { health, metrics, attention } = summary;

  return (
    <div className="flex flex-col gap-[var(--ct-space-2)]">
      <header
        className="flex flex-wrap items-center gap-x-4 gap-y-2"
        data-health={health}
        aria-label="Agentic command summary"
      >
        <span className="mr-auto inline-flex items-baseline gap-2">
          <span className={factValueClass(HEALTH_TONE[health])}>
            {HEALTH_LABEL[health]}
          </span>
          <span className={FACT_LABEL}>platform</span>
        </span>

        {metrics.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-baseline gap-1.5 whitespace-nowrap"
            title={m.hint}
          >
            <span
              className={factValueClass(
                m.tone === "neutral" ? undefined : (m.tone as FactTone),
              )}
            >
              {m.value}
            </span>
            <span className={FACT_LABEL}>{m.label}</span>
          </span>
        ))}
      </header>

      {attention.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Attention items">
          {attention.map((a) => (
            <li
              key={a}
              className="flex items-start gap-2 rounded-sm border-l-2 border-[var(--ct-status-warning)] bg-[var(--ct-status-warning-soft)] px-3 py-1.5 text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]"
            >
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
