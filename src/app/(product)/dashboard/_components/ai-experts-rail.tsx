// AI Experts — contextual advisory, NOT a grid of profile cards and NOT a
// persistent 280-320px column (PROMPT 225: it read as "a second product").
// Demoted to a compact, full-width, collapsible advisory strip: the single
// freshest ACTIVE insight is always visible in the summary; the other experts
// open on click (native <details>, zero JS → stays a Server Component).
// STATIC, read-only artifact list — no chat widget, no "ask the AI" input, no
// autonomously-executed action (CLAUDE.md non-negotiable #4; ADR-012/ADR-017).

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

  // Primary insight = first active expert, else the first in the roster.
  const primary = AI_EXPERT_ROLES.find((e) => e.state === "active") ?? AI_EXPERT_ROLES[0];
  const secondaryCount = AI_EXPERT_ROLES.length - 1;

  return (
    <Card className="p-0">
      <details className="group ct-ai-advisory">
        <summary className="flex cursor-pointer list-none items-center gap-[var(--ct-space-3)] p-[var(--ct-space-5)] [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${primary?.state === "active" ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]"}`}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-[var(--ct-space-0_5)]">
            <span className="flex items-center gap-[var(--ct-space-2)]">
              <span className="stat-label ct-text-muted">AI Experts — advisory</span>
              <ProvenanceBadge kind="estimated" variant="compact" description="Advisory signal — never an autonomous action." />
            </span>
            {primary ? (
              <span className="min-w-0 truncate body-xs ct-text-body">
                <span className="font-semibold ct-text-strong">{primary.role}:</span> {primary.lastInsight}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 body-xs ct-text-faint group-open:hidden">+{secondaryCount} experts</span>
          <span
            aria-hidden
            className="shrink-0 ct-text-muted transition-transform duration-150 group-open:rotate-180"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </summary>

        <ul className="m-0 grid list-none grid-cols-1 gap-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)] p-[var(--ct-space-5)] sm:grid-cols-2 lg:grid-cols-3">
          {AI_EXPERT_ROLES.map((expert) => (
            <li key={expert.id} className="flex min-w-0 flex-col gap-[var(--ct-space-1_5)]">
              <div className="flex items-center justify-between gap-[var(--ct-space-2)]">
                <span className="body-sm font-semibold ct-text-strong">{expert.role}</span>
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${expert.state === "active" ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]"}`}
                />
              </div>
              <span className="body-xs ct-text-muted">{expert.specialty}</span>
              <p className="body-xs ct-text-body m-0">{expert.lastInsight}</p>
              <span className="body-xs ct-text-faint">{expert.freshness}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
