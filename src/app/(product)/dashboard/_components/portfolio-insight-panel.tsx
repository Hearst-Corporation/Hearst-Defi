import { Card } from "@/components/catalyst/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Button } from "@/components/catalyst/button";
import type { AiExpertResolvedViewModel } from "@/features/investor-ui/types";
import { AI_EXPERT_ROLES } from "@/features/investor-ui/fixtures/ai-expert-complete";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";
import Link from "next/link";
import { Sparkles } from "lucide-react";

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

  return (
    <Card className="w-full flex flex-col p-[var(--ct-space-5)] gap-[var(--ct-space-5)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <Sparkles size={16} className="ct-text-accent" />
          <span className="stat-label ct-text-muted">{title}</span>
        </div>
        <ProvenanceBadge kind="estimated" variant="compact" description="Advisory only — no autonomous action." />
      </div>

      <div className="flex-1 flex flex-col justify-center py-[var(--ct-space-2)]">
        <blockquote className="body-sm ct-text-body m-0 italic border-l-2 border-[var(--ct-border-soft)] pl-[var(--ct-space-3)]">
          "{insight}"
        </blockquote>
      </div>

      <div className="flex flex-col gap-[var(--ct-space-3)] mt-auto pt-[var(--ct-space-4)] border-t border-[var(--ct-border-soft)]">
        <div className="flex justify-between items-center body-xs">
          <span className="ct-text-muted">{primary?.role ?? "AI Strategist"}</span>
          <span className="ct-text-faint">Just now</span>
        </div>
        <Button href="?chat=open" color="zinc" className="w-full justify-center">
          Ask the strategist
        </Button>
      </div>
    </Card>
  );
}
