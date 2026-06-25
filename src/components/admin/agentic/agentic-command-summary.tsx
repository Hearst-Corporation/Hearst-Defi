// Admin · Agentic Control Tower — Command Summary (hero, presentational).
//
// READ-ONLY. First thing visible: platform health status, 5 key metrics, and
// any attention items. Tight and premium — no prose, no jargon. Pure component.

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { TowerSummary } from "@/lib/agentic/system-map/tower-summary";

const HEALTH_LABEL: Record<TowerSummary["health"], string> = {
  healthy: "All clear",
  watch: "Watch",
  alert: "Needs attention",
  no_data: "Limited data",
};

const HEALTH_BADGE_VARIANT: Record<TowerSummary["health"], BadgeVariant> = {
  healthy: "success",
  watch: "warning",
  alert: "danger",
  no_data: "default",
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
  const { health, metrics, attention } = summary;

  return (
    <header className="agentic-hero" data-health={health} aria-label="Agentic command summary">
      <div className="agentic-hero-head">
        <span className="eyebrow ct-text-muted">Agentic Control Tower</span>
        <div className="agentic-hero-title-row">
          <h1 className="agentic-hero-title m-0">Agentic platform</h1>
          <Badge variant={HEALTH_BADGE_VARIANT[health]}>{HEALTH_LABEL[health]}</Badge>
        </div>
      </div>

      <div className="agentic-hero-metrics">
        {metrics.map((m) => (
          <div key={m.id} className={`agentic-metric ${TONE_CLASS[m.tone] ?? ""}`}>
            <span className="agentic-metric-value tabular-nums">{m.value}</span>
            <span className="agentic-metric-label">{m.label}</span>
            {m.hint && <span className="agentic-metric-hint ct-text-muted">{m.hint}</span>}
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
