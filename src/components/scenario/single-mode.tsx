"use client";

import { useEffect, useRef, useState } from "react";

import { InputsPanel } from "@/components/scenario/inputs-panel";
import { OutputPanel } from "@/components/scenario/output-panel";
import { ScenarioErrorBanner } from "@/components/scenario/scenario-feedback";
import { PresetBar } from "@/components/scenario/preset-bar";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { CentralTaskRunner } from "@/components/scenario/central-task-runner";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { cn } from "@/lib/cn";
import { useScenario } from "@/hooks/use-scenario";
import type { ScenarioInputs, VaultId } from "@/lib/engine/types";

export interface SingleModeProps {
  vaultId: VaultId;
  initialInputs?: ScenarioInputs;
  initialObjective?: string;
  autostart?: boolean;
  liveBtcPrice?: { usd: number; stale: boolean };
}

export function SingleMode({
  vaultId,
  initialInputs,
  initialObjective,
  autostart,
  liveBtcPrice,
}: SingleModeProps) {
  const briefInputId = "scenario-central-brief";
  const outputRef = useRef<HTMLDivElement | null>(null);
  const hasRunRef = useRef(false);
  const didAutostartRef = useRef(false);
  const runCounterRef = useRef(0);
  const [activeRunId, setActiveRunId] = useState(0);
  const [objective, setObjective] = useState(initialObjective ?? "");
  const { state, pending, error, submit, selectPreset, setInputs } =
    useScenario({ vaultId, initialInputs });

  useEffect(() => {
    if (!autostart || didAutostartRef.current) return;
    didAutostartRef.current = true;
    hasRunRef.current = true;
    setObjective((prev) => prev.trim());
    runCounterRef.current += 1;
    setActiveRunId(runCounterRef.current);
    submit(state.inputs, "chat_seeded");
  }, [autostart, state.inputs, submit]);

  useEffect(() => {
    if (!state.output || !hasRunRef.current) return;
    outputRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.output]);

  return (
    <div className="scenario-lab-single admin-doc-stack admin-doc-stack--roomy">
      {error ? <ScenarioErrorBanner message={error} /> : null}

      {/* Config — presets | inputs, both FLAT (no own surface): the parent
          lab-shell box is the single surface. Separated by a hairline, not cards. */}
      <div className="scenario-lab-config">
        <div className="scenario-lab-config__presets">
          <PresetBar
            selected={state.selectedPreset}
            onSelect={selectPreset}
            disabled={pending}
          />
        </div>

        <div className="scenario-lab-config__inputs admin-doc-stack admin-doc-stack--relaxed">
          <div className="min-w-0">
            <h3 className="h4">Inputs</h3>
            <p className="mt-[var(--ct-space-0_5)] body-xs ct-text-muted">
              Adjust sliders or load a preset.
            </p>
          </div>

          <div
            className={cn(
              pending && "pointer-events-none opacity-[var(--ct-opacity-50)]",
            )}
          >
            <InputsPanel
              inputs={state.inputs}
              onChange={setInputs}
              disabled={pending}
            />
          </div>

          {objective.trim().length > 0 ? (
            <div className="admin-doc-stack admin-doc-stack--tight">
              <label htmlFor={briefInputId} className="stat-label">
                Central brief
              </label>
              <textarea
                id={briefInputId}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Objective produit (seeded par le chat admin)"
                className="ct-textarea min-h-18 w-full resize-y body-sm"
              />
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              variant="primary"
              className="font-semibold"
              onClick={() => {
                hasRunRef.current = true;
                runCounterRef.current += 1;
                setActiveRunId(runCounterRef.current);
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
      </div>

      {/* Result continuum — runner + projection in the SAME column, directly
          below Inputs. Before the first run: a quiet placeholder. */}
      <section
        ref={outputRef}
        className="scenario-lab-result admin-doc-stack admin-doc-stack--roomy"
        aria-labelledby="single-mode-result-title"
      >
        <h3 id="single-mode-result-title" className="sr-only">
          Scenario result
        </h3>

        {activeRunId > 0 || pending ? (
          <CentralTaskRunner
            runId={activeRunId}
            objective={objective}
            pending={pending}
            output={state.output}
            liveBtcPrice={liveBtcPrice}
          />
        ) : null}

        {state.output ? (
          <OutputPanel
            output={state.output}
            isPending={pending}
            narrative={state.narrative}
          />
        ) : (
          <div
            className="scenario-lab-output-idle"
            role="status"
            aria-label="Scenario output — awaiting first run"
          >
            {pending ? (
              <div className="scenario-lab-output-idle__status">
                <Spinner className="ct-text-strong" />
                <p className="body-sm ct-text-muted m-0">Computing…</p>
              </div>
            ) : (
              <p className="body-sm ct-text-muted m-0 text-center">
                Select a preset or adjust sliders, then press Run scenario
                to see projections.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
