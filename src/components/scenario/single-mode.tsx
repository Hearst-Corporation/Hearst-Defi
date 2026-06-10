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
import type { VaultId } from "@/lib/engine/types";

export interface SingleModeProps {
  vaultId: VaultId;
}

export function SingleMode({ vaultId }: SingleModeProps) {
  const { state, pending, error, submit, selectPreset, setInputs } =
    useScenario({ vaultId });

  return (
    <div className="space-y-6">
      <PresetBar
        selected={state.selectedPreset}
        onSelect={selectPreset}
        disabled={pending}
      />

      {error && (
        <p className="rounded-[var(--ct-radius-full)] border border-[var(--ct-status-danger)] bg-[var(--ct-status-danger-soft)] px-4 py-2.5 text-sm text-[var(--ct-status-danger)]">
          {error}
        </p>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(var(--ct-input-panel-min,360px),var(--ct-input-panel-max,420px))_1fr]">
        {/* Left: Inputs panel */}
        <div className="flex flex-col gap-0 glass-panel p-0 overflow-hidden">
          <div className="border-b border-[var(--ct-border-soft)] px-6 py-4">
            <h4 className="h4">Inputs</h4>
            <p className="mt-0.5 text-xs text-[var(--ct-text-muted)]">
              Adjust sliders or select a preset above
            </p>
          </div>

          <div
            className={cn(
              "flex-1 px-6 py-5",
              pending && "pointer-events-none opacity-50",
            )}
          >
            <InputsPanel
              inputs={state.inputs}
              onChange={setInputs}
              disabled={pending}
            />
          </div>

          <div className="border-t border-[var(--ct-border-soft)] px-6 py-5">
            <Button
              variant="primary"
              size="lg"
              className="w-full font-semibold"
              onClick={() => submit(state.inputs)}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Spinner />
                  Running…
                </>
              ) : (
                <>
                  <div className="h-4 w-4 ct-empty-state" />
                  Run scenario
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right: Output panel */}
        <div className="min-w-0">
          {state.output ? (
            <OutputPanel
              output={state.output}
              isPending={pending}
              narrative={state.narrative}
            />
          ) : (
            <div
              className={cn(
                "flex min-h-80 flex-col items-center justify-center gap-3",
                "glass-panel-subtle border-dashed",
                "transition-opacity duration-[var(--ct-dur-fast)]",
                pending && "opacity-50",
              )}
            >
              {pending ? (
                <>
                  <Spinner className="text-[var(--ct-text-strong)]" />
                  <p className="stat-label">Computing…</p>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 ct-empty-state" />
                  <p className="max-w-xs text-center text-sm text-[var(--ct-text-muted)]">
                    Select a preset above or adjust the sliders,{" "}
                    <br />
                    then press{" "}
                    <span className="font-semibold text-[var(--ct-text-body)]">
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
