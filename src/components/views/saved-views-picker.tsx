"use client";

/**
 * SavedViewsPicker — dropdown selector for saved views.
 * Renders a <select>-backed combobox (ARIA compliant) listing the user's
 * saved views for the current scope.  Selecting a view calls onSelect with
 * the view id; the parent is responsible for serializing to URL params.
 *
 * Layout expected by tables:
 *   [ My signatures ▼ ]  [Save as...]  [Edit columns]
 */

import { useId } from "react";

import { cn } from "@/lib/cn";
import type { SavedViewRow } from "@/lib/views/actions";
import type { ViewScope } from "@/lib/views/templates";

export interface SavedViewsPickerProps {
  /** All views for the current scope (pre-loaded by the server). */
  views: SavedViewRow[];
  /** Currently active view id, or undefined for ad-hoc. */
  activeViewId?: string;
  /** Current scope (used in aria label). */
  scope: ViewScope;
  /** Called when the user selects a saved view. */
  onSelect: (viewId: string) => void;
  /** Called when the user clicks "Save as…". */
  onSaveAs: () => void;
  /** Optional — called when the user clicks "Edit columns". */
  onEditColumns?: () => void;
  className?: string;
}

export function SavedViewsPicker({
  views,
  activeViewId,
  scope,
  onSelect,
  onSaveAs,
  onEditColumns,
  className,
}: SavedViewsPickerProps) {
  const selectId = useId();

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="toolbar"
      aria-label={`View controls for ${scope}`}
    >
      {/* View selector */}
      <div className="relative flex items-center">
        <label htmlFor={selectId} className="sr-only">
          Select saved view
        </label>
        <select
          id={selectId}
          value={activeViewId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val) onSelect(val);
          }}
          aria-label="Saved views"
          className={cn(
            "h-7 appearance-none rounded-md",
            "border border-[var(--ct-border-soft)] ct-surface-0",
            "pl-3 pr-8 body-xs ct-text-primary",
            "backdrop-blur-xl transition-[border-color,background-color]",
            "hover:border-[var(--ct-border-strong)] hover:ct-surface-1",
            "focus:outline-none focus:shadow-[var(--ct-shadow-focus-ring)]",
            "cursor-pointer",
          )}
        >
          {activeViewId == null && (
            <option value="" disabled>
              — Select a view —
            </option>
          )}
          {views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
          {views.length === 0 && (
            <option value="" disabled>
              No saved views
            </option>
          )}
        </select>

        {/* Caret icon */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 ct-text-muted"
        >
          ▾
        </span>
      </div>

      {/* Save as button */}
      <button
        type="button"
        onClick={onSaveAs}
        className={cn(
          "h-7 rounded-md border border-[var(--ct-border-soft)]",
          "ct-surface-0 px-3 body-xs ct-text-muted",
          "backdrop-blur-xl transition-[border-color,color]",
          "hover:border-[var(--ct-border-strong)] hover:ct-text-strong",
          "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
        )}
      >
        Save as…
      </button>

      {/* Edit columns (optional) */}
      {onEditColumns != null && (
        <button
          type="button"
          onClick={onEditColumns}
          className={cn(
            "h-7 rounded-md border border-[var(--ct-border-soft)]",
            "ct-surface-0 px-3 body-xs ct-text-muted",
            "backdrop-blur-xl transition-[border-color,color]",
            "hover:border-[var(--ct-border-strong)] hover:ct-text-strong",
            "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
          )}
        >
          Edit columns
        </button>
      )}
    </div>
  );
}
