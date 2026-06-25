// Admin · Agentic Control Tower — Capabilities Board (presentational).
//
// READ-ONLY. Answers "what can the platform do, and how safely?" in four clear
// capability columns: Autonomous today (read-only), Draft / proposal only,
// Confirmed write (gated), Never autonomous. Product language — no jargon, no
// per-item card wall. Pure component; data passed in, SSR-testable.

import type { ActionReadinessMatrix, ActionReadinessTier } from "@/lib/agentic/action-readiness/types";

interface Capability {
  tier: ActionReadinessTier;
  title: string;
  /** Plain-language description of how safe this tier is. */
  meaning: string;
  tone: "success" | "warning" | "danger";
}

const CAPABILITIES: Capability[] = [
  {
    tier: "read_only",
    title: "Autonomous",
    meaning: "Reads only — safe to run without human review.",
    tone: "success",
  },
  {
    tier: "draft_or_proposal",
    title: "Draft only",
    meaning: "Agent prepares; human must confirm before anything sends.",
    tone: "warning",
  },
  {
    tier: "confirmed_write",
    title: "Gated write",
    meaning: "Explicit 2-step human confirmation required.",
    tone: "warning",
  },
  {
    tier: "forbidden_autonomous",
    title: "Never autonomous",
    meaning: "Deploy, mark-live, signatures, migrations — always blocked.",
    tone: "danger",
  },
];

export function AgenticCapabilitiesBoard({
  matrix,
}: {
  matrix: ActionReadinessMatrix | null | undefined;
}) {
  if (!matrix) return null;

  return (
    <section id="capabilities" className="agentic-stack" aria-label="Agentic capabilities">
      <div className="agentic-section-head">
        <h2 className="agentic-section-title m-0">Capabilities</h2>
        <p className="body-sm ct-text-muted m-0">
          What the platform can do, by how much human oversight it needs.
        </p>
      </div>

      <div className="agentic-capability-grid">
        {CAPABILITIES.map((c) => {
          const items = matrix.items.filter((i) => i.tier === c.tier);
          return (
            <div key={c.tier} className="agentic-capability" data-tone={c.tone}>
              <div className="agentic-capability-head">
                <span className="agentic-capability-count tabular-nums">{items.length}</span>
                <span className="agentic-capability-title">{c.title}</span>
              </div>
              <p className="body-xs ct-text-muted m-0">{c.meaning}</p>
              <ul className="agentic-capability-items">
                {items.map((i) => (
                  <li key={i.id} className="agentic-capability-item">
                    {i.label}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
