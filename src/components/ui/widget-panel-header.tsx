"use client";

import type { ReactNode } from "react";

import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { useSectionEmbed } from "@/components/ui/section-embed";
import { cn } from "@/lib/cn";

export function WidgetPanelHeader({
  title,
  subtitle,
  provenance,
  trailing,
  className,
}: {
  title: ReactNode;
  subtitle?: string;
  provenance?: Provenance;
  trailing?: ReactNode;
  className?: string;
}) {
  const embedded = useSectionEmbed();
  if (embedded) return null;

  return (
    <header
      className={cn(
        "widget-panel-header dashboard-card-header relative z-10",
        className,
      )}
    >
      <div className="min-w-0">
        {typeof title === "string" ? (
          <h3 className="h3 ct-text-strong">{title}</h3>
        ) : (
          title
        )}
        {subtitle ? (
          <p className="body-xs ct-text-muted mono mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        {trailing}
        {provenance ? <ProvenanceBadge kind={provenance} compact /> : null}
      </div>
    </header>
  );
}
