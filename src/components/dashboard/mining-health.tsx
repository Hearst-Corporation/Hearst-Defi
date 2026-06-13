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

