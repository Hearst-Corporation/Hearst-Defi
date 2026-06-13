/**
 * Notification types — safe to import from both server and client code.
 * Mirrors the Prisma Notification model but uses plain TS types (no DB import).
 */

export type NotificationCategory = "action" | "fyi" | "system";
export type NotificationSeverity = "urgent" | "info" | "low";

export interface Notification {
  id: string;
  userId: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  actionHref: string | null;
  actionLabel: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  archivedAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
}

/** Label map for UI display */
export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  action: "Action Required",
  fyi: "FYI",
  system: "System",
};
