// Admin · Agentic Console (simplified) — Agents section body.
//
// READ-ONLY. Renders the 8 real base agents from AGENT_CATALOG, grouped by
// scope (groupCatalogByScope). Flat HAIRLINE rows — no bordered box, no inset
// cage (the parent AdminSectionCard already owns the frame), no write controls,
// no run buttons. Each row shows label, scope badge, one-line description,
// product surface, and a DERIVED status badge. Same grammar as ProposalQueue.
//
// Cron status is a static INLINE table (AGENT_CRON): it does NOT import the
// Inngest functions (those carry a server-side side effect). It only mirrors the
// batch cron expressions so the console can label the batch agents honestly.

import { BentoBadge } from "@/components/catalyst/bento-badge";
import {
  AGENT_CATALOG,
  groupCatalogByScope,
  type AgentCatalogEntry,
} from "@/lib/agents/agent-catalog";
import type { BaseAgent } from "@/lib/agents/agent-template-constants";

/**
 * Static cron expressions for the scheduled batch agents. Mirrors the Inngest
 * schedules WITHOUT importing the functions (which have server-side side
 * effects). Agents absent from this map that are `batch` run on-demand.
 */
const AGENT_CRON: Partial<Record<BaseAgent, string>> = {
  "mining-health": "0 8 * * *",
  "investor-memo": "0 9 1 * *",
  "risk-explanation": "30 9 * * *",
};

/** Derive the human status label for an agent card from its scope + cron map. */
function statusLabel(entry: AgentCatalogEntry): string {
  if (entry.scope === "chat") return "Chat · live";
  if (entry.scope === "platform") return "Platform";
  // batch
  const cron = AGENT_CRON[entry.baseAgent];
  return cron ? `Batch · cron ${cron}` : "Batch · on-demand";
}

// Flat hairline row — separated by a soft border, tinted on hover, NOT its own
// bordered box (the parent AdminSectionCard already owns the frame). Same
// grammar as ProposalQueue.
const ROW =
  "border-b border-[var(--ct-border-soft)] last:border-0 p-5 transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_3%,transparent)]";

function AgentRow({ entry }: { entry: AgentCatalogEntry }) {
  return (
    <div className={ROW} aria-label={entry.label}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="ct-metric-value min-w-0 truncate text-[var(--ct-text-strong)]">
          {entry.label}
        </h4>
        <BentoBadge variant="default" className="shrink-0">
          {entry.scopeLabel}
        </BentoBadge>
      </div>
      <p className="ct-metric-caption mt-1.5">{entry.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[length:var(--ct-text-micro)] uppercase tracking-wider text-[var(--ct-text-faint)]">
          {entry.surface}
        </span>
        <BentoBadge variant="success">{statusLabel(entry)}</BentoBadge>
      </div>
    </div>
  );
}

export function AgenticAgentsCards() {
  const groups = groupCatalogByScope();

  return (
    <div className="flex min-w-0 flex-col" aria-label="Agents inventory">
      {groups.map((group) => (
        <section key={group.scope} className="flex min-w-0 flex-col">
          <p className="ct-bento-label border-b border-[var(--ct-border-soft)] px-5 pb-2.5 pt-5">
            {group.scopeLabel} · {group.entries.length}
          </p>
          {group.entries.map((entry) => (
            <AgentRow key={entry.baseAgent} entry={entry} />
          ))}
        </section>
      ))}
      <p className="ct-metric-caption m-0 px-5 pb-5 pt-4 text-[var(--ct-text-faint)]">
        {AGENT_CATALOG.length} agents · read-only inventory.
      </p>
    </div>
  );
}
