"use client";

import { cn } from "@/lib/cn";

export interface NotificationsBellProps {
  unreadCount: number;
  onClick: () => void;
}

export function NotificationsBell({
  unreadCount,
  onClick,
}: NotificationsBellProps) {
  const hasUrgent = false; // caller can extend by passing urgentCount if needed
  const badgeColor = hasUrgent
    ? "bg-[var(--ct-status-danger)]"
    : "bg-[var(--ct-accent)]";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-full",
        "ct-text-muted hover:ct-text-strong",
        "hover:ct-surface-1 transition-colors duration-[var(--ct-dur-base)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
      )}
    >
      {/* Bell icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5v2.25L2 9.75V11h12V9.75L12.5 8.25V6A4.5 4.5 0 0 0 8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 11.5a1.5 1.5 0 0 0 3 0"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>

      {/* Badge */}
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
            "rounded-full px-1",
            "text-micro font-bold leading-none text-[var(--ct-bg-deep)]",
            badgeColor,
          )}
          aria-hidden="true"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
