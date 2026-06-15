"use client";

import { cn } from "@/lib/cn";
import type { ScenarioInputs } from "@/lib/engine/types";

interface SliderFieldMeta {
  key: keyof ScenarioInputs;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  formatUnit: (v: number) => string;
}

// Volatility band thresholds — mirror the engine's VOL_WARNING (65) / VOL_BREACHED (80).
const VOL_BAND_LOW = 35;
const VOL_BAND_NORMAL = 65;
const VOL_BAND_HIGH = 80;

function volBandLabel(v: number): string {
  return v < VOL_BAND_LOW
    ? "Low"
    : v < VOL_BAND_NORMAL
      ? "Normal"
      : v < VOL_BAND_HIGH
        ? "High"
        : "Extreme";
}

const FIELDS: SliderFieldMeta[] = [
  {
    key: "btc_price_change_pct",
    label: "BTC Price Change",
    unit: "%",
    min: -60,
    max: 120,
    step: 1,
    format: (v) => `${v >= 0 ? "+" : ""}${v}`,
    formatUnit: () => "%",
  },
  {
    key: "hashprice_usd_th_day",
    label: "Hashprice",
    unit: "$/TH/day",
    min: 0.02,
    max: 0.15,
    step: 0.001,
    format: (v) => `$${v.toFixed(3)}`,
    formatUnit: () => "$/TH/day",
  },
  {
    key: "energy_cost_kwh",
    label: "Energy Cost",
    unit: "$/kWh",
    min: 0.02,
    max: 0.12,
    step: 0.001,
    format: (v) => `$${v.toFixed(3)}`,
    formatUnit: () => "$/kWh",
  },
  {
    key: "stable_apy_pct",
    label: "Stable Base APY",
    unit: "%",
    min: 1,
    max: 8,
    step: 0.1,
    format: (v) => v.toFixed(1),
    formatUnit: () => "%",
  },
  {
    key: "vol_index",
    label: "BTC Volatility (30d)",
    unit: "index 0–100",
    min: 0,
    max: 100,
    step: 1,
    format: volBandLabel,
    formatUnit: volBandLabel,
  },
];

interface InputsPanelProps {
  inputs: ScenarioInputs;
  onChange: (updated: ScenarioInputs) => void;
  disabled?: boolean;
}

export function InputsPanel({ inputs, onChange, disabled }: InputsPanelProps) {
  function handleChange(key: keyof ScenarioInputs, raw: string) {
    const v = parseFloat(raw);
    if (isNaN(v)) return;
    onChange({ ...inputs, [key]: v });
  }

  return (
    <div className="divide-y ct-divide-soft">
      {FIELDS.map((field) => {
        const value = inputs[field.key];
        const pct = ((value - field.min) / (field.max - field.min)) * 100;
        const isVolIndex = field.key === "vol_index";

        return (
          <div
            key={field.key}
            className="py-(--ct-space-5) first:pt-0 last:pb-0"
          >
            {/* Label row — eyebrow left, value right */}
            <div className="mb-(--ct-space-3) admin-doc-inline-row admin-doc-inline-row--between items-baseline">
              <label
                htmlFor={`slider-${field.key}`}
                className={cn(
                  "stat-label",
                  disabled && "opacity-[var(--ct-opacity-50)]",
                )}
              >
                {field.label}
              </label>
              <div className="admin-doc-inline-row admin-doc-inline-row--baseline admin-doc-inline-row--dense">
                <span
                  className={cn(
                    "mono stat-value tabular-nums ct-text-primary",
                    disabled && "opacity-[var(--ct-opacity-50)]",
                  )}
                >
                  {field.format(value)}
                </span>
                {!isVolIndex && (
                  <span className="body-xs ct-text-muted">
                    {field.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Slider */}
            <input
              id={`slider-${field.key}`}
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={value}
              disabled={disabled}
              aria-label={
                isVolIndex
                  ? `${field.label}: ${field.format(value)}`
                  : `${field.label}: ${field.format(value)} ${field.unit}`
              }
              aria-valuetext={field.format(value)}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="slider-track w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-[var(--ct-opacity-40)]"
              style={{ "--slider-pct": `${pct}%` } as React.CSSProperties}
            />

            {/* Min / max labels */}
            <div className="mt-(--ct-space-1_5) admin-doc-row-spread">
              <span className="body-xs ct-text-muted">
                {field.key === "btc_price_change_pct"
                  ? "−60%"
                  : field.key === "vol_index"
                    ? "Low"
                    : `${field.min} ${field.unit}`}
              </span>
              <span className="body-xs ct-text-muted">
                {field.key === "btc_price_change_pct"
                  ? "+120%"
                  : field.key === "vol_index"
                    ? "Extreme"
                    : `${field.max} ${field.unit}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
