"use client";

import { useRef } from "react";

import type { Preset } from "@/lib/engine/types";

interface PresetMeta {
  id: Preset;
  label: string;
  description: string;
}

const PRESETS: PresetMeta[] = [
  {
    id: "base",
    label: "Base Case",
    description: "Current conditions ±0",
  },
  {
    id: "btc_bear",
    label: "BTC Bear",
    description: "BTC −40%, hashprice −30%, energy +5%",
  },
  {
    id: "btc_bull",
    label: "BTC Bull",
    description: "BTC +60%, hashprice +20%, vol high",
  },
  {
    id: "mining_compression",
    label: "Mining Compression",
    description: "Difficulty +30%, hashprice −25%, energy +15%",
  },
  {
    id: "extreme_stress",
    label: "Extreme Stress",
    description: "BTC −50%, hashprice −40%, DeFi shock",
  },
];

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
