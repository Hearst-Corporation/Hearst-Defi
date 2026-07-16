"use client";

// Modal — canonical overlay primitive. Shares the focus-trap / Escape /
// backdrop accessibility model of ConfirmDialog, minus the OK/Cancel actions.
// For confirmations use <ConfirmDialog>; for arbitrary panel content use <Modal>.
// Composes existing Cockpit classes/tokens only.

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional actions rendered in the header (right side). */
  headerActions?: ReactNode;
  children: ReactNode;
  /** Tailwind max-width class for the panel. Defaults to a wide reading width. */
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MODAL_CLOSE_LABEL = "Close";

export function Modal(props: ModalProps) {
  if (!props.isOpen) return null;
  return <ModalBody {...props} />;
}

function ModalBody({
  onClose,
  title,
  headerActions,
  children,
  className,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  // Capture trigger, set initial focus on mount, restore focus on unmount.
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const id = window.requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });
    return () => {
      window.cancelAnimationFrame(id);
      triggerRef.current?.focus?.();
    };
  }, []);

  // Escape to close + focus trap (Tab / Shift+Tab loop).
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
    <div
      className="fixed inset-0 flex items-center justify-center p-[var(--ct-space-4)] z-[var(--ct-z-modal)]"
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 cursor-default bg-[var(--ct-bg-deep)]/70"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[85vh] w-full flex-col overflow-hidden",
          "rounded-xl border border-[var(--ct-border-strong)]",
          "ct-surface-2 shadow-[var(--ct-shadow-elevated)] z-[var(--ct-z-base)]",
          className ?? "max-w-3xl",
        )}
      >
        <div className="flex items-center justify-between gap-[var(--ct-space-2)] border-b border-[var(--ct-border-soft)] px-[var(--ct-space-6)] py-[var(--ct-space-3)]">
          <h2
            id={titleId}
            className="h2 ct-text-strong"
          >
            {title}
          </h2>
          <div className="flex items-center gap-[var(--ct-space-2)]">
            {headerActions}
            <Button
              size="sm"
              variant="ghost"
              onClick={close}
              aria-label={MODAL_CLOSE_LABEL}
            >
              {MODAL_CLOSE_LABEL}
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto px-[var(--ct-space-6)] py-[var(--ct-space-4)]">{children}</div>
      </div>
    </div>
  );
}
