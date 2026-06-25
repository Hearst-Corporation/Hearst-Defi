"use client";

import { useState } from "react";
import { NotificationsBell } from "@/components/notifications/notifications-bell";

/**
 * Client wrapper that mounts the NotificationsBell in the admin shell.
 * onClick opens a future notification drawer — noop until persistence lands.
 */
export function NotificationsBellWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <NotificationsBell unreadCount={0} onClick={() => setOpen((v) => !v)} />
      {/* Drawer placeholder — wired once notification persistence is added */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          aria-modal="false"
          className="notifications-drawer"
          onClick={() => setOpen(false)}
        >
          <div className="notifications-drawer__panel" onClick={(e) => e.stopPropagation()}>
            <p className="ct-text-muted" style={{ padding: "var(--ct-space-4)", fontSize: "var(--ct-text-sm)" }}>
              No notifications yet.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
