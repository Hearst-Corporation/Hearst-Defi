"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { Ptai } from "@/components/ui/ptai";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { PanelStatus, PanelStatusAccent, PanelStatusSection } from "@/components/ui/panel-status";
import { Progress } from "@/components/ui/progress";
import {
  allocationStrokeFor,
  allocationLabelFor,
} from "@/lib/allocation-colors";
import { cn } from "@/lib/cn";
import { getPresetMetas } from "@/lib/engine/preset-meta";
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

const METHODOLOGY_VERSIONS = [{ id: "v1.0", label: "v1.0 (current)" }];

// ─── Risk color helper (uses status tokens, no hardcoded hex) ─────────────────

// Risk band thresholds (0–100) — single source shared by both color helpers and
// the PTAI rebalancing-trigger copy below, so the number can't drift apart.
const RISK_SUCCESS_MAX = 35;
const RISK_WARN_MAX = 65;

function riskTextClass(score: number): string {
  if (score <= RISK_SUCCESS_MAX) return "ct-status-success";
  if (score <= RISK_WARN_MAX) return "ct-status-warning";
  return "ct-status-danger";
}

function riskBgClass(score: number): string {
  if (score <= RISK_SUCCESS_MAX) return "ct-status-success-bg";
  if (score <= RISK_WARN_MAX) return "ct-status-warning-bg";
  return "ct-status-danger-bg";
}

// ─── Slider primitive (uses ct-input class, Cockpit-themed) ──────────────────

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
    <div className="admin-doc-stack admin-doc-stack--micro">
      <div className="admin-doc-inline-row admin-doc-inline-row--between">
        <label className={cn(
          "ct-form-label mb-0 cursor-pointer select-none transition-colors duration-300",
          isExtreme ? "ct-text-warning font-bold" : "ct-text-muted"
        )}>
          {label}
          {isExtreme && (
            <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-80">
              (Extreme)
            </span>
          )}
        </label>
        <span className={cn(
          "mono tabular body-xs font-semibold transition-colors duration-300",
          isExtreme ? "ct-text-warning" : "ct-text-primary"
        )}>
          {fmt(value)}
        </span>
      </div>
      <div className="relative flex items-center h-6">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn(
            "projection-studio-range w-full",
            isExtreme && "projection-studio-range--extreme"
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
    <div className="admin-doc-stack admin-doc-stack--compact">
      <p className="eyebrow ct-text-muted">Derived Allocation</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-(--ct-space-4)">
        {allocations.map((alloc) => {
          const color = allocationStrokeFor(alloc.bucket);
          const label = allocationLabelFor(alloc.bucket);
          return (
            <div key={alloc.bucket} className="admin-doc-stack admin-doc-stack--micro">
              <div className="admin-doc-inline-row admin-doc-inline-row--between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="body-xs font-semibold ct-text-strong">{label}</span>
                </div>
                <span className="mono tabular body-xs ct-text-primary">
                  {(alloc.pct * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={alloc.pct * 100}
                max={100}
                className="h-1"
                // @ts-ignore - custom style for progress fill
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

function AssumptionsStrip({ inputs }: { inputs: any }) {
  const items = [
    { label: "BTC", value: `${inputs.btc_price_change_pct > 0 ? "+" : ""}${inputs.btc_price_change_pct}%` },
    { label: "Hashprice", value: `$${inputs.hashprice_usd_th_day.toFixed(3)}` },
    { label: "Energy", value: `$${inputs.energy_cost_kwh.toFixed(3)}` },
    { label: "Stable APY", value: `${inputs.stable_apy_pct}%` },
    { label: "Vol", value: inputs.vol_index },
  ];

  return (
    <div className="flex items-center gap-(--ct-space-4) py-(--ct-space-2) px-(--ct-space-4) bg-(--ct-surface-1) border border-(--ct-border-soft) rounded-(--ct-radius-md) overflow-x-auto no-scrollbar flex-nowrap">
      <span className="eyebrow text-[10px] ct-text-muted whitespace-nowrap">Inputs</span>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="body-xs ct-text-faint">{item.label}:</span>
          <span className="mono tabular body-xs font-bold ct-text-primary">{item.value}</span>
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
    <div className="admin-doc-stack admin-doc-stack--actions">
      {xAxis && (
        <div className="flex items-center gap-(--ct-space-2) body-xs ct-text-muted select-none">
          <span className="eyebrow text-[10px]">Axis</span>
          <span className="mono ct-text-body px-1 bg-(--ct-graphite-nested-bg) rounded border border-(--ct-border-soft)">{xAxis}</span>
          {yAxis && (
            <>
              <span className="ct-text-faint">×</span>
              <span className="mono ct-text-body px-1 bg-(--ct-graphite-nested-bg) rounded border border-(--ct-border-soft)">{yAxis}</span>
            </>
          )}
        </div>
      )}
      <div
        className="admin-doc-grid-dense p-1 bg-(--ct-bg-deep) rounded-(--ct-radius-lg) border border-(--ct-border-soft)"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, auto)`,
          gap: '2px',
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
                scale: 1.02, 
                zIndex: 20,
                boxShadow: "0 0 20px rgba(167, 251, 144, 0.15)"
              }}
              whileTap={{ scale: 0.98 }}
              animate={{
                scale: isSelected ? 1.05 : 1,
                zIndex: isSelected ? 10 : 1,
              }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 25 
              }}
              className={cn(
                "admin-strategy-heatmap-cell border-0 transition-colors duration-300 relative",
                riskBgClass(cell.riskScore),
                isSelected ? "opacity-100 shadow-(--ct-shadow-elevated) ring-2 ring-(--ct-accent) ring-offset-2 ring-offset-(--ct-bg-deep)" : "opacity-70 hover:opacity-100",
              )}
            >
              <div className="admin-doc-stack admin-doc-stack--micro">
                <span
                  className={cn("mono tabular body-xs font-bold leading-tight", isSelected ? "ct-text-strong" : riskTextClass(cell.riskScore))}
                >
                  {cell.apyLow.toFixed(1)}–{cell.apyHigh.toFixed(1)}%
                </span>
                <span className={cn("eyebrow text-[9px] mono opacity-80", isSelected ? "ct-text-strong" : "ct-text-muted")}>
                  R {cell.riskScore}
                </span>
              </div>
              {isSelected && (
                <motion.div
                  layoutId="active-cell-glow"
                  className="absolute inset-0 rounded-inherit pointer-events-none ring-1 ring-(--ct-accent) opacity-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main studio ──────────────────────────────────────────────────────────────

export function ProjectionStudio() {
  const router = useRouter();
  const outputRef = useRef<HTMLDivElement | null>(null);
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
    <div className="projection-studio-shell">
      <div className="projection-studio-preset-strip">
        <div className="projection-studio-preset-strip__head">
          <span className="eyebrow ct-text-muted">Presets</span>
          <span className="body-xs ct-text-faint">Load assumptions, then tune inputs below.</span>
        </div>
        <div className="projection-studio-preset-rail__items">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              variant={selectedPreset === p.id ? "primary" : "secondary"}
              size="sm"
              onClick={() => loadPreset(p.id)}
              disabled={isPending}
              aria-pressed={selectedPreset === p.id}
              className="projection-studio-preset-button"
            >
              <span className="projection-studio-preset-button__label">{p.label}</span>
              <span className="projection-studio-preset-button__description">{p.description}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className={cn("projection-studio-workspace", result ? "projection-studio-workspace--filled" : "projection-studio-workspace--empty")}>
      {/* ── LEFT: INPUTS ── */}
      <Card material="flat" hoverOverlay={false} className="projection-studio-input-card">
        <DashboardPanelHeader
          title="Projection inputs"
          eyebrow="Control panel"
          subtitle={`Methodology ${methodologyVersion}`}
          className="px-(--ct-space-5) pt-(--ct-space-5) pb-(--ct-space-2)"
        />

        <div className="projection-studio-input-scroll px-(--ct-space-5)">
        {/* Market Environment */}
        <div className="projection-studio-input-group mt-(--ct-space-4)">
          <p className="eyebrow ct-text-muted mb-(--ct-space-3)">Market Environment</p>
          <div className="admin-doc-stack admin-doc-stack--actions">
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
        </div>

        <div className="projection-studio-input-divider" />

        {/* Network & Yield */}
        <div className="projection-studio-input-group">
          <p className="eyebrow ct-text-muted mb-(--ct-space-3)">Network & Yield</p>
          <div className="admin-doc-stack admin-doc-stack--actions">
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
          </div>
        </div>

        <div className="projection-studio-input-divider" />

        {/* Execution Mode */}
        <div className="admin-doc-stack admin-doc-stack--actions">
          <p className="eyebrow ct-text-muted">Execution Mode</p>
          <div className="admin-doc-inline-row">
            {(
              [
                { id: "none", label: "Single" },
                { id: "1d", label: "1D Sweep" },
                { id: "2d", label: "2D Matrix" },
              ] as { id: BatchMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setBatchMode(m.id)}
                className={cn(
                  "ct-pill body-xs select-none transition-all",
                  batchMode === m.id ? "accent" : "ct-text-muted hover:ct-text-body"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          {batchMode === "1d" && (
            <p className="body-xs ct-text-faint italic">
              BTC sweep: <span className="mono ct-text-muted">{DEFAULT_1D_VALUES.join(", ")}%</span>
            </p>
          )}
          {batchMode === "2d" && (
            <p className="body-xs ct-text-faint italic">
              BTC sweep × Hashprice (3×3 matrix)
            </p>
          )}
        </div>

        <div className="projection-studio-input-divider" />

        {/* Allocation Context */}
        <div className="admin-inset-panel admin-inset-panel--md">
          <p className="eyebrow ct-text-muted mb-(--ct-space-1)">Allocation Note</p>
          <p className="body-xs ct-text-faint leading-relaxed">
            Derived by engine from scenario inputs. Not manually adjustable here.
            Run projection to see derived targets.
          </p>
        </div>
        </div>

        <div className="projection-studio-input-footer">
        {/* Run button */}
        <Button
          variant="primary"
          className="ml-auto"
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
        </Button>

        {error && (
          <p className="body-xs admin-doc-callout">
            {error}
          </p>
        )}
        </div>
      </Card>

      {/* ── RIGHT: OUTPUTS ── */}
      <div ref={outputRef} className="projection-studio-output">
        <Card material="flat" hoverOverlay={false} className={cn("projection-studio-output-stage", result && "projection-studio-output-stage--filled")}>
          <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="scenario-lab-output-idle projection-studio-output-placeholder p-(--ct-space-8)"
              role="status"
              aria-label="Projection output — awaiting first run"
            >
              <div className="admin-doc-stack admin-doc-stack--relaxed max-w-md mx-auto">
                <div className="flex flex-col items-center gap-(--ct-space-4) text-center">
                  <div className="w-12 h-12 rounded-full bg-(--ct-surface-2) flex items-center justify-center border border-(--ct-border-soft)">
                    <span className="text-2xl">⚡️</span>
                  </div>
                  <div className="admin-doc-stack admin-doc-stack--micro">
                    <h3 className="body-md font-bold ct-text-strong">Ready to Project</h3>
                    <p className="body-sm ct-text-muted m-0">
                      Configure your market assumptions and network parameters to generate institutional-grade yield projections.
                    </p>
                  </div>
                </div>

                <div className="admin-inset-panel admin-inset-panel--md bg-(--ct-bg-deep) border-(--ct-border-soft)">
                  <p className="eyebrow ct-text-muted mb-(--ct-space-3)">Quick Guide</p>
                  <ul className="admin-doc-stack admin-doc-stack--compact list-none p-0 m-0">
                    <li className="flex items-start gap-3">
                      <span className="ct-text-accent font-bold mono body-xs mt-0.5">01</span>
                      <span className="body-xs ct-text-muted">Select a <strong>Preset</strong> to load baseline market conditions.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="ct-text-accent font-bold mono body-xs mt-0.5">02</span>
                      <span className="body-xs ct-text-muted">Tune <strong>BTC Price</strong> and <strong>Hashprice</strong> for sensitivity.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="ct-text-accent font-bold mono body-xs mt-0.5">03</span>
                      <span className="body-xs ct-text-muted">Choose <strong>Batch Mode</strong> to see a matrix of outcomes.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="projection-studio-output-content"
            >
            {/* Study metadata */}
            <DashboardPanelHeader
              title="Projection output"
              eyebrow="Result scene"
              subtitle={lastRunAt ? `Last run: ${lastRunAt.toLocaleTimeString()}` : undefined}
              status="Live Engine"
              statusTone="ok"
              trailing={
                <div className="flex items-center gap-(--ct-space-3)">
                  <div className="flex items-center gap-(--ct-space-1_5) pr-(--ct-space-3) border-r border-(--ct-border-soft)">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] mono ct-text-muted hover:ct-text-strong"
                      onClick={() => {
                        navigator.clipboard.writeText(result.studyId);
                        toast.success("Study ID copied to clipboard");
                      }}
                    >
                      Copy ID
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] mono ct-text-muted hover:ct-text-strong"
                      onClick={() => toast.info("Export to PDF/CSV coming soon")}
                    >
                      Export
                    </Button>
                  </div>
                  <Badge variant="default" className="mono tabular">
                    ID {result.studyId.slice(-8)}
                  </Badge>
                  <Badge variant="brand">
                    {result.runIds.length} {result.runIds.length > 1 ? "Runs" : "Run"}
                  </Badge>
                </div>
              }
              className="px-(--ct-space-6) py-(--ct-space-5) border-b border-(--ct-border-soft)"
            />

            <div className="px-(--ct-space-6) py-(--ct-space-6) admin-doc-stack admin-doc-stack--actions">
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
                <div className="admin-doc-form-grid-3">
                  <Metric
                    label="APY Range"
                    provenance="estimated"
                    value={
                      <ApyRange low={selectedCell.apyLow} high={selectedCell.apyHigh} precision={1} />
                    }
                  />
                  <Metric
                    label="Risk Score"
                    provenance="estimated"
                    value={
                      <span className={cn("tabular", riskTextClass(selectedCell.riskScore))}>
                        {selectedCell.riskScore}
                      </span>
                    }
                  />
                  <Metric
                    label="Confidence"
                    provenance="estimated"
                    value={
                      <Badge
                        variant="default"
                        className={cn(
                          "uppercase tracking-wider text-[10px] bg-transparent",
                          selectedCell.confidence === "high" ? "ct-text-success border-success-soft" :
                          selectedCell.confidence === "medium" ? "ct-text-warning border-warning-soft" :
                          "ct-text-danger border-danger-soft"
                        )}
                      >
                        {selectedCell.confidence}
                      </Badge>
                    }
                  />
                </div>
              )}

              {/* Batch: heatmap */}
              {result.runIds.length > 1 && (
                <div className="admin-doc-stack admin-doc-stack--actions">
                  <p className="eyebrow ct-text-muted">
                    Sensitivity Matrix
                  </p>
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
                <div className="admin-doc-form-grid-3">
                  <Metric
                    label="Selected APY Range"
                    provenance="estimated"
                    value={
                      <ApyRange low={selectedCell.apyLow} high={selectedCell.apyHigh} precision={1} />
                    }
                  />
                  <Metric
                    label="Risk Score"
                    provenance="estimated"
                    value={
                      <span className={cn("tabular", riskTextClass(selectedCell.riskScore))}>
                        {selectedCell.riskScore}
                      </span>
                    }
                  />
                  <Metric
                    label="Confidence"
                    provenance="estimated"
                    value={
                      <Badge
                        variant="default"
                        className={cn(
                          "uppercase tracking-wider text-[10px] bg-transparent",
                          selectedCell.confidence === "high" ? "ct-text-success border-success-soft" :
                          selectedCell.confidence === "medium" ? "ct-text-warning border-warning-soft" :
                          "ct-text-danger border-danger-soft"
                        )}
                      >
                        {selectedCell.confidence}
                      </Badge>
                    }
                  />
                </div>
              )}

              {/* Allocation Breakdown */}
              {selectedCell && (
                <AllocationBreakdown allocations={selectedCell.allocations} />
              )}

              {/* PTAI block — mandatory for every projection (#3) */}
            {selectedCell && (
              <div className="admin-inset-panel admin-inset-panel--md ct-surface-0">
                <p className="eyebrow ct-text-muted mb-(--ct-space-3)">PTAI Projection Impact</p>
                <Ptai
                  projection={`APY range ${selectedCell.apyLow.toFixed(1)}–${selectedCell.apyHigh.toFixed(1)}% under current assumptions (methodology v1.0). Not guaranteed — projections are conditional on stated inputs.`}
                  trigger={`Risk score ${selectedCell.riskScore}/100 computed from vol_index, hashprice margin, and BTC price change inputs. Rebalancing rule activates when risk > ${RISK_WARN_MAX}.`}
                  action={`Admin review of projection study ${result.studyId.slice(-8)} required before promotion. Promote to vault draft via button below.`}
                  impact={`Target APY range seeded into VaultDeployment (draft status). Requires 2-of-N multisig approval before going live. Past performance does not predict future results.`}
                />
              </div>
            )}

            {/* Readiness Note */}
            <PanelStatus
              message="Projection is ready for promotion."
              detail="The model outputs are consistent with the selected methodology (v1.0). Promotion will create a draft deployment for further refinement."
              tone="muted"
              className="mt-(--ct-space-2)"
            />

            {/* "Not guaranteed" disclaimer — non-negotiable #10 */}
            <p className="body-xs ct-text-faint italic leading-relaxed">
              <strong className="ct-text-muted not-italic">Disclaimer:</strong>{" "}
              Projections are conditional on stated assumptions and are not guaranteed.
              Rule-based engine — no Monte Carlo. Past performance does not predict future
              results. Hearst Yield Vault is offered exclusively to professional / qualified
              investors. Not an offer or solicitation where prohibited.
            </p>

            {/* Promote to vault draft */}
            <div className="admin-doc-inline-row admin-doc-inline-row--actions pt-(--ct-space-4) border-t border-(--ct-border-soft)">
              <Button
                variant="primary"
                size="md"
                onClick={handlePromote}
                disabled={isPromoting || !result}
                aria-busy={isPromoting}
              >
                {isPromoting ? "Promoting…" : "Promote to Vault Draft"}
              </Button>
              <span className="body-xs ct-text-muted">
                Seeds APY range into a new VaultDeployment (draft)
              </span>
            </div>
            </div>
            </motion.div>
          )}
          </AnimatePresence>
        </Card>
      </div>
      </div>
    </div>
  );
}
