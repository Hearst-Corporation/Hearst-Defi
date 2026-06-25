// Admin · Agentic Control Tower — Command Summary (hero, presentational).
//
// READ-ONLY. The first thing an admin sees: overall health, the platform's
// headline numbers (autonomous / gated / forbidden / agents / crews), a plain
// statement that nothing executes here, and any attention items. No card wall,
// no jargon. Pure component; all data passed in, unit-testable via SSR.

import type { TowerSummary } from "@/lib/agentic/system-map/tower-summary";

const HEALTH_LABEL: Record<TowerSummary["health"], string> = {
  healthy: "All clear",
  watch: "Watch",
  alert: "Needs attention",
  no_data: "Limited data",
};

const TONE_CLASS: Record<string, string> = {
  accent: "agentic-metric--accent",
  success: "agentic-metric--success",
  warning: "agentic-metric--warning",
  danger: "agentic-metric--danger",
  neutral: "agentic-metric--neutral",
};

export function AgenticCommandSummary({
  summary,
}: {
  summary: TowerSummary | null | undefined;
}) {
  if (!summary) return null;
  const { health, headline, metrics, attention } = summary;

  return (
    <header className="agentic-hero" data-health={health} aria-label="Agentic command summary">
      <div className="agentic-hero-head">
        <span className="eyebrow ct-text-muted">Agentic Control Tower</span>
        <div className="agentic-hero-title-row">
          <h1 className="agentic-hero-title m-0">Agentic platform</h1>
          <span className="agentic-hero-health" data-health={health}>
            <span className="agentic-hero-health-dot" data-health={health} aria-hidden />
            {HEALTH_LABEL[health]}
          </span>
        </div>
        <p className="body-md ct-text-muted agentic-hero-lede">{headline}</p>
      </div>

      <div className="agentic-hero-metrics">
        {metrics.map((m) => (
          <div key={m.id} className={`agentic-metric ${TONE_CLASS[m.tone] ?? ""}`}>
            <span className="agentic-metric-value tabular-nums">{m.value}</span>
            <span className="agentic-metric-label">{m.label}</span>
            <span className="agentic-metric-hint ct-text-faint">{m.hint}</span>
          </div>
        ))}
      </div>

      {attention.length > 0 && (
        <ul className="agentic-hero-attention" aria-label="Attention items">
          {attention.map((a) => (
            <li key={a} className="agentic-hero-attention-item">
              <span className="agentic-hero-attention-dot" aria-hidden />
              <span className="body-sm ct-text-body">{a}</span>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
