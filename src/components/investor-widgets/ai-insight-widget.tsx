// AiInsightWidget — single portfolio insight + strategist actions (drawer/chat).

import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

import type { AiExpertResolvedViewModel } from "@/features/investor-ui/types";
import { AI_EXPERT_ROLES } from "@/features/investor-ui/fixtures/ai-expert-complete";
import { DataUnavailable } from "@/features/investor-ui/components/states/data-states";

interface AiInsightWidgetProps {
  aiExperts: AiExpertResolvedViewModel;
  variant?: "portfolio" | "bitcoin";
  className?: string;
}

const DEFAULT_INSIGHT =
  "Bitcoin accumulation remains on plan. Mining contribution is current and the operating reserve remains healthy.";

export function AiInsightWidget({ aiExperts, variant = "portfolio", className }: AiInsightWidgetProps) {
  if (aiExperts.status === "UNAVAILABLE" || aiExperts.status === "ERROR") {
    return (
      <div className={cn("iw-surface-elevated p-[var(--ct-space-4)]", className)}>
        <DataUnavailable label="Portfolio insight" />
      </div>
    );
  }

  const primary =
    AI_EXPERT_ROLES.find((e) => e.state === "active") ?? AI_EXPERT_ROLES[0];
  const insight = primary?.lastInsight ?? DEFAULT_INSIGHT;
  const title = variant === "bitcoin" ? "Bitcoin Reserve Analyst" : "Portfolio insight";

  return (
    <div className={cn("iw-surface-elevated flex flex-col gap-[var(--ct-space-3)] p-[var(--ct-space-4)]", className)}>
      <div className="flex items-center gap-[var(--ct-space-2)]">
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${primary?.state === "active" ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]"}`}
        />
        <span className="stat-label ct-text-muted">{title}</span>
        <ProvenanceBadge kind="estimated" variant="compact" description="Advisory only — no autonomous action." />
      </div>
      <p className="body-sm ct-text-body m-0">{insight}</p>
      <div className="flex flex-wrap gap-[var(--ct-space-3)]">
        <Link href="?chat=open" className="body-xs ct-link-accent">
          Ask the strategist
        </Link>
        <Link href={variant === "bitcoin" ? "/btc" : "/dashboard"} className="body-xs ct-text-muted hover:ct-text-body">
          View analysis
        </Link>
      </div>
    </div>
  );
}
