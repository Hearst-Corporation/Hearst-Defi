"use client";

import { useEffect, useRef } from "react";

import { InputsPanel } from "@/components/scenario/inputs-panel";
import { OutputPanel } from "@/components/scenario/output-panel";
import { PresetBar } from "@/components/scenario/preset-bar";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { Button } from "@/components/ui/button";
import { EmptySurface } from "@/components/ui/empty-surface";
import { cn } from "@/lib/cn";
import { useScenario } from "@/hooks/use-scenario";
import type { ScenarioInputs, VaultId } from "@/lib/engine/types";

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
    outputRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.output]);

  return (
    <div className="scenario-lab-single">
      <PresetBar
        selected={state.selectedPreset}
        onSelect={selectPreset}
        disabled={pending}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-full border border-(--ct-status-danger) ct-status-danger-bg px-4 py-2.5 body-sm ct-status-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="scenario-lab-workspace scenario-lab-workspace--viewport">
        <div className="scenario-lab-input-card glass-panel p-0">
          <div className="scenario-lab-input-card__header">
            <h4 className="h4">Inputs</h4>
            <p className="mt-0.5 body-xs ct-text-muted">
              Adjust sliders or select a preset above
            </p>
          </div>

          <div
            className={cn(
              "scenario-lab-input-scroll",
              pending && "pointer-events-none opacity-50",
            )}
          >
            <InputsPanel
              inputs={state.inputs}
              onChange={setInputs}
              disabled={pending}
            />
          </div>

          <div className="scenario-lab-input-footer">
            <Button
              variant="primary"
              size="lg"
              className="w-full font-semibold"
              onClick={() => {
                hasRunRef.current = true;
                submit(state.inputs);
              }}
              disabled={pending}
              aria-busy={pending}
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

        {state.output ? (
          <div
            ref={outputRef}
            className="scenario-lab-output-card glass-panel p-5"
          >
            <OutputPanel
              output={state.output}
              isPending={pending}
              narrative={state.narrative}
            />
          </div>
        ) : (
          <EmptySurface
            variant="widget"
            className={cn(
              "scenario-lab-output-card transition-opacity duration-(--ct-dur-fast)",
              pending && "opacity-50",
            )}
            message={
              pending
                ? "Computing…"
                : "Select a preset or adjust sliders, then press Run scenario to see projections."
            }
            ariaLabel="Scenario output — awaiting first run"
            role="status"
          >
            {pending ? <Spinner className="ct-text-strong" /> : null}
          </EmptySurface>
        )}
      </div>
    </div>
  );
}
