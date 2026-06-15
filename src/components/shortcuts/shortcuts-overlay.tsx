// deferred: shell keyboard handler needed in layout.tsx / app-chrome.tsx which is off-limits per rules; wire when shell gate is lifted
"use client";

import { useCallback, useEffect, useId, useRef } from "react";

import { cn } from "@/lib/cn";
import {
  SHORTCUT_SECTIONS,
  getShortcutsBySection,
  type Shortcut,
} from "@/lib/shortcuts/registry";

// ── Constants ──────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ── Sub-components ─────────────────────────────────────────────────────────────

function ComboKey({ label }: { label: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[1.625rem] h-[1.375rem] px-1.5",
        "rounded-sm",
        "ct-surface-2 border border-[var(--ct-border)]",
        "mono body-xs leading-tight tracking-tight",
        "ct-text-primary",
        "shadow-[0_1px_0_var(--ct-border-strong)]",
      )}
    >
      {label}
    </kbd>
  );
}

function ShortcutCombo({ combo }: { combo: string }) {
  // Split on "+" but preserve lone "+" (just the plus key itself)
  const parts =
    combo === "+"
      ? ["+"]
      : combo.includes("+") && combo !== "shift+?"
        ? combo.split("+")
        : combo.includes("+")
          ? combo.split("+")
          : combo.includes(" ")
            ? combo.split(" ")
            : [combo];

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={combo}>
      {parts.map((part, i) => (
        <ComboKey key={i} label={part} />
      ))}
    </span>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="body-sm ct-text-body min-w-0 truncate">
        {shortcut.description}
      </span>
      <ShortcutCombo combo={shortcut.combo} />
    </div>
  );
}

function SectionBlock({
  title,
  shortcuts,
}: {
  title: string;
  shortcuts: Shortcut[];
}) {
  if (shortcuts.length === 0) return null;
  return (
    <div>
      <span className="body-xs font-semibold ct-text-body block mb-2 px-1">
        {title}
      </span>
      <div className="divide-y divide-[var(--ct-border)]/40">
        {shortcuts.map((s) => (
          <ShortcutRow key={s.combo} shortcut={s} />
        ))}
      </div>
    </div>
  );
}

// ── Main overlay ───────────────────────────────────────────────────────────────

export interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  // Unmount body when closed to reset scroll position
  if (!open) return null;
  return <ShortcutsOverlayBody onClose={onClose} />;
}

function ShortcutsOverlayBody({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const grouped = getShortcutsBySection();

  // Restore focus on unmount; set initial focus on mount
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
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
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[var(--ct-z-modal)]"
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--ct-bg-deep)]/75"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full max-w-2xl max-h-[85vh]",
          "rounded-xl border border-[var(--ct-border-strong)]",
          "ct-surface-1",
          "shadow-[var(--ct-shadow-elevated)]",
          "flex flex-col overflow-hidden",
          "z-[var(--ct-z-base)]",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between",
            "px-6 py-4",
            "border-b border-[var(--ct-border)]",
            "ct-surface-2",
          )}
        >
          <h2 id={titleId} className="h2 shrink-0">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts overlay"
            className={cn(
              "flex items-center justify-center",
              "w-7 h-7 rounded-sm",
              "ct-text-muted hover:ct-text-primary",
              "hover:ct-surface-3",
              "transition-colors duration-[var(--ct-dur-fast)]",
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Shortcuts grid — two-column layout */}
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {SHORTCUT_SECTIONS.map((section) => (
              <SectionBlock
                key={section}
                title={section}
                shortcuts={grouped.get(section) ?? []}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "flex items-center justify-center gap-2",
            "px-6 py-3",
            "border-t border-[var(--ct-border)]",
            "ct-surface-2",
          )}
        >
          <span className="stat-label ct-text-muted">Close</span>
          <ComboKey label="esc" />
        </div>
      </div>
    </div>
  );
}
