"use client";

import { useEffect, useRef, useState } from "react";

import { InputsPanel } from "@/components/scenario/inputs-panel";
import { OutputPanel } from "@/components/scenario/output-panel";
import { PresetBar } from "@/components/scenario/preset-bar";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { CentralTaskRunner } from "@/components/scenario/central-task-runner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScenePlaceholderMetrics } from "@/components/ui/scene-placeholder-metrics";
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
    <div className="scenario-lab-single">
      <PresetBar
        selected={state.selectedPreset}
        onSelect={selectPreset}
        disabled={pending}
      />

      {error ? (
        <p
          role="alert"
          className="rounded-full border border-[var(--ct-status-danger)] bg-transparent px-4 py-2.5 body-sm ct-status-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="scenario-lab-workspace">
        <Card className="scenario-lab-input-card p-0" hoverOverlay={false}>
          <div className="scenario-lab-input-card__header">
            <h4 className="h4">Inputs</h4>
            <p className="mt-0.5 body-xs ct-text-muted">
              Adjust sliders or select a preset above
            </p>
          </div>

          <div
            className={cn(
              "scenario-lab-input-scroll",
              pending && "pointer-events-none opacity-[var(--ct-opacity-50)]",
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
        </Card>

        <section
          className="min-h-0 flex flex-col gap-4"
          aria-labelledby="single-mode-central-flow-title"
        >
          <h3 id="single-mode-central-flow-title" className="sr-only">
            Central flow
          </h3>

          {objective.trim().length > 0 ? (
            <Card className="scenario-lab-input-card p-4" hoverOverlay={false}>
              <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--baseline">
                <label htmlFor={briefInputId} className="stat-label">
                  Central brief
                </label>
              </div>
              <textarea
                id={briefInputId}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Objective produit (seeded par le chat admin)"
                className="ct-textarea mt-2 min-h-[4.5rem] w-full resize-y body-sm"
              />
            </Card>
          ) : null}

          <CentralTaskRunner
            runId={activeRunId}
            objective={objective}
            pending={pending}
            output={state.output}
            liveBtcPrice={liveBtcPrice}
          />

          <Card
            className={cn(
              "scenario-lab-output-card scenario-lab-input-card min-h-0 p-0",
              !state.output && "transition-opacity duration-(--ct-dur-fast)",
              !state.output && pending && "opacity-[var(--ct-opacity-50)]",
            )}
            hoverOverlay={false}
          >
            <div className="scenario-lab-input-card__header">
              <h4 className="h4">Output assets</h4>
              <p className="mt-0.5 body-xs ct-text-muted">Projection & narrative</p>
            </div>

            {state.output ? (
              <div ref={outputRef} className="scenario-lab-output-scroll">
                <OutputPanel
                  output={state.output}
                  isPending={pending}
                  narrative={state.narrative}
                />
              </div>
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
                  <>
                    <ScenePlaceholderMetrics className="w-full" />
                    <p className="body-sm ct-text-muted m-0">
                      Select a preset or adjust sliders, then press Run scenario
                      to see projections.
                    </p>
                  </>
                )}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
