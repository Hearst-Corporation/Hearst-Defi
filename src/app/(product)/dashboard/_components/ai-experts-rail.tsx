// AI Experts rail — contextual advisory panel, NOT a grid of profile cards.
// Each role carries role/specialty/last-insight/freshness/state. STATIC,
// read-only artifact list — no chat widget, no "ask the AI" input, no
// autonomously-executed action (CLAUDE.md non-negotiable #4 / forbidden list:
// "no chat interfaces"; ADR-012/ADR-017). Mirrors the precedent set by
// `btc/_components/btc-ai-experts-rail.tsx` (A3).

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

import type { AiExpertResolvedViewModel } from "@/features/investor-ui/types";
import { AI_EXPERT_ROLES } from "@/features/investor-ui/fixtures/ai-expert-complete";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";

export function AiExpertsRail({ aiExperts }: { aiExperts: AiExpertResolvedViewModel }) {
  if (aiExperts.status === "UNAVAILABLE" || aiExperts.status === "ERROR") {
    return (
      <Card className="flex flex-col gap-[var(--ct-space-3)] p-[var(--ct-space-5)]">
        <span className="stat-label ct-text-muted">AI Experts</span>
        <DataUnavailable label="Advisory panel" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]">
      <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
        <span className="stat-label ct-text-muted">AI Experts — advisory</span>
        <ProvenanceBadge kind="estimated" variant="compact" description="Advisory signal — never an autonomous action." />
      </div>

      <ul className="flex flex-col gap-[var(--ct-space-4)] m-0 list-none p-0">
        {AI_EXPERT_ROLES.map((expert) => (
          <li
            key={expert.id}
            className="flex flex-col gap-[var(--ct-space-1_5)] border-b border-[var(--ct-border-soft)] pb-[var(--ct-space-4)] last:border-b-0 last:pb-0"
          >
            <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
              <span className="body-sm font-semibold ct-text-strong">{expert.role}</span>
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${expert.state === "active" ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]"}`}
              />
            </div>
            <span className="body-xs ct-text-muted">{expert.specialty}</span>
            <p className="body-xs ct-text-body m-0">{expert.lastInsight}</p>
            <span className="body-xs ct-text-faint">{expert.freshness}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
