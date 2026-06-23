// Preset display metadata — DERIVED from the canonical PRESET_BASELINE_INPUTS,
// never hand-typed. Single source of truth for every surface that renders a
// preset chip (Scenario Lab preset bar, projection studio). Pure functions, no
// I/O — engine purity (#6) holds; safe to import from Server or Client code.
//
// WHY: the label/description used to be re-typed in preset-bar.tsx AND
// studio.tsx, and the hand-typed deltas drifted from the real engine inputs
// (e.g. "hashprice −30%" when the actual value moves −29%). Deriving the text
// from the numbers makes that class of bug impossible.

import { getPresetInputs } from "./scenario";
import type { Preset, ScenarioInputs } from "./types";

/** Human label per preset id. Stable copy, not derived (it's a name, not data). */
const PRESET_LABELS: Record<Preset, string> = {
  base: "Base Case",
  btc_bear: "BTC Bear",
  btc_bull: "BTC Bull",
  mining_compression: "Mining Compression",
  extreme_stress: "Extreme Stress",
};

/** Display order for the preset library (base first, then by severity). */
export const PRESET_ORDER: readonly Preset[] = [
  "base",
  "btc_bear",
  "btc_bull",
  "mining_compression",
  "extreme_stress",
];

export interface PresetMeta {
  id: Preset;
  label: string;
  /** Derived from the delta between this preset's inputs and the base case. */
  description: string;
}

function signedPct(from: number, to: number): string | null {
  if (from === 0) return null;
  const pct = Math.round(((to - from) / Math.abs(from)) * 100);
  if (pct === 0) return null;
  // U+2212 minus to match the rest of the UI typography.
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
}

function describe(inputs: ScenarioInputs, base: ScenarioInputs): string {
  const parts: string[] = [];

  const btc = inputs.btc_price_change_pct;
  if (btc !== base.btc_price_change_pct && btc !== 0) {
    parts.push(`BTC ${btc > 0 ? "+" : "−"}${Math.abs(btc)}%`);
  }

  const hash = signedPct(base.hashprice_usd_th_day, inputs.hashprice_usd_th_day);
  if (hash) parts.push(`hashprice ${hash}`);

  const energy = signedPct(base.energy_cost_kwh, inputs.energy_cost_kwh);
  if (energy) parts.push(`energy ${energy}`);

  const stable = signedPct(base.stable_apy_pct, inputs.stable_apy_pct);
  if (stable) parts.push(`stable APY ${stable}`);

  if (inputs.vol_index >= 80) parts.push("vol extreme");
  else if (inputs.vol_index <= 35 && inputs.vol_index !== base.vol_index) {
    parts.push("vol low");
  }

  return parts.length > 0 ? parts.join(", ") : "Current conditions ±0";
}

/** All presets with derived display metadata, in canonical display order. */
export function getPresetMetas(): PresetMeta[] {
  const base = getPresetInputs("base");
  return PRESET_ORDER.map((id) => ({
    id,
    label: PRESET_LABELS[id],
    description: describe(getPresetInputs(id), base),
  }));
}
