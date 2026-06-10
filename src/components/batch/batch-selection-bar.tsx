"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { BatchActionButton } from "./batch-action-button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BatchSelectionBarProps {
  /** Number of currently selected items. Bar is hidden when 0. */
  count: number;
  /** Clears the entire selection. */
  onClear: () => void;
  /**
   * Custom action slots rendered between the count and the overflow menu.
   * Pass `<BatchActionButton>` elements.
   */
  children?: React.ReactNode;
  /**
   * Overflow menu items rendered inside "..." when `children` overflow
   * or for secondary actions. Each item: { label, onClick, danger? }.
   */
  overflowActions?: Array<{
    label: string;
    onClick: () => void;
    danger?: boolean;
  }>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sticky bottom-center bar that appears when `count > 0`.
 *
 * ```tsx
 * <BatchSelectionBar count={selected.size} onClear={clear}>
 *   <BatchActionButton onClick={handleApprove}>Approve</BatchActionButton>
 * </BatchSelectionBar>
 * ```
 */
export function BatchSelectionBar({
  count,
  onClear,
  children,
  overflowActions,
  className,
}: BatchSelectionBarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on outside click.
  useEffect(() => {
    if (!overflowOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        overflowRef.current &&
        !overflowRef.current.contains(e.target as Node)
      ) {
        setOverflowOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [overflowOpen]);

  // Keyboard: Escape closes overflow menu.
  useEffect(() => {
    if (!overflowOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOverflowOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [overflowOpen]);

  if (count === 0) return null;

  const hasOverflow = overflowActions && overflowActions.length > 0;

  return (
    <div
      role="region"
      aria-label="Batch selection"
      aria-live="polite"
      data-testid="batch-selection-bar"
      className={cn(
        // Position — bottom-center, sticky above page scroll.
        "fixed bottom-6 left-1/2 z-[9000] -translate-x-1/2",
        // Surface — glass with accent border.
        "flex items-center gap-2",
        "rounded-xl",
        "bg-[color-mix(in_srgb,var(--ct-bg-deep)_70%,transparent)]",
        "backdrop-blur-[40px]",
        "border border-[var(--ct-accent)]",
        "px-4 py-2",
        "shadow-[var(--ct-shadow-elevated)]",
        // Animation.
        "animate-in slide-in-from-bottom-3 fade-in duration-200",
        className,
      )}
    >
      {/* Count label */}
      <span className="text-sm font-semibold ct-text-accent tabular-nums">
        {count} selected
      </span>

      <div
        role="separator"
        aria-orientation="vertical"
        className="mx-1 h-4 w-px bg-[var(--ct-border-soft)]"
      />

      {/* Clear */}
      <BatchActionButton
        onClick={onClear}
        aria-label="Clear selection"
        data-testid="batch-clear"
      >
        Clear
      </BatchActionButton>

      {/* Custom action slots */}
      {children}

      {/* Overflow "..." menu */}
      {hasOverflow && (
        <div className="relative" ref={overflowRef}>
          <BatchActionButton
            onClick={() => setOverflowOpen((o) => !o)}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            data-testid="batch-overflow-trigger"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="2" cy="7" r="1.25" />
              <circle cx="7" cy="7" r="1.25" />
              <circle cx="12" cy="7" r="1.25" />
            </svg>
          </BatchActionButton>

          {overflowOpen && (
            <div
              role="menu"
              className={cn(
                "absolute bottom-full right-0 mb-2 min-w-[140px]",
                "rounded-lg",
                "ct-surface-2",
                "border border-[var(--ct-border-soft)]",
                "py-1 shadow-[var(--ct-shadow-elevated)]",
                "animate-in slide-in-from-bottom-1 fade-in duration-150",
              )}
            >
              {overflowActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOverflowOpen(false);
                    action.onClick();
                  }}
                  className={cn(
                    "w-full px-3 py-1.5 text-left text-xs",
                    "transition-colors duration-[var(--ct-dur-base)]",
                    "focus-visible:outline-none focus-visible:ct-surface-3",
                    action.danger
                      ? "ct-status-danger hover:ct-status-danger-bg"
                      : "ct-text-primary hover:ct-surface-3",
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
