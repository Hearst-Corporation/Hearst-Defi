import type { ReactNode } from "react";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export function DashboardPanelHeader({
  title,
  eyebrow,
  subtitle,
  provenance,
  trustLabel,
  trailing,
  tone = "quiet",
  titleLevel = "widget",
  id,
  className,
}: {
  title: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  provenance?: Provenance;
  trustLabel?: string;
  trailing?: ReactNode;
  tone?: "primary" | "quiet";
  titleLevel?: "section" | "widget";
  id?: string;
  className?: string;
}) {
  const TitleTag = titleLevel === "section" ? "h2" : "h3";
  const titleRoleClass = titleLevel === "section" ? "h2" : "h3";

  return (
    <header className={cn("dashboard-card-header", className)}>
      <div className="min-w-0 flex flex-col gap-[var(--ct-space-1)]">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {typeof title === "string" ? (
          <TitleTag
            id={id}
            className={cn(
              titleRoleClass,
              "dashboard-panel-title min-w-0 wrap-break-word",
              tone === "primary" && "ct-text-accent",
            )}
          >
            {title}
          </TitleTag>
        ) : (
          title
        )}
        {subtitle ? (
          <p className="body-xs ct-text-tertiary m-0 mono">{subtitle}</p>
        ) : null}
      </div>
      {provenance || trustLabel || trailing ? (
        <div className="flex items-center gap-[var(--ct-space-3)] shrink-0">
          {trailing}
          {trustLabel ? (
            <span className="body-xs ct-text-faint italic hidden sm:inline">
              {trustLabel}
            </span>
          ) : null}
          {provenance ? <ProvenanceBadge kind={provenance} variant="strip" /> : null}
        </div>
      ) : null}
    </header>
  );
}
