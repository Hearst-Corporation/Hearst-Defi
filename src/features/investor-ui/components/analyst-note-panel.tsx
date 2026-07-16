// Shared Analyst Note panel (D6) — compact replacement for the retired
// PortfolioInsightPanel. Honesty upgrades vs the original:
//  - consumes the AiExpertViewModel aggregate (lastSignalSummary as the
//    quote, lastSignalAt as a REAL formatted timestamp, activeExperts
//    surfaced) instead of bypassing it;
//  - NO hard-coded "Just now": the timestamp renders only when the view
//    model carries one;
//  - falls back to the AI_EXPERT_ROLES fixture insight ONLY when the view
//    model exposes no summary — and then without any fabricated timestamp;
//  - provenance via the unified toProvenance mapping, advisory tooltip kept.
// Advisory only — no autonomous action (ADR-012 / ADR-017).

import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { AskStrategistButton } from "@/features/investor-ui/components/ask-strategist-button";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import type { AiExpertResolvedViewModel } from "@/features/investor-ui/types";
import { AI_EXPERT_ROLES } from "@/features/investor-ui/fixtures/ai-expert-complete";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import { toProvenance, formatIsoDateTime } from "@/features/investor-ui/format-btc";

const VARIANT_META = {
  portfolio: {
    title: "Portfolio insight",
    roleId: "portfolio-strategist",
    fallbackRole: "AI Strategist",
  },
  bitcoin: {
    title: "Bitcoin Reserve Analyst",
    roleId: "btc-reserve-analyst",
    fallbackRole: "BTC Reserve Analyst",
  },
} as const;

export interface AnalystNotePanelProps {
  aiExperts: AiExpertResolvedViewModel;
  variant?: keyof typeof VARIANT_META;
}

export function AnalystNotePanel({ aiExperts, variant = "portfolio" }: AnalystNotePanelProps) {
  const meta = VARIANT_META[variant];
  const isBtc = variant === "bitcoin";

  if (aiExperts.status === "UNAVAILABLE" || aiExperts.status === "ERROR" || aiExperts.value == null) {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label={meta.title} />
      </Card>
    );
  }

  const vm = aiExperts.value;
  const role =
    AI_EXPERT_ROLES.find((e) => e.id === meta.roleId) ??
    AI_EXPERT_ROLES.find((e) => e.state === "active") ??
    AI_EXPERT_ROLES[0];

  // View-model summary first; fixture role insight only as a fallback — and
  // then WITHOUT a timestamp (the fixture row carries none we could honestly
  // attach to "last signal").
  const fromViewModel = vm.lastSignalSummary != null && vm.lastSignalSummary.length > 0;
  const insight = fromViewModel ? vm.lastSignalSummary : (role?.lastInsight ?? null);
  const signalAt = fromViewModel && vm.lastSignalAt != null ? formatIsoDateTime(vm.lastSignalAt) : null;

  const quoteBorder = isBtc ? "border-[var(--ct-asset-btc-border)]" : "border-[var(--ct-accent)]";

  return (
    <Card
      className={`w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-4)] ${
        isBtc ? "border-l-[3px] border-l-[var(--ct-asset-btc-border)]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          {isBtc ? <AssetIcon variant="btc" size="sm" /> : null}
          <span className="ct-bento-label">{meta.title}</span>
        </div>
        <ProvenanceBadge
          kind={toProvenance(aiExperts.status)}
          variant="compact"
          description="Advisory only — no autonomous action."
        />
      </div>

      {insight != null ? (
        <blockquote className={`body-sm m-0 italic border-l-2 ${quoteBorder} pl-[var(--ct-space-3)]`}>
          &ldquo;{insight}&rdquo;
        </blockquote>
      ) : (
        <p className="body-sm ct-text-muted m-0">No advisory signal recorded yet.</p>
      )}

      <div className="flex flex-col gap-[var(--ct-space-3)] pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)]">
        <div className="flex flex-wrap justify-between items-center gap-[var(--ct-space-2)] body-xs">
          <span className="body-xs">
            {role?.role ?? meta.fallbackRole}
            {vm.activeExperts != null ? (
              <span className="ct-metric-caption"> · {vm.activeExperts} experts active</span>
            ) : null}
          </span>
          {signalAt != null ? <span className="ct-metric-caption">Signal {signalAt}</span> : null}
        </div>
        <AskStrategistButton
          variant="quiet"
          shape="rect"
          size="lg"
          className="w-full justify-center border border-[var(--ct-border-soft)]"
        >
          Ask the strategist
        </AskStrategistButton>
      </div>
    </Card>
  );
}
