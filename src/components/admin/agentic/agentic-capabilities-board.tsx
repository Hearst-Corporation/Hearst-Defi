// Admin · Agentic Control Tower — Capabilities (presentational).
//
// READ-ONLY. Rewritten 2026-06-26: "what can the platform do, and how safely?"
// as one row per autonomy tier in a collapsible table (count · tier · meaning),
// not four cards. The per-action detail lives once in Actions & Gates below.
// No hardcoded values. Pure component.

import { AgenticGroup, AgenticTag, type AgenticTone } from "@/components/admin/agentic/agentic-group";
import type { ActionReadinessMatrix, ActionReadinessTier } from "@/lib/agentic/action-readiness/types";

interface Capability {
  tier: ActionReadinessTier;
  title: string;
  meaning: string;
  tone: AgenticTone;
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
    <AgenticGroup
      id="capabilities"
      title="Capabilities"
      count={CAPABILITIES.length}
      note="What the platform can do, by how much human oversight it needs."
    >
      <table className="agentic-table">
        <thead>
          <tr>
            <th className="agentic-cell-num">Count</th>
            <th>Tier</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {CAPABILITIES.map((c) => {
            const count = matrix.items.filter((i) => i.tier === c.tier).length;
            return (
              <tr key={c.tier} data-tone={c.tone}>
                <td className="agentic-cell-num agentic-cell-strong">{count}</td>
                <td>
                  <AgenticTag tone={c.tone}>{c.title}</AgenticTag>
                </td>
                <td className="agentic-cell-muted">{c.meaning}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AgenticGroup>
  );
}
