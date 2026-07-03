"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { NotificationsBell } from "@/components/notifications/notifications-bell";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Client wrapper that mounts the NotificationsBell in the admin shell.
 * onClick opens a keyboard-accessible notification drawer — content is a
 * placeholder until notification persistence is added.
 */
export function NotificationsBellWrapper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <NotificationsBell unreadCount={0} onClick={() => setOpen((v) => !v)} />
      {open && <NotificationsDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function NotificationsDrawer({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  // Capture trigger, move focus into the dialog on mount, restore on unmount.
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const id = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      triggerRef.current?.focus?.();
    };
  }, []);

  // Escape to close + focus trap (Tab / Shift+Tab loop within the panel).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return (
    <div className="notifications-drawer">
      {/* Backdrop — click to dismiss, unreachable by keyboard (trap handles it) */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          cursor: "default",
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="notifications-drawer__panel"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--ct-space-2)",
            padding: "var(--ct-space-3) var(--ct-space-4)",
            borderBottom: "1px solid var(--ct-border-subtle)",
          }}
        >
          <h2
            id={titleId}
            className="ct-text-strong"
            style={{ fontSize: "var(--ct-text-sm)", fontWeight: 600 }}
          >
            Notifications
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="ct-text-muted hover:ct-text-strong focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "var(--ct-space-6)",
              width: "var(--ct-space-6)",
              borderRadius: "var(--ct-radius-sm)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <p
          className="ct-text-muted"
          style={{
            padding: "var(--ct-space-4)",
            fontSize: "var(--ct-text-sm)",
          }}
        >
          No notifications yet.
        </p>
      </div>
    </div>
  );
}
