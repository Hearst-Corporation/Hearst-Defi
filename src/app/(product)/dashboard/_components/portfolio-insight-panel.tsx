import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { AssetIcon } from "@/features/investor-ui/components/asset-icon";
import type { AiExpertResolvedViewModel } from "@/features/investor-ui/types";
import { AI_EXPERT_ROLES } from "@/features/investor-ui/fixtures/ai-expert-complete";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";

export function PortfolioInsightPanel({
  aiExperts,
  variant = "portfolio",
}: {
  aiExperts: AiExpertResolvedViewModel;
  variant?: "portfolio" | "bitcoin";
}) {
  if (aiExperts.status === "UNAVAILABLE" || aiExperts.status === "ERROR") {
    return (
      <Card className="w-full p-[var(--ct-space-5)]">
        <DataUnavailable label="Portfolio insight" />
      </Card>
    );
  }

  const primary = AI_EXPERT_ROLES.find((e) => e.state === "active") ?? AI_EXPERT_ROLES[0];
  const insight = primary?.lastInsight ?? "Bitcoin accumulation remains on plan.";
  const title = variant === "bitcoin" ? "Bitcoin Reserve Analyst" : "Portfolio insight";
  const isBtc = variant === "bitcoin";

  return (
    <Card
      className={`w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-4)] bg-[var(--ct-surface-raised)] ${
        isBtc ? "border-l-[3px] border-l-[var(--ct-asset-btc-border)]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          {isBtc ? <AssetIcon variant="btc" size="sm" /> : null}
          <span className="stat-label ct-text-muted">{title}</span>
        </div>
        <ProvenanceBadge kind="estimated" variant="compact" description="Advisory only — no autonomous action." />
      </div>

      <blockquote className="body-sm ct-text-body m-0 italic border-l-2 border-[var(--ct-asset-btc-border)] pl-[var(--ct-space-3)]">
        &ldquo;{insight}&rdquo;
      </blockquote>

      <div className="flex flex-col gap-[var(--ct-space-3)] pt-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)]">
        <div className="flex justify-between items-center body-xs">
          <span className="ct-text-muted">{primary?.role ?? "AI Strategist"}</span>
          <span className="ct-text-faint">Just now</span>
        </div>
        <CockpitButton href="?chat=open" variant="secondary" shape="rect" size="lg" className="w-full justify-center">
          Ask the strategist
        </CockpitButton>
      </div>
    </Card>
  );
}
