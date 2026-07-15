/**
 * Catalyst PanelStatus — canonical Hearst panel status / accent.
 * Token-only.
 */

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
