"use client";

import { useRef } from "react";

import { getPresetMetas } from "@/lib/engine/preset-meta";
import type { Preset } from "@/lib/engine/types";

// Labels + descriptions are DERIVED from the engine's canonical preset inputs
// (single source of truth) — no hand-typed copy that can drift from the numbers.
const PRESETS = getPresetMetas();

interface PresetBarProps {
  selected: Preset | null;
  onSelect: (preset: Preset) => void;
  disabled?: boolean;
}

export function PresetBar({ selected, onSelect, disabled }: PresetBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Roving tabindex: whichever preset is active owns Tab focus; first if none.
  const selectedIdx = selected !== null ? PRESETS.findIndex((p) => p.id === selected) : -1;
  const rovingIndex = selectedIdx >= 0 ? selectedIdx : 0;

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (disabled) return;
    const total = PRESETS.length;
    let next = -1;
    if (e.key === "ArrowRight") { next = (index + 1) % total; e.preventDefault(); }
    else if (e.key === "ArrowLeft") { next = (index - 1 + total) % total; e.preventDefault(); }
    else if (e.key === "Home") { next = 0; e.preventDefault(); }
    else if (e.key === "End") { next = total - 1; e.preventDefault(); }
    if (next < 0) return;
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const nextButton = buttons?.[next];
    const nextPreset = PRESETS[next];
    if (nextButton && nextPreset) {
      nextButton.focus();
      onSelect(nextPreset.id);
    }
  }

  return (
    <div className="scenario-preset-bar">
      <div className="scenario-preset-bar__head">
        <span className="eyebrow ct-text-muted">Preset library</span>
        <span className="body-xs ct-text-muted">Load a starting scenario, then tune inputs.</span>
      </div>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="Preset library"
        className="scenario-preset-bar__items"
      >
        {PRESETS.map((p, index) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            disabled={disabled}
            onClick={() => onSelect(p.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            aria-checked={selected === p.id}
            tabIndex={index === rovingIndex ? 0 : -1}
            className="scenario-preset-bar__button"
          >
            <span className="scenario-preset-bar__label">{p.label}</span>
            <span className="scenario-preset-bar__description">{p.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { PRESETS };
