import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type PanelStatusTone = "muted" | "danger";

export interface PanelStatusProps {
  message: string;
  detail?: string;
  tone?: PanelStatusTone;
  className?: string;
  role?: "status" | "alert" | "note";
}

/**
 * Inline status copy inside an encased parent (cockpit panel, card, chamber).
 * No border/background — parent owns the single surface (DS §9.3).
 */
export function PanelStatus({
  message,
  detail,
  tone = "muted",
  className,
  role = "status",
}: PanelStatusProps) {
  return (
    <div className={cn("ct-panel-status", className)} role={role}>
      <p
        className={cn(
          "ct-panel-status__message m-0",
          tone === "muted" && "body-sm ct-text-muted",
          tone === "danger" && "body-xs ct-status-danger",
        )}
      >
        {message}
      </p>
      {detail ? (
        <p className="ct-panel-status__detail body-xs ct-text-faint m-0">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

/** Left-accent inline row inside a parent card — no nested box background. */
export function PanelStatusAccent({
  children,
  className,
  role = "status",
}: {
  children: ReactNode;
  className?: string;
  role?: "status" | "alert" | "note";
}) {
  return (
    <div className={cn("ct-panel-status-accent", className)} role={role}>
      {children}
    </div>
  );
}

/** Subsection label + children (checklists, field groups) without nested boxes. */
export function PanelStatusSection({
  label,
  "aria-label": ariaLabel,
  children,
  className,
}: {
  label: string;
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("ct-panel-status-section", className)}
      aria-label={ariaLabel}
    >
      <p className="stat-label m-0">{label}</p>
      {children}
    </div>
  );
}
