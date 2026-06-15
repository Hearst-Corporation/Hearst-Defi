"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { runComparisonAction } from "@/app/admin/scenario-lab/actions";
import { DeltaRow } from "@/components/scenario/delta-row";
import { OutputPanel } from "@/components/scenario/output-panel";
import { PRESETS } from "@/components/scenario/preset-bar";
import { Spinner } from "@/components/scenario/scenario-spinner";
import { EmptySurface } from "@/components/ui/empty-surface";
import { PresetPicker } from "@/components/ui/preset-picker";
import { cn } from "@/lib/cn";
import type { Preset, ScenarioOutput, VaultId } from "@/lib/engine/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function labelFor(preset: Preset): string {
  return PRESETS.find((p) => p.id === preset)?.label ?? preset;
}

const PRESET_OPTIONS = PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
  description: p.description,
}));

// ── Placeholder panel (empty / loading) ──────────────────────────────────────

interface PlaceholderProps {
  side: "A" | "B";
  pending: boolean;
}

function Placeholder({ side, pending }: PlaceholderProps) {
  return (
    <EmptySurface
      variant="widget"
      className={cn(
        "min-h-48 transition-opacity duration-[var(--ct-dur-fast)]",
        pending && "opacity-[var(--ct-opacity-50)]",
      )}
      message={
        pending ? "Computing…" : `Pick a preset to compare — Scenario ${side}`
      }
      ariaLabel={`Scenario ${side} — awaiting preset selection`}
      role="status"
    >
      {pending ? <Spinner className="ct-text-strong" /> : null}
    </EmptySurface>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface ComparisonState {
  a: ScenarioOutput | null;
  b: ScenarioOutput | null;
}

export interface CompareModeProps {
  active?: boolean;
  /**
   * Vault context for both legs of the comparison. Both legs run against the
   * same vault — comparing two presets across two different vaults at once
   * would mix vault data, which ADR-006 #9 forbids.
   */
  vaultId?: VaultId;
}

export function CompareMode({ active = true, vaultId }: CompareModeProps) {
  const [presetA, setPresetA] = useState<Preset | null>("base");
  const [presetB, setPresetB] = useState<Preset | null>("extreme_stress");
  const [outputs, setOutputs] = useState<ComparisonState>({ a: null, b: null });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const runComparison = useCallback(
    (a: Preset, b: Preset) => {
      setError(null);
      startTransition(async () => {
        try {
          const [outA, outB] = await runComparisonAction([a, b], vaultId);
          setOutputs({ a: outA, b: outB });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      });
    },
    [vaultId],
  );

  // Auto-run on initial mount with the default pair. The refs capture the
  // initial preset values so the effect can be declared with a stable deps
  // array while still reading the correct starting state.
  const initialA = useRef(presetA);
  const initialB = useRef(presetB);
  const didRunInitial = useRef(false);
  useEffect(() => {
    if (!active) return;
    const a = initialA.current;
    const b = initialB.current;
    if (!didRunInitial.current && a && b && a !== b) {
      didRunInitial.current = true;
      runComparison(a, b);
    }
  }, [active, runComparison]);

  function handleSelectA(p: Preset) {
    // If the user picks the same preset that's on B, swap.
    const nextB = p === presetB ? presetA : presetB;
    setPresetA(p);
    setPresetB(nextB);
    if (nextB && p !== nextB) {
      runComparison(p, nextB);
    } else {
      setOutputs({ a: null, b: null });
    }
  }

  function handleSelectB(p: Preset) {
    const nextA = p === presetA ? presetB : presetA;
    setPresetB(p);
    setPresetA(nextA);
    if (nextA && p !== nextA) {
      runComparison(nextA, p);
    } else {
      setOutputs({ a: null, b: null });
    }
  }

  const showOutputs = outputs.a !== null && outputs.b !== null;

  return (
    <div className="scenario-compare-shell">
      {/* Selectors row */}
      <div className="scenario-compare-shell__selectors">
        <PresetPicker
          side="A"
          value={presetA}
          options={PRESET_OPTIONS}
          excluded={presetB}
          disabled={pending}
          onChange={handleSelectA}
        />
        <PresetPicker
          side="B"
          value={presetB}
          options={PRESET_OPTIONS}
          excluded={presetA}
          disabled={pending}
          onChange={handleSelectB}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-full border border-[var(--ct-status-danger)] bg-transparent px-4 py-2.5 body-sm ct-status-danger"
        >
          {error}
        </p>
      )}

      {/* Panels row */}
      <div className="scenario-compare-shell__panels">
        {showOutputs && presetA && outputs.a ? (
          <OutputPanel
            variant="compact"
            output={outputs.a}
            presetLabel={labelFor(presetA)}
            side="A"
            isPending={pending}
          />
        ) : (
          <Placeholder side="A" pending={pending && !!presetA} />
        )}

        {showOutputs && presetB && outputs.b ? (
          <OutputPanel
            variant="compact"
            output={outputs.b}
            presetLabel={labelFor(presetB)}
            side="B"
            vs={outputs.a}
            isPending={pending}
          />
        ) : (
          <Placeholder side="B" pending={pending && !!presetB} />
        )}
      </div>

      {/* Delta row: B vs A */}
      {showOutputs && outputs.a && outputs.b && (
        <DeltaRow a={outputs.a} b={outputs.b} />
      )}

      {/* Shared disclaimer */}
      <p className="border-t border-[var(--ct-border-soft)] pt-4 body-xs italic ct-text-muted">
        <span className="font-semibold not-italic ct-text-body">
          Not guaranteed.
        </span>{" "}
        Projections are conditional on stated assumptions. Methodology v1.0. Past
        performance does not predict future returns.
      </p>
    </div>
  );
}
