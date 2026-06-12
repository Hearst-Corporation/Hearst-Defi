"use client";

import { useEffect, useRef, useState } from "react";

import { InputsPanel } from "@/components/scenario/inputs-panel";
import { OutputPanel } from "@/components/scenario/output-panel";
import { PresetBar } from "@/components/scenario/preset-bar";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
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
  const outputRef = useRef<HTMLDivElement | null>(null);
  const hasRunRef = useRef(false);
  const didAutostartRef = useRef(false);
  const [objective, setObjective] = useState(initialObjective ?? "");
  const { state, pending, error, submit, selectPreset, setInputs } =
    useScenario({ vaultId, initialInputs });

  useEffect(() => {
    if (!autostart || didAutostartRef.current) return;
    didAutostartRef.current = true;
    hasRunRef.current = true;
    setObjective((prev) => prev.trim());
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
          className="rounded-full border border-(--ct-status-danger) ct-status-danger-bg px-4 py-2.5 body-sm ct-status-danger"
        >
          {error}
        </p>
      ) : null}

      {objective.trim().length > 0 || liveBtcPrice ? (
        <Card className="scenario-lab-input-card p-4" hoverOverlay={false}>
          <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--baseline">
            <span className="stat-label">Central brief</span>
            {liveBtcPrice ? (
              <span className="mono body-xs tabular-nums ct-text-muted">
                BTC ${liveBtcPrice.usd.toFixed(2)} {liveBtcPrice.stale ? "(stale)" : "(live)"}
              </span>
            ) : null}
          </div>
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Objective produit (seeded par le chat admin)"
            className="mt-2 min-h-[72px] w-full resize-y rounded-md border border-(--ct-border-soft) bg-transparent p-3 body-sm ct-text-body"
          />
        </Card>
      ) : null}

      <div className="scenario-lab-workspace scenario-lab-workspace--viewport">
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
        </Card>

        {state.output ? (
          <div ref={outputRef} className="scenario-lab-output-card min-h-0">
            <Card className="h-full p-5" hoverOverlay={false}>
              <OutputPanel
                output={state.output}
                isPending={pending}
                narrative={state.narrative}
              />
            </Card>
          </div>
        ) : (
          <EmptySurface
            variant="inline"
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
