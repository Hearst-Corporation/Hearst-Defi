// Admin · Agentic Control Tower — Status line (presentational).
//
// READ-ONLY. Replaces the hero box with a single dense status LINE: health on
// the left, the headline metrics as inline value/label facts, and any attention
// items as tight warning lines below. No box grid, no hardcoded values — every
// token is var(--ct-*). Pure component.

import type { TowerSummary } from "@/lib/agentic/system-map/tower-summary";

const HEALTH_LABEL: Record<TowerSummary["health"], string> = {
  healthy: "All clear",
  watch: "Watch",
  alert: "Needs attention",
  no_data: "Limited data",
};

const HEALTH_TONE: Record<TowerSummary["health"], string> = {
  healthy: "success",
  watch: "warning",
  alert: "danger",
  no_data: "neutral",
};

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
        className="agentic-statusline"
        data-health={health}
        aria-label="Agentic command summary"
      >
        <span className="agentic-statusline-health">
          <span
            className="agentic-statusline-fact-value"
            data-tone={HEALTH_TONE[health]}
          >
            {HEALTH_LABEL[health]}
          </span>
          <span className="agentic-statusline-fact-label">platform</span>
        </span>

        {metrics.map((m) => (
          <span key={m.id} className="agentic-statusline-fact" title={m.hint}>
            <span
              className="agentic-statusline-fact-value"
              data-tone={m.tone === "neutral" ? undefined : m.tone}
            >
              {m.value}
            </span>
            <span className="agentic-statusline-fact-label">{m.label}</span>
          </span>
        ))}
      </header>

      {attention.length > 0 && (
        <ul className="agentic-attention" aria-label="Attention items">
          {attention.map((a) => (
            <li key={a} className="agentic-attention-item">
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
