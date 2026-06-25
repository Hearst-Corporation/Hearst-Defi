// Admin · Agentic Control Tower — Safety Boundary (presentational).
//
// READ-ONLY. The single place that states the platform's hard limits in plain
// language: nothing executes from this console, what is forbidden-autonomous,
// what human gates exist, and that the compliance guards are always on. No write
// controls. Pure component; data passed in, SSR-testable.

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { ActionReadinessMatrix } from "@/lib/agentic/action-readiness/types";

export function AgenticSafetyBoundary({
  controlCenter,
  matrix,
}: {
  controlCenter: AgenticControlCenterData | null | undefined;
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!controlCenter) return null;

  const guards = controlCenter.inventory.filter((i) => i.type === "guard");
  const gates = controlCenter.gates;
  const forbidden = matrix?.items.filter((i) => i.tier === "forbidden_autonomous") ?? [];
  const safetyHolds = controlCenter.safetySummary.filter((s) => s.holds).length;
  const safetyTotal = controlCenter.safetySummary.length;

  return (
    <section id="safety-boundary" className="agentic-stack" aria-label="Safety boundary">
      <div className="agentic-section-head">
        <h2 className="agentic-section-title m-0">Safety Boundary</h2>
        <p className="body-sm ct-text-muted m-0">
          The hard limits. This console only observes — it cannot run a tool or
          perform a write. Every write an agent could prepare is gated, and the
          most dangerous actions can never be autonomous.
        </p>
      </div>

      <div className="agentic-safety-grid">
        <div className="agentic-safety-pillar" data-tone="success">
          <span className="agentic-safety-eyebrow">Console</span>
          <span className="agentic-safety-headline">Nothing executes here</span>
          <p className="body-xs ct-text-muted m-0">
            Read-only views only. No run, send, deploy, source, or mark-live control
            exists on this page.
          </p>
        </div>

        <div className="agentic-safety-pillar" data-tone="danger">
          <span className="agentic-safety-eyebrow">Forbidden</span>
          <span className="agentic-safety-headline tabular-nums">
            {forbidden.length} never autonomous
          </span>
          <ul className="agentic-safety-list">
            {forbidden.slice(0, 8).map((f) => (
              <li key={f.id} className="agentic-safety-item">
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="agentic-safety-pillar" data-tone="warning">
          <span className="agentic-safety-eyebrow">Human gates</span>
          <span className="agentic-safety-headline tabular-nums">
            {gates.length} gated actions
          </span>
          <p className="body-xs ct-text-muted m-0">
            Critical actions require a human: admin role, a two-step confirmation
            token, and never autonomous execution.
          </p>
        </div>

        <div className="agentic-safety-pillar" data-tone="success">
          <span className="agentic-safety-eyebrow">Guards</span>
          <span className="agentic-safety-headline tabular-nums">
            {guards.length} always-on guards
          </span>
          <ul className="agentic-safety-list">
            {guards.map((g) => (
              <li key={g.id} className="agentic-safety-item">
                {g.name}
              </li>
            ))}
          </ul>
          <p className="body-xs ct-text-faint m-0">
            {safetyHolds}/{safetyTotal} safety guarantees verified.
          </p>
        </div>
      </div>
    </section>
  );
}
