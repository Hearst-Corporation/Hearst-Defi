"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ApyRange } from "@/components/ui/apy-range";
import {
  BENTO_PRIMARY_BTN,
  BentoHeader,
  BentoPanel,
} from "@/components/ui/bento";
import { Metric } from "@/components/ui/metric";
import { Ptai } from "@/components/ui/ptai";
import { Progress } from "@/components/ui/progress";
import {
  allocationStrokeFor,
  allocationLabelFor,
} from "@/lib/allocation-colors";
import { cn } from "@/lib/cn";
import { getPresetMetas } from "@/lib/engine/preset-meta";
import type { ScenarioInputs } from "@/lib/engine/types";
import {
  runProjectionStudy,
  promoteStudyToDraft,
  getPresetInputsForProjection,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Preset = "base" | "btc_bear" | "btc_bull" | "mining_compression" | "extreme_stress";

type MatrixCell = {
  apyLow: number;
  apyHigh: number;
  riskScore: number;
  scenarioRunId: string;
  allocations: { bucket: string; pct: number }[];
  confidence: string;
};

type StudyResult = {
  studyId: string;
  runIds: string[];
  matrix: {
    x?: string;
    y?: string;
    cells: MatrixCell[];
  };
};

type BatchMode = "none" | "1d" | "2d";

// ─── Constants ────────────────────────────────────────────────────────────────

// Single source of truth: labels + descriptions derived from the engine's
// canonical preset inputs (was a divergent hand-typed copy of preset-bar's).
const PRESETS: { id: Preset; label: string; description: string }[] =
  getPresetMetas();

// Default BTC chg variation sweep for 1D batch
const DEFAULT_1D_VALUES = [-30, -15, 0, 15, 30];
// Default BTC chg × hashprice 3×3 grid for 2D batch
const DEFAULT_2D_X_VALUES = [-30, 0, 30];
const DEFAULT_2D_Y_VALUES = [0.05, 0.085, 0.12];

// ─── Bento style tokens (Portfolio canon) ────────────────────────────────────

// Nested sub-surface inside a black bento panel.
const SUB_SURFACE = "rounded-lg border border-[var(--ct-border)] bg-surface-inset";
// Micro uppercase eyebrow label (role class).
const EYEBROW = "ct-bento-label";

// ─── Risk color helpers (status tokens — success/warning/danger) ──────────────

// Risk band thresholds (0–100) — single source shared by both color helpers and
// the PTAI rebalancing-trigger copy below, so the number can't drift apart.
const RISK_SUCCESS_MAX = 35;
const RISK_WARN_MAX = 65;

function riskTextClass(score: number): string {
  if (score <= RISK_SUCCESS_MAX) return "text-[var(--ct-accent)]";
  if (score <= RISK_WARN_MAX) return "text-[var(--ct-status-warning)]";
  return "text-[var(--ct-status-danger)]";
}

function riskBgClass(score: number): string {
  if (score <= RISK_SUCCESS_MAX) return "bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)]";
  if (score <= RISK_WARN_MAX) return "bg-[color-mix(in_srgb,var(--ct-status-warning)_10%,transparent)]";
  return "bg-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)]";
}

// ─── Slider primitive ─────────────────────────────────────────────────────────

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

function SliderField({ label, value, min, max, step, onChange, format }: SliderProps) {
  const fmt = format ?? ((v: number) => v.toFixed(2));

  // Visual validation for extreme values
  const isBtcExtreme = label === "BTC Price Change" && Math.abs(value) >= 100;
  const isHashExtreme = label === "Hashprice" && (value <= 0.03 || value >= 0.3);
  const isExtreme = isBtcExtreme || isHashExtreme;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label
          className={cn(
            "ct-metric-caption cursor-pointer select-none font-medium transition-colors",
            isExtreme ? "font-bold text-[var(--ct-status-warning)]" : "text-[var(--ct-text-body)]",
          )}
        >
          {label}
          {isExtreme && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wider opacity-80">
              (Extreme)
            </span>
          )}
        </label>
        <span
          className={cn(
            "ct-metric-value font-mono transition-colors",
            isExtreme ? "text-[var(--ct-status-warning)]" : "text-[var(--ct-text-strong)]",
          )}
        >
          {fmt(value)}
        </span>
      </div>
      <div className="relative flex h-6 items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn(
            "projection-studio-range w-full",
            isExtreme && "projection-studio-range--extreme",
          )}
          aria-label={`${label} (range ${fmt(min)}–${fmt(max)})`}
        />
      </div>
    </div>
  );
}

// ─── Allocation Visualization ───────────────────────────────────────────────

function AllocationBreakdown({ allocations }: { allocations: MatrixCell["allocations"] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className={EYEBROW}>Derived Allocation</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allocations.map((alloc) => {
          const color = allocationStrokeFor(alloc.bucket);
          const label = allocationLabelFor(alloc.bucket);
          return (
            <div key={alloc.bucket} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="ct-metric-value font-semibold">{label}</span>
                </div>
                <span className="ct-metric-value font-mono">
                  {(alloc.pct * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={alloc.pct * 100}
                max={100}
                className="h-1"
                // @ts-expect-error - custom style for progress fill
                style={{ "--ct-progress-fill": color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Assumptions Strip ───────────────────────────────────────────────────────

function AssumptionsStrip({ inputs }: { inputs: ScenarioInputs }) {
  const items = [
    { label: "BTC", value: `${inputs.btc_price_change_pct > 0 ? "+" : ""}${inputs.btc_price_change_pct}%` },
    { label: "Hashprice", value: `$${inputs.hashprice_usd_th_day.toFixed(3)}` },
    { label: "Energy", value: `$${inputs.energy_cost_kwh.toFixed(3)}` },
    { label: "Stable APY", value: `${inputs.stable_apy_pct}%` },
    { label: "Vol", value: inputs.vol_index },
  ];

  return (
    <div
      className={cn(
        "no-scrollbar flex flex-nowrap items-center gap-4 overflow-x-auto px-4 py-2",
        SUB_SURFACE,
      )}
    >
      <span className={cn(EYEBROW, "whitespace-nowrap")}>Inputs</span>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="ct-metric-caption">{item.label}:</span>
          <span className="ct-metric-value font-mono font-bold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Heatmap grid ─────────────────────────────────────────────────────────────

type HeatmapProps = {
  cells: MatrixCell[];
  xAxis?: string;
  yAxis?: string;
  xValues?: number[];
  yValues?: number[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
};

function Heatmap({ cells, xAxis, yAxis, xValues, yValues, selectedRunId, onSelect }: HeatmapProps) {
  const is2D = !!yAxis && yValues && yValues.length > 0 && xValues && xValues.length > 0;
  const cols = is2D ? (xValues?.length ?? 1) : cells.length;
  const rows = is2D ? (yValues?.length ?? 1) : 1;

  return (
    <div className="flex flex-col gap-3">
      {xAxis && (
        <div className="ct-metric-caption flex select-none items-center gap-2">
          <span className={EYEBROW}>Axis</span>
          <span className="rounded border border-[var(--ct-border)] bg-surface-inset px-1 font-mono text-[var(--ct-text-body)]">{xAxis}</span>
          {yAxis && (
            <>
              <span className="text-[var(--ct-text-faint)]">×</span>
              <span className="rounded border border-[var(--ct-border)] bg-surface-inset px-1 font-mono text-[var(--ct-text-body)]">{yAxis}</span>
            </>
          )}
        </div>
      )}
      <div
        className="rounded-xl border border-[var(--ct-border)] bg-surface-card p-1"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, auto)`,
          gap: "2px",
        }}
        role="grid"
        aria-label="Projection heatmap"
      >
        {cells.map((cell, idx) => {
          const isSelected = cell.scenarioRunId === selectedRunId;
          return (
            <motion.button
              key={cell.scenarioRunId}
              layoutId={cell.scenarioRunId}
              type="button"
              role="gridcell"
              onClick={() => onSelect(cell.scenarioRunId)}
              aria-selected={isSelected}
              aria-label={`APY ${cell.apyLow.toFixed(1)}–${cell.apyHigh.toFixed(1)}%, risk ${cell.riskScore}. Cell ${idx + 1} of ${cells.length}.`}
              whileHover={{
                zIndex: 20,
              }}
              whileTap={{ scale: 0.98 }}
              animate={{
                scale: isSelected ? 1.02 : 1,
                zIndex: isSelected ? 10 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              className={cn(
                "relative rounded-lg border p-2.5 text-left transition-colors",
                riskBgClass(cell.riskScore),
                isSelected
                  ? "border-[var(--ct-border-strong)] opacity-100"
                  : "border-[var(--ct-border-soft)] opacity-70 hover:opacity-100",
              )}
            >
              <div className="flex flex-col gap-1.5">
                <span
                  className={cn(
                    "ct-metric-value font-mono font-bold leading-tight",
                    isSelected ? "text-[var(--ct-text-strong)]" : riskTextClass(cell.riskScore),
                  )}
                >
                  {cell.apyLow.toFixed(1)}–{cell.apyHigh.toFixed(1)}%
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-wider opacity-80",
                    isSelected ? "text-[var(--ct-text-strong)]" : "text-[var(--ct-text-muted)]",
                  )}
                >
                  R {cell.riskScore}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Execution-mode segmented control (bento) ─────────────────────────────────

function ExecutionModeControl({
  value,
  onChange,
}: {
  value: BatchMode;
  onChange: (v: BatchMode) => void;
}) {
  const items: { value: BatchMode; label: string }[] = [
    { value: "none", label: "Single" },
    { value: "1d", label: "1D Sweep" },
    { value: "2d", label: "2D Matrix" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Execution mode"
      className="inline-flex gap-1 rounded-lg border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] p-1"
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "ct-metric-caption rounded-md px-3 py-1.5 font-bold transition-colors",
              active
                ? "bg-[var(--ct-text-strong)] text-[var(--ct-bg-deep)] shadow-sm"
                : "text-[var(--ct-text-muted)] hover:text-[var(--ct-text-body)]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main studio ──────────────────────────────────────────────────────────────

export function ProjectionStudio() {
  const router = useRouter();
  const outputRef = useRef<HTMLElement | null>(null);
  const hasRunRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [isPromoting, startPromote] = useTransition();

  // Input state
  const [btcChange, setBtcChange] = useState(0);
  const [hashprice, setHashprice] = useState(0.085);
  const [energyCost, setEnergyCost] = useState(0.045);
  const [stableApy, setStableApy] = useState(4.5);
  const [volIndex, setVolIndex] = useState(45);
  const [batchMode, setBatchMode] = useState<BatchMode>("none");
  const [methodologyVersion] = useState("v1.0");
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);

  // Output state
  const [result, setResult] = useState<StudyResult | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  // Preset loader
  const loadPreset = useCallback(
    (preset: Preset) => {
      setSelectedPreset(preset);
      startTransition(async () => {
        try {
          const inputs = await getPresetInputsForProjection(preset);
          setBtcChange(inputs.btc_price_change_pct);
          setHashprice(inputs.hashprice_usd_th_day);
          setEnergyCost(inputs.energy_cost_kwh);
          setStableApy(inputs.stable_apy_pct);
          setVolIndex(inputs.vol_index);
        } catch {
          setError("Failed to load preset.");
        }
      });
    },
    [],
  );

  const handleRun = useCallback(() => {
    setError(null);
    hasRunRef.current = true;
    startTransition(async () => {
      try {
        const currentInputs = {
          btc_price_change_pct: btcChange,
          hashprice_usd_th_day: hashprice,
          energy_cost_kwh: energyCost,
          stable_apy_pct: stableApy,
          vol_index: volIndex,
        };

        let axes:
          | [
              { field: "btc_price_change_pct" | "hashprice_usd_th_day" | "stable_apy_pct"; values: number[] },
              { field: "btc_price_change_pct" | "hashprice_usd_th_day" | "stable_apy_pct"; values: number[] }?,
            ]
          | undefined;

        if (batchMode === "1d") {
          axes = [{ field: "btc_price_change_pct", values: DEFAULT_1D_VALUES }];
        } else if (batchMode === "2d") {
          axes = [
            { field: "btc_price_change_pct", values: DEFAULT_2D_X_VALUES },
            { field: "hashprice_usd_th_day", values: DEFAULT_2D_Y_VALUES },
          ];
        }

        const res = await runProjectionStudy({
          base: currentInputs,
          axes,
          label: batchMode === "none" ? "Single run" : batchMode === "1d" ? "1D batch — BTC" : "2D batch — BTC × Hashprice",
        });

        setResult(res);
        setSelectedRunId(res.runIds[0] ?? null);
        setLastRunAt(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error.");
      }
    });
  }, [btcChange, hashprice, energyCost, stableApy, volIndex, batchMode]);

  const handlePromote = useCallback(() => {
    if (!result) return;
    setError(null);
    startPromote(async () => {
      try {
        const { deploymentId } = await promoteStudyToDraft(result.studyId);
        router.push(`/admin/vaults/${deploymentId}/edit`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Promotion failed.");
      }
    });
  }, [result, router]);

  // Derive selected cell for single-run output
  const selectedCell = result?.matrix.cells.find(
    (c) => c.scenarioRunId === selectedRunId,
  ) ?? result?.matrix.cells[0] ?? null;

  // 2D axis values (for heatmap label context)
  const xVals = batchMode === "2d" ? DEFAULT_2D_X_VALUES : batchMode === "1d" ? DEFAULT_1D_VALUES : undefined;
  const yVals = batchMode === "2d" ? DEFAULT_2D_Y_VALUES : undefined;

  useEffect(() => {
    if (!result || !hasRunRef.current) return;
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── PRESETS ──────────────────────────────────────────────────────── */}
      <BentoPanel>
        <BentoHeader
          title="Presets"
          subtitle="Load assumptions, then tune inputs below."
        />
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => {
            const active = selectedPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => loadPreset(p.id)}
                disabled={isPending}
                aria-pressed={active}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors disabled:opacity-50",
                  active
                    ? "border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)]"
                    : "border-[var(--ct-border)] bg-surface-inset hover:border-[var(--ct-border-strong)]",
                )}
              >
                <span
                  className={cn(
                    "ct-metric-value font-semibold",
                    active ? "text-[var(--ct-accent)]" : "text-[var(--ct-text-strong)]",
                  )}
                >
                  {p.label}
                </span>
                <span className="ct-metric-caption leading-snug">{p.description}</span>
              </button>
            );
          })}
        </div>
      </BentoPanel>

      {/* ── INPUTS ───────────────────────────────────────────────────────── */}
      <BentoPanel>
        <BentoHeader
          title="Projection inputs"
          subtitle={`Adjust sliders or load a preset · Methodology ${methodologyVersion}`}
        />
        <div className="flex flex-col gap-6 p-5">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Market Environment */}
            <div className="flex flex-col gap-4">
              <p className={EYEBROW}>Market Environment</p>
              <SliderField
                label="BTC Price Change"
                value={btcChange}
                min={-100}
                max={300}
                step={1}
                onChange={setBtcChange}
                format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
              />
              <SliderField
                label="Hashprice"
                value={hashprice}
                min={0.01}
                max={0.5}
                step={0.001}
                onChange={setHashprice}
                format={(v) => `$${v.toFixed(3)}/TH`}
              />
              <SliderField
                label="Vol Index"
                value={volIndex}
                min={0}
                max={100}
                step={1}
                onChange={setVolIndex}
                format={(v) => v.toFixed(0)}
              />
            </div>

            {/* Network & Yield */}
            <div className="flex flex-col gap-4">
              <p className={EYEBROW}>Network & Yield</p>
              <SliderField
                label="Energy Cost"
                value={energyCost}
                min={0.01}
                max={1}
                step={0.001}
                onChange={setEnergyCost}
                format={(v) => `$${v.toFixed(3)}/kWh`}
              />
              <SliderField
                label="Stable APY"
                value={stableApy}
                min={0}
                max={30}
                step={0.1}
                onChange={setStableApy}
                format={(v) => `${v.toFixed(1)}%`}
              />

              {/* Execution Mode */}
              <div className="mt-2 flex flex-col gap-2">
                <p className={EYEBROW}>Execution Mode</p>
                <ExecutionModeControl value={batchMode} onChange={setBatchMode} />
                {batchMode === "1d" && (
                  <p className="ct-metric-caption italic">
                    BTC sweep: <span className="font-mono text-[var(--ct-text-body)]">{DEFAULT_1D_VALUES.join(", ")}%</span>
                  </p>
                )}
                {batchMode === "2d" && (
                  <p className="ct-metric-caption italic">
                    BTC sweep × Hashprice (3×3 matrix)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Allocation Context */}
          <div className={cn("p-4", SUB_SURFACE)}>
            <p className={cn(EYEBROW, "mb-1")}>Allocation Note</p>
            <p className="ct-metric-caption leading-relaxed">
              Derived by engine from scenario inputs. Not manually adjustable here.
              Run projection to see derived targets.
            </p>
          </div>

          {error && (
            <p className="ct-metric-caption rounded-lg border border-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)] px-3 py-2 text-[var(--ct-status-danger)]">
              {error}
            </p>
          )}

          {/* Run button */}
          <div className="flex justify-end">
            <button
              type="button"
              className={BENTO_PRIMARY_BTN}
              onClick={handleRun}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending
                ? batchMode === "none"
                  ? "Running…"
                  : "Running batch…"
                : batchMode === "none"
                  ? "Run projection"
                  : batchMode === "1d"
                    ? "Run 1D Batch (5 runs)"
                    : "Run 2D Batch (9 runs)"}
            </button>
          </div>
        </div>
      </BentoPanel>

      {/* ── RESULT ───────────────────────────────────────────────────────── */}
      <section ref={outputRef} aria-labelledby="projection-result-title">
        <h3 id="projection-result-title" className="sr-only">
          Projection result
        </h3>
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              role="status"
              aria-label="Projection output — awaiting first run"
            >
              <BentoPanel>
                <BentoHeader title="Projection Output" />
                <div className="flex max-w-lg flex-col gap-3 p-5">
                  <p className="ct-metric-caption">
                    Configure market assumptions and network parameters, then run projection to generate yield estimates.
                  </p>
                  <div className="pt-2">
                    <p className={cn(EYEBROW, "mb-2")}>Workflow</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="ct-metric-caption">
                        <span className="font-mono text-[var(--ct-text-muted)]">1.</span> Select preset
                      </span>
                      <span className="ct-metric-caption">
                        <span className="font-mono text-[var(--ct-text-muted)]">2.</span> Tune inputs
                      </span>
                      <span className="ct-metric-caption">
                        <span className="font-mono text-[var(--ct-text-muted)]">3.</span> Run projection
                      </span>
                    </div>
                  </div>
                </div>
              </BentoPanel>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <BentoPanel>
                {/* Study metadata header */}
                <BentoHeader
                  title="Projection output"
                  subtitle={lastRunAt ? `Last run: ${lastRunAt.toLocaleTimeString()}` : undefined}
                  trailing={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="ct-metric-caption rounded-md px-2 py-1 font-mono transition-colors hover:text-[var(--ct-text-strong)]"
                        onClick={() => {
                          navigator.clipboard.writeText(result.studyId);
                          toast.success("Study ID copied to clipboard");
                        }}
                      >
                        Copy ID
                      </button>
                      <button
                        type="button"
                        className="ct-metric-caption rounded-md px-2 py-1 font-mono transition-colors hover:text-[var(--ct-text-strong)]"
                        onClick={() => toast.info("Export to PDF/CSV coming soon")}
                      >
                        Export
                      </button>
                      <span className="ct-metric-caption rounded-md border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-2 py-1 font-mono">
                        ID {result.studyId.slice(-8)}
                      </span>
                      <span className="ct-metric-caption rounded-md border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] px-2 py-1 font-bold text-[var(--ct-accent)]">
                        {result.runIds.length} {result.runIds.length > 1 ? "Runs" : "Run"}
                      </span>
                    </div>
                  }
                />

                <div className="flex flex-col gap-4 p-5">
                  {/* Assumptions Strip */}
                  <AssumptionsStrip
                    inputs={{
                      btc_price_change_pct: btcChange,
                      hashprice_usd_th_day: hashprice,
                      energy_cost_kwh: energyCost,
                      stable_apy_pct: stableApy,
                      vol_index: volIndex,
                    }}
                  />

                  {/* Single run: KPI grid */}
                  {result.runIds.length === 1 && selectedCell && (
                    <div className={cn("grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-3", SUB_SURFACE)}>
                      <div className="bg-surface-inset p-4">
                        <Metric
                          label="APY Range"
                          provenance="estimated"
                          value={
                            <ApyRange low={selectedCell.apyLow} high={selectedCell.apyHigh} precision={1} />
                          }
                        />
                      </div>
                      <div className="bg-surface-inset p-4">
                        <Metric
                          label="Risk Score"
                          provenance="estimated"
                          value={
                            <span className={cn("tabular-nums", riskTextClass(selectedCell.riskScore))}>
                              {selectedCell.riskScore}
                            </span>
                          }
                        />
                      </div>
                      <div className="bg-surface-inset p-4">
                        <Metric
                          label="Confidence"
                          provenance="estimated"
                          value={
                            <span
                              className={cn(
                                "text-[12px] uppercase tracking-wider",
                                selectedCell.confidence === "high"
                                  ? "text-[var(--ct-accent)]"
                                  : selectedCell.confidence === "medium"
                                    ? "text-[var(--ct-status-warning)]"
                                    : "text-[var(--ct-status-danger)]",
                              )}
                            >
                              {selectedCell.confidence}
                            </span>
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Batch: heatmap */}
                  {result.runIds.length > 1 && (
                    <div className="flex flex-col gap-3">
                      <p className={EYEBROW}>Sensitivity Matrix</p>
                      <Heatmap
                        cells={result.matrix.cells}
                        xAxis={result.matrix.x}
                        yAxis={result.matrix.y}
                        xValues={xVals}
                        yValues={yVals}
                        selectedRunId={selectedRunId}
                        onSelect={setSelectedRunId}
                      />
                    </div>
                  )}

                  {/* Selected cell detail (batch) */}
                  {result.runIds.length > 1 && selectedCell && (
                    <div className={cn("grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-3", SUB_SURFACE)}>
                      <div className="bg-surface-inset p-4">
                        <Metric
                          label="Selected APY Range"
                          provenance="estimated"
                          value={
                            <ApyRange low={selectedCell.apyLow} high={selectedCell.apyHigh} precision={1} />
                          }
                        />
                      </div>
                      <div className="bg-surface-inset p-4">
                        <Metric
                          label="Risk Score"
                          provenance="estimated"
                          value={
                            <span className={cn("tabular-nums", riskTextClass(selectedCell.riskScore))}>
                              {selectedCell.riskScore}
                            </span>
                          }
                        />
                      </div>
                      <div className="bg-surface-inset p-4">
                        <Metric
                          label="Confidence"
                          provenance="estimated"
                          value={
                            <span
                              className={cn(
                                "text-[12px] uppercase tracking-wider",
                                selectedCell.confidence === "high"
                                  ? "text-[var(--ct-accent)]"
                                  : selectedCell.confidence === "medium"
                                    ? "text-[var(--ct-status-warning)]"
                                    : "text-[var(--ct-status-danger)]",
                              )}
                            >
                              {selectedCell.confidence}
                            </span>
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Allocation Breakdown */}
                  {selectedCell && (
                    <AllocationBreakdown allocations={selectedCell.allocations} />
                  )}

                  {/* PTAI block — mandatory for every projection (#3) */}
                  {selectedCell && (
                    <div className={cn("p-4", SUB_SURFACE)}>
                      <p className={cn(EYEBROW, "mb-3")}>PTAI Projection Impact</p>
                      <Ptai
                        projection={`APY range ${selectedCell.apyLow.toFixed(1)}–${selectedCell.apyHigh.toFixed(1)}% under current assumptions (methodology v1.0). Not guaranteed — projections are conditional on stated inputs.`}
                        trigger={`Risk score ${selectedCell.riskScore}/100 computed from vol_index, hashprice margin, and BTC price change inputs. Rebalancing rule activates when risk > ${RISK_WARN_MAX}.`}
                        action={`Admin review of projection study ${result.studyId.slice(-8)} required before promotion. Promote to vault draft via button below.`}
                        impact={`Target APY range seeded into VaultDeployment (draft status). Requires 2-of-N multisig approval before going live. Past performance does not predict future results.`}
                      />
                    </div>
                  )}

                  {/* Readiness Note */}
                  <div className={cn("flex flex-col gap-1 p-4", SUB_SURFACE)}>
                    <p className="ct-metric-value font-medium">
                      Projection is ready for promotion.
                    </p>
                    <p className="ct-metric-caption">
                      The model outputs are consistent with the selected methodology (v1.0). Promotion will create a draft deployment for further refinement.
                    </p>
                  </div>

                  {/* "Not guaranteed" disclaimer — non-negotiable #10 */}
                  <p className="ct-metric-caption italic leading-relaxed">
                    <strong className="not-italic text-[var(--ct-text-body)]">Disclaimer:</strong>{" "}
                    Projections are conditional on stated assumptions and are not guaranteed.
                    Rule-based engine — no Monte Carlo. Past performance does not predict future
                    results. Hearst Yield Vault is offered exclusively to professional / qualified
                    investors. Not an offer or solicitation where prohibited.
                  </p>

                  {/* Promote to vault draft */}
                  <div className="flex flex-wrap items-center gap-4 border-t border-[var(--ct-border-soft)] pt-4">
                    <button
                      type="button"
                      className={BENTO_PRIMARY_BTN}
                      onClick={handlePromote}
                      disabled={isPromoting || !result}
                      aria-busy={isPromoting}
                    >
                      {isPromoting ? "Promoting…" : "Promote to Vault Draft"}
                    </button>
                    <span className="ct-metric-caption">
                      Seeds APY range into a new VaultDeployment (draft)
                    </span>
                  </div>
                </div>
              </BentoPanel>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
