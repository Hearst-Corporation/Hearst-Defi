// CANON — single-DS convergence.
// This is the canonical source for <DashboardPanelHeader />. The legacy path
// `@/components/ui/dashboard-panel-header` is now a thin re-export façade of this
// module. Token-only (ct-* classes), composes ProvenanceBadge + an inline status
// chip. Edit the primitive here; do not fork the ui/ façade.
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
  status,
  statusTone = "idle",
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
  titleLevel?: "widget" | "section";
  status?: string;
  statusTone?: "ok" | "watch" | "alert" | "idle";
  id?: string;
  className?: string;
}) {
  const TitleTag = titleLevel === "section" ? "h2" : "h3";
  const titleRoleClass = titleLevel === "section" ? "h2" : "h3";

  return (
    <header className={cn("dashboard-card-header items-center", className)}>
      <div className="min-w-0 flex flex-col gap-(--ct-space-1)">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div className="flex items-center gap-(--ct-space-2)">
          {typeof title === "string" ? (
            <TitleTag
              id={id}
              // dashboard-panel-title is a marker class only (no CSS rules) — useful
              // for scoped overrides or querySelector. Functional layout styles
              // (min-w-0, wrap-break-word) are applied directly via Tailwind below.
              className={cn(
                titleRoleClass,
                "dashboard-panel-title min-w-0 wrap-break-word",
                tone === "primary" ? "ct-text-accent" : "ct-text-strong",
              )}
            >
              {title}
            </TitleTag>
          ) : (
            title
          )}
          {status ? (
            <div className="flex items-center gap-(--ct-space-1_5) px-(--ct-space-1_5) py-px rounded-(--ct-radius-sm) bg-(--ct-graphite-nested-bg) border border-(--ct-border-ghost) leading-none">
              <span className={cn(
                "w-[5px] h-[5px] rounded-full",
                statusTone === "ok" && "bg-(--ct-status-success)",
                statusTone === "watch" && "bg-(--ct-status-warning)",
                statusTone === "alert" && "bg-(--ct-status-danger)",
                statusTone === "idle" && "bg-(--ct-text-faint)",
              )} />
              <span className={cn(
                "cockpit-label-xs pt-px",
                statusTone === "ok" && "text-(--ct-status-success)",
                statusTone === "watch" && "text-(--ct-status-warning)",
                statusTone === "alert" && "text-(--ct-status-danger)",
                statusTone === "idle" && "text-(--ct-text-faint)",
              )}>
                {status}
              </span>
            </div>
          ) : null}
        </div>
        {subtitle ? (
          <p className="body-xs ct-text-tertiary m-0 mono">{subtitle}</p>
        ) : null}
      </div>
      {provenance || trustLabel || trailing ? (
        <div className="flex items-center gap-(--ct-space-3) shrink-0">
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
