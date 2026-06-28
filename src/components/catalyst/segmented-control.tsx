"use client";

// Catalyst SegmentedControl — canonical, token-only. ui/segmented-control re-exports this.
//
// SegmentedControl — the canonical "pick one of N" selection primitive.
//
// Owns the ARIA + keyboard contract so call sites stop re-implementing it:
// roving tabindex, Arrow/Home/End navigation, role=tablist|radiogroup. Renders
// the existing canonical `.ct-seg-track` / `.ct-seg-btn` classes, so it is a
// drop-in for the hand-rolled toggles and inherits the green :focus-visible ring.
//
// Selection stays QUIET (the `.ct-seg-btn.active` surface lift) — accent FILL is
// reserved for the primary action, never for selection.
//
// Token-only — this is the canon: `src/components/ui/segmented-control` is a thin
// compatibility wrapper that re-exports these symbols. New code should import
// SegmentedControl / SegmentedItem from `@/components/catalyst/segmented-control`.

import { cn } from "@/lib/cn";

export interface SegmentedItem<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Tab element id (tablist variant) — pairs with the tabpanel's aria-labelledby. */
  id?: string;
  /** id of the tabpanel this tab controls (tablist variant). */
  controls?: string;
}

interface SegmentedControlProps<T extends string> {
  items: ReadonlyArray<SegmentedItem<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Required: names the group for assistive tech. */
  ariaLabel: string;
  /** tablist = switches a view (default); radiogroup = picks a value. */
  variant?: "tablist" | "radiogroup";
  /** Wrap in a horizontal scroll container (default true). */
  scroll?: boolean;
  className?: string;
  trackClassName?: string;
  itemClassName?: string;
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  variant = "tablist",
  scroll = true,
  className,
  trackClassName,
  itemClassName,
}: SegmentedControlProps<T>) {
  const isTablist = variant === "tablist";

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = items.findIndex((it) => it.value === value);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (idx + 1) % items.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (idx - 1 + items.length) % items.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = items.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const target = items[next];
    if (target && target.value !== value) onChange(target.value);
  }

  return (
    <div
      role={isTablist ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn(scroll && "ct-seg-scroll", className)}
      onKeyDown={handleKeyDown}
    >
      <div className={cn("ct-seg-track", trackClassName)}>
        {items.map((it) => {
          const active = it.value === value;
          const selectionAttrs = isTablist
            ? { "aria-selected": active, id: it.id, "aria-controls": it.controls }
            : { "aria-checked": active };
          return (
            <button
              key={it.value}
              type="button"
              role={isTablist ? "tab" : "radio"}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(it.value)}
              className={cn("ct-seg-btn", itemClassName, active && "active")}
              {...selectionAttrs}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
