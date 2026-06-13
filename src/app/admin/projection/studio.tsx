"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { Ptai } from "@/components/ui/ptai";
import { AwaitingMetricState } from "@/components/ui/awaiting-metric-state";
import { cn } from "@/lib/cn";
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

const PRESETS: { id: Preset; label: string; description: string }[] = [
  { id: "base", label: "Base", description: "Current operating assumptions" },
  { id: "btc_bear", label: "BTC Bear", description: "Lower BTC and mining margin" },
  { id: "btc_bull", label: "BTC Bull", description: "Higher BTC momentum" },
  { id: "mining_compression", label: "Mining Compression", description: "Hashprice and energy stress" },
  { id: "extreme_stress", label: "Extreme Stress", description: "Severe market shock" },
];

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
  return (
    <div className="admin-doc-stack admin-doc-stack--dense">
      <div className="admin-doc-inline-row admin-doc-inline-row--between">
        <span className="ct-form-label">{label}</span>
        <span className="mono tabular body-sm ct-text-primary">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-(--ct-accent) cursor-pointer h-1.5 rounded-full"
        aria-label={label}
      />
      <div className="admin-doc-row-spread eyebrow ct-text-faint">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

// ─── Allocation sliders with sum-100 constraint ───────────────────────────────

type AllocState = {
  mining: number;
  btcTactical: number;
  usdcBase: number;
  stableReserve: number;
};

function AllocSliders({
  alloc,
  onChange,
}: {
  alloc: AllocState;
  onChange: (a: AllocState) => void;
}) {
  const keys: (keyof AllocState)[] = ["mining", "btcTactical", "usdcBase", "stableReserve"];
  const labels: Record<keyof AllocState, string> = {
    mining: "Mining",
    btcTactical: "BTC Tactical",
    usdcBase: "USDC Base",
    stableReserve: "Stable Reserve",
  };

  const sum = alloc.mining + alloc.btcTactical + alloc.usdcBase + alloc.stableReserve;
  const sumOk = Math.abs(sum - 100) < 0.5;

  function handleChange(key: keyof AllocState, raw: number) {
    const others = (Object.keys(alloc) as (keyof AllocState)[]).filter((k) => k !== key);
    const remaining = 100 - raw;
    const otherSum = others.reduce((acc, k) => acc + alloc[k], 0);
    const ratio = otherSum > 0 ? remaining / otherSum : 1 / others.length;
    const next = { ...alloc, [key]: raw } as AllocState;
    for (const k of others) {
      next[k] = otherSum > 0 ? Math.max(0, Math.round(alloc[k] * ratio * 10) / 10) : Math.round(remaining / others.length);
    }
    onChange(next);
  }

  return (
    <div className="admin-doc-stack admin-doc-stack--actions">
      <div className="admin-doc-row-spread">
        <span className="eyebrow ct-text-muted">Allocations</span>
        <span
          className={cn(
            "ct-pill mono tabular",
            sumOk
              ? "ct-status-success-bg"
              : "ct-status-danger-bg",
          )}
        >
          {sum.toFixed(1)}%
        </span>
      </div>
      {keys.map((k) => (
        <SliderField
          key={k}
          label={labels[k]}
          value={alloc[k]}
          min={0}
          max={100}
          step={0.5}
          onChange={(v) => handleChange(k, v)}
          format={(v) => `${v.toFixed(1)}%`}
        />
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
        <p className="body-xs ct-text-muted">
          X: <span className="mono ct-text-body">{xAxis}</span>
          {yAxis && (
            <>
              {" "}— Y: <span className="mono ct-text-body">{yAxis}</span>
            </>
          )}
        </p>
      )}
      <div
        className="admin-doc-grid-dense"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, auto)`,
        }}
        role="grid"
        aria-label="Projection heatmap"
      >
        {cells.map((cell, idx) => {
          const isSelected = cell.scenarioRunId === selectedRunId;
          return (
            <button
              key={cell.scenarioRunId}
              type="button"
              role="gridcell"
              onClick={() => onSelect(cell.scenarioRunId)}
              aria-selected={isSelected}
              aria-label={`APY ${cell.apyLow.toFixed(1)}–${cell.apyHigh.toFixed(1)}%, risk ${cell.riskScore}. Cell ${idx + 1} of ${cells.length}.`}
              className={cn(
                "p-2.5 rounded-md relative border text-left transition-[background-color,border-color] duration-(--ct-dur-base)",
                riskBgClass(cell.riskScore),
                "border-(--ct-border-soft)",
                isSelected && "ring-2 ring-offset-1 ring-offset-(--ct-bg-deep)",
                isSelected && "ring-(--ct-accent)",
                "hover:border-(--ct-border) hover:shadow-(--ct-shadow-elevated) focus-visible:outline-none focus-visible:shadow-(--ct-shadow-focus-ring)",
              )}
            >
              <div className="admin-doc-stack admin-doc-stack--micro">
                <span
                  className={cn("mono tabular body-xs font-semibold leading-tight", riskTextClass(cell.riskScore))}
                >
                  {cell.apyLow.toFixed(1)}–{cell.apyHigh.toFixed(1)}%
                </span>
                <span className="eyebrow ct-text-muted mono">
                  Risk {cell.riskScore}
                </span>
              </div>
            </button>
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
  const [alloc, setAlloc] = useState<AllocState>({
    mining: 40,
    btcTactical: 20,
    usdcBase: 25,
    stableReserve: 15,
  });
  const [batchMode, setBatchMode] = useState<BatchMode>("none");
  const [methodologyVersion] = useState("v1.0");
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);

  // Output state
  const [result, setResult] = useState<StudyResult | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Card hoverOverlay={false} className="projection-studio-input-card">
        <div className="projection-studio-input-card__header">
          <div>
            <p className="eyebrow ct-text-muted">Control panel</p>
            <h3 className="h3 mt-1 ct-text-strong">Projection inputs</h3>
          </div>
          <span className="body-xs ct-text-faint mono">{methodologyVersion}</span>
        </div>

        <div className="projection-studio-input-scroll">
        {/* Base inputs */}
        <div className="projection-studio-input-group">
          <p className="eyebrow ct-text-muted">Market Inputs</p>
          <SliderField
            label="BTC Price Change (%)"
            value={btcChange}
            min={-100}
            max={300}
            step={1}
            onChange={setBtcChange}
            format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
          />
          <SliderField
            label="Hashprice (USD/TH/day)"
            value={hashprice}
            min={0.01}
            max={0.5}
            step={0.001}
            onChange={setHashprice}
            format={(v) => `$${v.toFixed(3)}`}
          />
          <SliderField
            label="Energy Cost (USD/kWh)"
            value={energyCost}
            min={0.01}
            max={1}
            step={0.001}
            onChange={setEnergyCost}
            format={(v) => `$${v.toFixed(3)}`}
          />
          <SliderField
            label="Stable APY (%)"
            value={stableApy}
            min={0}
            max={30}
            step={0.1}
            onChange={setStableApy}
            format={(v) => `${v.toFixed(1)}%`}
          />
          <SliderField
            label="Vol Index (0-100)"
            value={volIndex}
            min={0}
            max={100}
            step={1}
            onChange={setVolIndex}
            format={(v) => v.toFixed(0)}
          />
        </div>

        <div className="projection-studio-input-divider" />

        {/* Allocation sliders */}
        <AllocSliders alloc={alloc} onChange={setAlloc} />

        <div className="projection-studio-input-divider" />

        {/* Batch mode toggle */}
        <div className="admin-doc-stack admin-doc-stack--actions">
          <p className="eyebrow ct-text-muted">Batch Mode</p>
          <div className="admin-doc-inline-row">
            {(
              [
                { id: "none", label: "Single run" },
                { id: "1d", label: "1D — BTC (5 vals)" },
                { id: "2d", label: "2D — BTC × HP (3×3)" },
              ] as { id: BatchMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setBatchMode(m.id)}
                className={cn("ct-pill body-xs", batchMode === m.id && "accent")}
              >
                {m.label}
              </button>
            ))}
          </div>
          {batchMode === "1d" && (
            <p className="body-xs ct-text-muted">
              BTC chg sweep:{" "}
              <span className="mono">{DEFAULT_1D_VALUES.join(", ")}%</span>
              {" "}→ 5 parallel runs
            </p>
          )}
          {batchMode === "2d" && (
            <p className="body-xs ct-text-muted">
              BTC chg × Hashprice — 3×3 = 9 cells, max 25
            </p>
          )}
        </div>

        <div className="projection-studio-input-divider" />

        {/* Methodology version */}
        <div className="admin-doc-stack admin-doc-stack--tight">
          <p className="eyebrow ct-text-muted">Methodology</p>
          <select
            className="ct-select w-full"
            value={methodologyVersion}
            aria-label="Methodology version"
            disabled
          >
            {METHODOLOGY_VERSIONS.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
          <p className="body-xs ct-text-faint">
            Pinned to v1.0. Bump version via ADR + spec update.
          </p>
        </div>
        </div>

        <div className="projection-studio-input-footer">
        {/* Run button */}
        <Button
          variant="primary"
          size="md"
          className="w-full"
          onClick={handleRun}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending
            ? batchMode === "none"
              ? "Running…"
              : "Running batch…"
            : batchMode === "none"
              ? "Run Scenario"
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
        <Card hoverOverlay={false} className={cn("projection-studio-output-stage", result && "projection-studio-output-stage--filled")}>
          {!result && (
            <AwaitingMetricState
              variant="inline"
              className="h-full"
              message="Projection scene ready"
              detail="Configure inputs and run a scenario or batch to populate APY range, risk score and PTAI impact."
            />
          )}

          {result && (
            <div className="projection-studio-output-content">
            {/* Study metadata */}
            <div className="projection-studio-output-head">
              <div>
                <p className="eyebrow ct-text-muted">Result scene</p>
                <h3 className="h3 ct-text-strong mt-1">Projection output</h3>
              </div>
              <div className="admin-doc-inline-row">
                <Badge variant="default">
                  Study {result.studyId.slice(-8)}
                </Badge>
                <Badge variant="brand">
                  {result.runIds.length} run{result.runIds.length > 1 ? "s" : ""}
                </Badge>
              </div>
            </div>

            {/* Single run: KPI grid */}
            {result.runIds.length === 1 && selectedCell && (
              <div className="admin-doc-form-grid-2">
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
              </div>
            )}

            {/* Batch: heatmap */}
            {result.runIds.length > 1 && (
              <div className="admin-doc-stack admin-doc-stack--actions admin-doc-inset">
                <p className="eyebrow ct-text-muted">
                  Projection Heatmap — {result.runIds.length} cells
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
              <div className="admin-doc-form-grid-2">
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
              </div>
            )}

            {/* PTAI block — mandatory for every projection (#3) */}
            {selectedCell && (
              <Ptai
                projection={`APY range ${selectedCell.apyLow.toFixed(1)}–${selectedCell.apyHigh.toFixed(1)}% under current assumptions (methodology v1.0). Not guaranteed — projections are conditional on stated inputs.`}
                trigger={`Risk score ${selectedCell.riskScore}/100 computed from vol_index, hashprice margin, and BTC price change inputs. Rebalancing rule activates when risk > ${RISK_WARN_MAX}.`}
                action={`Admin review of projection study ${result.studyId.slice(-8)} required before promotion. Promote to vault draft via button below.`}
                impact={`Target APY range seeded into VaultDeployment (draft status). Requires 2-of-N multisig approval before going live. Past performance does not predict future results.`}
              />
            )}

            {/* "Not guaranteed" disclaimer — non-negotiable #10 */}
            <p className="body-xs ct-text-faint admin-doc-inset">
              <strong className="ct-text-muted">Disclaimer:</strong>{" "}
              Projections are conditional on stated assumptions and are not guaranteed.
              Rule-based engine — no Monte Carlo. Past performance does not predict future
              results. Hearst Yield Vault is offered exclusively to professional / qualified
              investors. Not an offer or solicitation where prohibited.
            </p>

            {/* Promote to vault draft */}
            <div className="admin-doc-inline-row admin-doc-inline-row--actions">
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
          )}
        </Card>
      </div>
      </div>
    </div>
  );
}
