"use client";

import { useEffect, useRef } from "react";

import { InputsPanel } from "@/components/scenario/inputs-panel";
import { OutputPanel } from "@/components/scenario/output-panel";
import { PresetBar } from "@/components/scenario/preset-bar";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useScenario } from "@/hooks/use-scenario";
import type { ScenarioInputs, VaultId } from "@/lib/engine/types";

export interface SingleModeProps {
  vaultId: VaultId;
  initialInputs?: ScenarioInputs;
}

function RunScenarioIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 ct-text-accent"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
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

      {error ? (
        <p
          role="alert"
          className="rounded-full border border-(--ct-status-danger) ct-status-danger-bg px-4 py-2.5 text-sm ct-status-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="scenario-lab-workspace">
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

        <div
          ref={outputRef}
          className={cn(
            "scenario-lab-output-card glass-panel",
            state.output ? "p-5" : "p-0",
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
              aria-live="polite"
            >
              {pending ? (
                <>
                  <Spinner className="ct-text-strong" />
                  <p className="stat-label">Computing…</p>
                </>
              ) : (
                <>
                  <div className="scenario-lab-output-empty__icon">
                    <RunScenarioIcon />
                  </div>
                  <p className="max-w-xs text-center body-sm ct-text-muted">
                    Select a preset or adjust sliders, then press{" "}
                    <span className="font-semibold ct-text-body">Run scenario</span>{" "}
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
