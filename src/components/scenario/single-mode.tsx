"use client";

// SingleMode — the "run one scenario" sub-view (inputs + output).
// Extracted from lab-shell.tsx. Owns its own state via useScenario. Behaviour
// preserved (preset bar, sliders, run button, empty/loading output states).

import { InputsPanel } from "@/components/scenario/inputs-panel";
import { OutputPanel } from "@/components/scenario/output-panel";
import { PresetBar } from "@/components/scenario/preset-bar";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useScenario } from "@/hooks/use-scenario";
import type { ScenarioInputs, VaultId } from "@/lib/engine/types";
import { useEffect, useRef } from "react";

export interface SingleModeProps {
  vaultId: VaultId;
  initialInputs?: ScenarioInputs;
}

export function SingleMode({ vaultId, initialInputs }: SingleModeProps) {
  const outputRef = useRef<HTMLDivElement | null>(null);
  const hasRunRef = useRef(false);
  const { state, pending, error, submit, selectPreset, setInputs } =
    useScenario({ vaultId, initialInputs });

  useEffect(() => {
    if (!state.output || !hasRunRef.current) return;
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.output]);

  return (
    <div className="space-y-4">
      <PresetBar
        selected={state.selectedPreset}
        onSelect={selectPreset}
        disabled={pending}
      />

      {error && (
        <p className="rounded-full border border-(--ct-status-danger) ct-status-danger-bg px-4 py-2.5 text-sm ct-status-danger">
          {error}
        </p>
      )}

      <div className="scenario-lab-workspace">
        {/* Left: Inputs panel */}
        <div className="scenario-lab-input-card glass-panel p-0">
          <div className="border-b border-(--ct-border-soft) px-5 py-4">
            <h4 className="h4">Inputs</h4>
            <p className="mt-0.5 text-xs ct-text-muted">
              Adjust sliders or select a preset above
            </p>
          </div>

          <div
            className={cn(
              "scenario-lab-input-scroll flex-1",
              pending && "pointer-events-none opacity-50",
            )}
          >
            <InputsPanel
              inputs={state.inputs}
              onChange={setInputs}
              disabled={pending}
            />
          </div>

          <div className="border-t border-(--ct-border-soft) px-5 py-4">
            <Button
              variant="primary"
              size="lg"
              className="w-full font-semibold"
              onClick={() => {
                hasRunRef.current = true;
                submit(state.inputs);
              }}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Spinner />
                  Running…
                </>
              ) : (
                "Run scenario"
              )}
            </Button>
          </div>
        </div>

        {/* Right: Output panel */}
        <div
          ref={outputRef}
          className={cn(
            "scenario-lab-output-card",
            !state.output && "glass-panel p-0",
          )}
        >
          {state.output ? (
            <OutputPanel
              output={state.output}
              isPending={pending}
              narrative={state.narrative}
            />
          ) : (
            <div
              className={cn(
                "scenario-lab-output-empty",
                "transition-opacity duration-(--ct-dur-fast)",
                pending && "opacity-50",
              )}
            >
              {pending ? (
                <>
                  <Spinner className="ct-text-strong" />
                  <p className="stat-label">Computing…</p>
                </>
              ) : (
                <>
                  <div className="scenario-lab-output-empty__icon" />
                  <p className="max-w-xs text-center text-sm ct-text-muted">
                    Select a preset or adjust sliders, then press{" "}
                    <span className="font-semibold ct-text-body">
                      Run scenario
                    </span>{" "}
                    to see projections.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
