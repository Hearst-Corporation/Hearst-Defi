// src/app/(product)/btc/_components/btc-ai-experts-rail.tsx
//
// Contextual AI Experts rail for the BTC screen. STATIC, read-only artifact
// list — no chat widget, no "ask the AI" input, no autonomously-executed
// action (CLAUDE.md non-negotiable #4 / forbidden list: "no chat interfaces").
// Each entry is an advisory note scoped to this screen's data.

import type { BtcAiExpertViewModel } from "../_data/btc-page-types";

export function BtcAiExpertsRail({ experts }: { experts: readonly BtcAiExpertViewModel[] }) {
  if (experts.length === 0) return null;

  return (
    <ul role="list" className="flex flex-col gap-[var(--ct-space-4)]">
      {experts.map((expert) => (
        <li
          key={expert.id}
          className="flex flex-col gap-[var(--ct-space-1_5)] rounded-[var(--ct-radius-lg)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] p-[var(--ct-space-4)]"
        >
          <div className="flex items-baseline justify-between gap-[var(--ct-space-2)]">
            <span className="body-sm ct-text-strong font-medium">{expert.name}</span>
          </div>
          <span className="ct-metric-caption">{expert.focus}</span>
          <p className="body-xs ct-text-muted m-0">{expert.summary}</p>
        </li>
      ))}
    </ul>
  );
}
