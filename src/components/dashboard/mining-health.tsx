import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { MiningHealth } from "@/lib/dashboard-types";

// ── Pure helpers (exported for tests) ───────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Returns a margin score 0–100 for a given hashprice × BTC price cell.
 * Simplified linear preview — replace with real engine when available.
 */
export function marginScoreCell(hashprice: number, btcPrice: number): number {
  const hp = clamp((hashprice - 0.05) / 0.05, 0, 1);
  const bp = clamp((btcPrice - 50000) / 25000, 0, 1);
  return Math.round((hp * 0.6 + bp * 0.4) * 100);
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface MiningHealthHashprice {
  usd_per_th_day: number;
  stale: boolean;
}

interface MiningHealthSectionProps {
  miningHealth: MiningHealth;
  hashprice?: MiningHealthHashprice | null;
  /** Optional current hashprice/BTC pair for the heatmap marker overlay. */
  currentPair?: { hashprice: number; btcPrice: number };
  /** Which view to render. Default: "heatmap". */
  view?: "bars" | "heatmap";
}

type Tone = "good" | "warn" | "bad";

function scoreTone(score: number): Tone {
  if (score >= 70) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

function trendTone(pct: number): Tone {
  if (pct >= -5) return "good";
  if (pct >= -15) return "warn";
  return "bad";
}

const TONE_TEXT: Record<Tone, string> = {
  good: "ct-status-glow-success",
  warn: "ct-status-glow-warning",
  bad: "ct-status-glow-danger",
};

const TONE_BAR: Record<Tone, string> = {
  good: "ct-status-dot-success",
  warn: "ct-status-dot-warning",
  bad: "ct-status-dot-danger",
};

const TONE_DOT_CLASS: Record<Tone, string> = {
  good: "ct-status-dot-success",
  warn: "ct-status-dot-warning",
  bad: "ct-status-dot-danger",
};

// ── Heatmap constants ────────────────────────────────────────────────────────

// 12 hashprice columns: 0.05 → 0.10 $/TH/day in 0.00417 steps
const HP_COUNT = 12;
const HP_MIN = 0.05;
const HP_MAX = 0.10;

// 8 BTC price rows (top = highest): 75k → 50k in 3571 steps
const BTC_COUNT = 8;
const BTC_MIN = 50000;
const BTC_MAX = 75000;

/** Pre-computed grid of hashprice columns (x) × BTC price rows (y, top→bottom). */
export function buildHeatmapGrid(): Array<
  Array<{ hashprice: number; btcPrice: number; score: number }>
> {
  const rows: Array<Array<{ hashprice: number; btcPrice: number; score: number }>> = [];
  for (let r = 0; r < BTC_COUNT; r++) {
    // rows[0] = top row = highest BTC price
    const btcPrice =
      BTC_MAX - (r / (BTC_COUNT - 1)) * (BTC_MAX - BTC_MIN);
    const cells: Array<{ hashprice: number; btcPrice: number; score: number }> = [];
    for (let c = 0; c < HP_COUNT; c++) {
      const hashprice =
        HP_MIN + (c / (HP_COUNT - 1)) * (HP_MAX - HP_MIN);
      cells.push({ hashprice, btcPrice, score: marginScoreCell(hashprice, btcPrice) });
    }
    rows.push(cells);
  }
  return rows;
}

/**
 * Returns the SVG fill color+opacity for a given margin score.
 * Uses design-system CSS vars per the spec.
 */
export function cellFill(score: number): { fill: string; opacity: number } {
  if (score < 1) return { fill: "var(--ct-text-faint)", opacity: 0.25 };
  if (score < 40) return { fill: "var(--ct-status-danger)", opacity: 0.6 };
  if (score < 60) return { fill: "var(--ct-status-warning)", opacity: 0.6 };
  if (score < 80) return { fill: "var(--ct-accent)", opacity: 0.5 };
  return { fill: "var(--ct-accent)", opacity: 0.9 };
}

/**
 * Maps a { hashprice, btcPrice } pair to SVG pixel coordinates
 * within the heatmap grid area.
 */
export function pairToXY(
  hashprice: number,
  btcPrice: number,
  svgWidth: number,
  svgHeight: number,
  padLeft: number,
  padTop: number,
  padRight: number,
  padBottom: number,
): { cx: number; cy: number } {
  const gridW = svgWidth - padLeft - padRight;
  const gridH = svgHeight - padTop - padBottom;
  const cellW = gridW / HP_COUNT;
  const cellH = gridH / BTC_COUNT;

  const col = clamp(
    (hashprice - HP_MIN) / (HP_MAX - HP_MIN),
    0,
    1,
  ) * (HP_COUNT - 1);
  const row = (1 - clamp((btcPrice - BTC_MIN) / (BTC_MAX - BTC_MIN), 0, 1)) *
    (BTC_COUNT - 1);

  return {
    cx: padLeft + (col + 0.5) * cellW,
    cy: padTop + (row + 0.5) * cellH,
  };
}

// ── Legend data (exported for tests) ────────────────────────────────────────

export const LEGEND_SWATCHES = [
  { label: "Unprofitable", fill: "var(--ct-text-faint)", opacity: 0.25 },
  { label: "<40", fill: "var(--ct-status-danger)", opacity: 0.6 },
  { label: "40–60", fill: "var(--ct-status-warning)", opacity: 0.6 },
  { label: "60–80", fill: "var(--ct-accent)", opacity: 0.5 },
  { label: ">80", fill: "var(--ct-accent)", opacity: 0.9 },
] as const;

// ── Sub-components ───────────────────────────────────────────────────────────

interface ScoreRowProps {
  label: string;
  hint: string;
  value: string;
  tone: Tone;
  bar?: number;
}

function ScoreRow({ label, hint, value, tone, bar }: ScoreRowProps) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 group">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "inline-block h-2 w-2 shrink-0 rounded-full",
                TONE_DOT_CLASS[tone],
              )}
            />
            <span className="body-sm font-medium ct-text-primary group-hover:ct-text-body transition-colors">{label}</span>
          </div>
          <p className="mt-1 body-xs ct-text-muted">{hint}</p>
        </div>
        <span className={cn("stat-value leading-tight tabular-nums", TONE_TEXT[tone])}>
          {value}
        </span>
      </div>
      {typeof bar === "number" ? (
        <Progress
          value={bar}
          fillClassName={TONE_BAR[tone]}
          className="h-1.5"
          label={`${label}: ${value}`}
        />
      ) : null}
    </div>
  );
}

interface HashpriceRowProps {
  hashprice: MiningHealthHashprice;
}

function HashpriceRow({ hashprice }: HashpriceRowProps) {
  const provenance = hashprice.stale ? "stale" : "live";
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 group">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="body-sm font-medium ct-text-primary group-hover:ct-text-body transition-colors">
              Hashprice
            </span>
          </div>
          <p className="mt-1 body-xs ct-text-muted">
            BTC subsidy / network difficulty
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="stat-value tabular-nums">
            ${hashprice.usd_per_th_day.toFixed(3)}{" "}
            <span className="dash-unit">/TH/day</span>
          </span>
          <ProvenanceBadge kind={provenance} />
        </div>
      </div>
    </div>
  );
}

// ── Mining Margin Heatmap SVG ────────────────────────────────────────────────

const SVG_W = 300;
const SVG_H = 160;
const PAD_LEFT = 36;
const PAD_TOP = 8;
const PAD_RIGHT = 8;
const PAD_BOTTOM = 28;
const GRID_W = SVG_W - PAD_LEFT - PAD_RIGHT;
const GRID_H = SVG_H - PAD_TOP - PAD_BOTTOM;
const CELL_W = GRID_W / HP_COUNT;
const CELL_H = GRID_H / BTC_COUNT;

// BTC price axis labels (top → bottom)
const BTC_LABELS = ["$75k", "$72k", "$68k", "$64k", "$60k", "$57k", "$54k", "$50k"];
// Hashprice axis labels (left → right, every other column)
const HP_LABELS = ["0.05", "0.06", "0.07", "0.08", "0.09", "0.10"];

interface HeatmapSVGProps {
  marginScore: number;
  currentPair?: { hashprice: number; btcPrice: number };
}

function HeatmapSVG({ marginScore, currentPair }: HeatmapSVGProps) {
  const grid = buildHeatmapGrid();

  // Marker position
  const marker =
    currentPair !== undefined
      ? pairToXY(
          currentPair.hashprice,
          currentPair.btcPrice,
          SVG_W,
          SVG_H,
          PAD_LEFT,
          PAD_TOP,
          PAD_RIGHT,
          PAD_BOTTOM,
        )
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="stat-label">
          Mining Margin Heatmap · 90d
        </span>
        <div className="flex items-center gap-2">
          <span className="stat-label">Score:</span>
          <span
            className={cn(
              "body-sm font-bold tabular-nums",
              scoreTone(marginScore) === "good"
                ? "ct-text-accent"
                : scoreTone(marginScore) === "warn"
                  ? "text-[var(--ct-status-warning)]"
                  : "ct-status-danger",
            )}
          >
            {marginScore}/100
          </span>
        </div>
      </div>

      {/* SVG grid */}
      <div className="flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Mining margin heatmap. Current margin score: ${marginScore}/100.`}
        >
          {/* BTC price Y-axis labels */}
          {BTC_LABELS.map((label, r) => (
            <text
              key={label}
              x={PAD_LEFT - 6}
              y={PAD_TOP + (r + 0.5) * CELL_H + 2}
              textAnchor="end"
              className="dash-chart-svg-text-axis"
            >
              {label}
            </text>
          ))}

          {/* Cells */}
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const { fill, opacity } = cellFill(cell.score);
              const x = PAD_LEFT + c * CELL_W;
              const y = PAD_TOP + r * CELL_H;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={x + 0.5}
                  y={y + 0.5}
                  width={CELL_W - 1}
                  height={CELL_H - 1}
                  fill={fill}
                  opacity={opacity}
                  rx={1}
                  className="transition-opacity duration-300 hover:opacity-100"
                >
                  <title>
                    {`Hashprice $${cell.hashprice.toFixed(3)}/TH/d · BTC $${Math.round(cell.btcPrice).toLocaleString()} · Margin ${cell.score}/100`}
                  </title>
                </rect>
              );
            }),
          )}

          {/* Hashprice X-axis labels */}
          {HP_LABELS.map((label, i) => {
            const colIdx = Math.round((i / (HP_LABELS.length - 1)) * (HP_COUNT - 1));
            return (
              <text
                key={label}
                x={PAD_LEFT + (colIdx + 0.5) * CELL_W}
                y={SVG_H - PAD_BOTTOM + 12}
                textAnchor="middle"
                className="dash-chart-svg-text-axis"
              >
                {label}
              </text>
            );
          })}

          {/* X-axis unit label */}
          <text
            x={PAD_LEFT + GRID_W / 2}
            y={SVG_H - 4}
            textAnchor="middle"
            className="dash-chart-svg-text-axis-unit"
          >
            $/TH/day
          </text>

          {/* Current position marker */}
          {marker !== null ? (
            <g>
              <circle
                cx={marker.cx}
                cy={marker.cy}
                r={6}
                fill="var(--ct-accent)"
                opacity={0.2}
                className="animate-pulse"
              />
              <circle
                cx={marker.cx}
                cy={marker.cy}
                r={3}
                fill="var(--ct-text-strong)"
                stroke="var(--ct-bg-deep)"
                strokeWidth={1}
              />
            </g>
          ) : null}
        </svg>
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-[var(--ct-border-soft)]/50"
        aria-label="Margin score legend"
      >
        {LEGEND_SWATCHES.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="ct-legend-dot rounded-sm"
              style={{ background: s.fill, opacity: s.opacity }}
            />
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Public export ────────────────────────────────────────────────────────────

export function MiningHealthSection({
  miningHealth,
  hashprice,
  currentPair,
  view = "heatmap",
}: MiningHealthSectionProps) {
  const marginTone = scoreTone(miningHealth.marginScore);
  const trendT = trendTone(miningHealth.hashpriceTrendPct);
  const opTone = scoreTone(miningHealth.opConfidence);
  const trendPctClamped =
    50 + Math.max(-50, Math.min(50, miningHealth.hashpriceTrendPct * 5));

  return (
    <Card className="h-full flex flex-col">
      {/* A2 — the margin/health score is an engine estimate computed from public
          hashprice/BTC feeds + assumed energy cost, NOT an on-chain oracle. */}
      <div className="pf-widget-header relative z-10">
        <h3 className="h3">Mining Health</h3>
        <ProvenanceBadge kind="estimated" />
      </div>

      <div className="flex-1 flex flex-col mt-6 relative z-10">
        {view === "heatmap" ? (
          <div className="pb-4 h-full flex flex-col">
            <HeatmapSVG
              marginScore={miningHealth.marginScore}
              currentPair={currentPair}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--ct-border-soft)]/50">
            <ScoreRow
              label="Mining Margin Score"
              hint="current margin / target margin"
              value={`${miningHealth.marginScore}/100`}
              tone={marginTone}
              bar={miningHealth.marginScore}
            />
            <ScoreRow
              label="Hashprice Trend"
              hint="30d avg vs 60d avg"
              value={`${miningHealth.hashpriceTrendPct >= 0 ? "+" : ""}${miningHealth.hashpriceTrendPct.toFixed(1)}%`}
              tone={trendT}
              bar={trendPctClamped}
            />
            <ScoreRow
              label="Operational Confidence"
              hint="uptime + attestation freshness + energy stability"
              value={`${miningHealth.opConfidence}/100`}
              tone={opTone}
              bar={miningHealth.opConfidence}
            />
            {hashprice && hashprice.usd_per_th_day > 0 ? (
              <HashpriceRow hashprice={hashprice} />
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
