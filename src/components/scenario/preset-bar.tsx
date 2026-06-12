"use client";

import { cn } from "@/lib/cn";
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
  return (
    <nav aria-label="Scenario presets" className="scenario-preset-bar">
      <div className="scenario-preset-bar__head">
        <p className="eyebrow ct-text-muted">Preset library</p>
        <span className="body-xs ct-text-faint">Select a starting scenario</span>
      </div>
      <div className="scenario-preset-bar__items">
        {PRESETS.map((p) => {
          const isActive = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(p.id)}
              title={p.description}
              aria-pressed={isActive}
              className={cn(
                "scenario-preset-bar__button",
                isActive && "scenario-preset-bar__button--active",
              )}
            >
              <span className="scenario-preset-bar__label">{p.label}</span>
              <span className="scenario-preset-bar__description">{p.description}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { PRESETS };
