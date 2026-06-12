"use client";

// PresetPicker — accessible custom dropdown (listbox) with full keyboard nav.
// Extracted from scenario/compare-mode.tsx. Generic over a string-keyed option
// so it stays a pure UI primitive (no scenario/domain imports). Composes only
// existing Cockpit classes/tokens.

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export interface PresetPickerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface PresetPickerProps<T extends string> {
  /** Visual side accent (A = soft border, B = strong). */
  side: "A" | "B";
  value: T | null;
  options: ReadonlyArray<PresetPickerOption<T>>;
  /** When provided, this option is greyed out / disabled (chosen elsewhere). */
  excluded?: T | null;
  disabled?: boolean;
  onChange: (value: T) => void;
}
const PRESET_PICKER_STRINGS = {
  scenarioLabel: "Scenario",
  selectScenarioLower: "select a scenario",
  selectScenarioTitle: "Select a scenario",
  pickScenarioLabel: "Pick a scenario",
  alreadySelectedOtherSide: "Already on the other side",
  chevronDown: "▼",
} as const;

export function PresetPicker<T extends string>({
  side,
  value,
  options,
  excluded = null,
  disabled = false,
  onChange,
}: PresetPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const labelFor = (v: T): string =>
    options.find((o) => o.value === v)?.label ?? v;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Move focus to the first selectable option when the listbox opens so the
  // keyboard user can act on the menu they just summoned. Without this the
  // focus stays on the trigger and Tab leaves the dropdown entirely.
  useEffect(() => {
    if (!open) return;
    const first = listboxRef.current?.querySelector<HTMLButtonElement>(
      'button[role="option"]:not([disabled])',
    );
    first?.focus();
  }, [open]);

  // Arrow key navigation within the listbox. Up/Down cycle through enabled
  // options; Home/End jump to first/last.
  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (!listboxRef.current) return;
    const opts = Array.from(
      listboxRef.current.querySelectorAll<HTMLButtonElement>(
        'button[role="option"]:not([disabled])',
      ),
    );
    if (opts.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const idx = active ? opts.indexOf(active) : -1;
    let next = idx;
    if (e.key === "ArrowDown") next = idx < 0 ? 0 : (idx + 1) % opts.length;
    else if (e.key === "ArrowUp")
      next = idx < 0 ? opts.length - 1 : (idx - 1 + opts.length) % opts.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = opts.length - 1;
    else return;
    e.preventDefault();
    opts[next]?.focus();
  }

  const sideAccent =
    side === "A"
      ? "border-l-(--ct-border-strong)"
      : "border-l-(--ct-text-strong)";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${PRESET_PICKER_STRINGS.scenarioLabel} ${side}: ${value ? labelFor(value) : PRESET_PICKER_STRINGS.selectScenarioLower}`}
        className={cn(
          "flex w-full items-center justify-between gap-3 glass-panel",
          "border-l-4",
          sideAccent,
          "px-4 py-3 text-left",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "focus-visible:outline-none focus-visible:shadow-(--ct-shadow-focus-ring)",
        )}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="eyebrow">{PRESET_PICKER_STRINGS.scenarioLabel} {side}</span>
          <span
            className={cn(
              "h4 truncate",
              !value && "ct-text-muted font-medium",
            )}
          >
            {value ? labelFor(value) : PRESET_PICKER_STRINGS.selectScenarioTitle}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 ct-text-body transition-transform duration-(--ct-dur-fast)",
            open && "rotate-180",
          )}
          aria-hidden
        >
          {PRESET_PICKER_STRINGS.chevronDown}
        </span>
      </button>

      {open && (
        <ul
          ref={listboxRef}
          role="listbox"
          aria-label={`${PRESET_PICKER_STRINGS.pickScenarioLabel} for ${side}`}
          onKeyDown={onListKeyDown}
          className={cn(
            "absolute z-(--ct-z-dropdown) mt-2 w-full overflow-hidden",
            "glass-panel p-0",
            "shadow-(--ct-shadow-elevated)",
          )}
        >
          {options.map((o) => {
            const isSelected = value === o.value;
            const isExcluded = excluded === o.value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={isExcluded}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  title={o.description}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left",
                    "transition-colors duration-(--ct-dur-fast)",
                    "focus-visible:outline-none focus-visible:shadow-(--ct-shadow-focus-ring)",
                    isSelected
                      ? "ct-surface-1 ct-text-accent"
                      : "ct-text-body hover:ct-surface-3 hover:ct-text-primary",
                    isExcluded &&
                      "cursor-not-allowed opacity-40 hover:bg-transparent",
                  )}
                >
                  <span className="h4">{o.label}</span>
                  <span className="ct-text-micro-size ct-text-muted">
                    {isExcluded ? PRESET_PICKER_STRINGS.alreadySelectedOtherSide : o.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
