"use client";

// useScenario — single-scenario state + handlers for the Scenario Lab.
// Extracted verbatim (behaviour-preserving) from lab-shell.tsx. Calls the
// existing Server Actions; contains no business maths.

import { useCallback, useState, useTransition } from "react";

import {
  getPresetInputsAction,
  runScenarioAction,
} from "@/app/admin/scenario-lab/actions";
import type { ScenarioNarrativeOutput } from "@/lib/agents/schemas";
import type {
  Preset,
  ScenarioInputs,
  ScenarioOutput,
  VaultId,
} from "@/lib/engine/types";

export const BASE_INPUTS: ScenarioInputs = {
  btc_price_change_pct: 0,
  hashprice_usd_th_day: 0.085,
  energy_cost_kwh: 0.045,
  stable_apy_pct: 4.5,
  vol_index: 45,
};

export interface ScenarioState {
  selectedPreset: Preset | null;
  inputs: ScenarioInputs;
  output: ScenarioOutput | null;
  narrative: ScenarioNarrativeOutput | null;
}

export interface UseScenarioOptions {
  /**
   * Vault context for every run launched by this hook. Threaded straight
   * through to `runScenarioAction` so the engine call and the persisted row
   * are bound to a single vault (ADR-006 #9). Defaults to the Yield Vault
   * when omitted so existing callers keep their behaviour.
   */
  vaultId?: VaultId;
}

export function useScenario(opts: UseScenarioOptions = {}) {
  const { vaultId } = opts;
  const [state, setState] = useState<ScenarioState>({
    selectedPreset: null,
    inputs: BASE_INPUTS,
    output: null,
    narrative: null,
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    (inputs: ScenarioInputs, presetId: string = "custom") => {
      setError(null);
      startTransition(async () => {
        try {
          const result = await runScenarioAction(inputs, presetId, vaultId);
          setState((prev) => ({
            ...prev,
            inputs,
            output: result,
            narrative: result.narrative,
          }));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      });
    },
    [vaultId],
  );

  const selectPreset = useCallback(
    (preset: Preset) => {
      setError(null);
      startTransition(async () => {
        try {
          const inputs = await getPresetInputsAction(preset);
          const result = await runScenarioAction(inputs, preset, vaultId);
          setState({
            selectedPreset: preset,
            inputs,
            output: result,
            narrative: result.narrative,
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      });
    },
    [vaultId],
  );

  const setInputs = useCallback((inputs: ScenarioInputs) => {
    setState((prev) => ({ ...prev, selectedPreset: null, inputs }));
  }, []);

  return { state, pending, error, submit, selectPreset, setInputs };
}
