/**
 * Canonical chart scale helpers (HC-CHART-001).
 *
 * Pure, DOM-free maths shared by the Recharts chart layer. Ported verbatim from
 * the retired Hearst Instrument System geometry so the migrated charts keep the
 * exact axis framing that was unit-tested there — in particular the value-chart
 * "framed on the data range, never baselined at 0" contract, which is what stops
 * a tight high-base NAV band from collapsing into a flat line.
 */

/**
 * Min/max of a numeric field. Returns `[0, 1]` on empty input and widens a
 * zero-width domain to `[min, min + 1]` so downstream scaling never divides by
 * zero. (HIS `geometry.extent`.)
 */
export function extent(values: readonly number[]): readonly [number, number] {
  if (values.length === 0) return [0, 1];
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min === max ? [min, min + 1] : [min, max];
}

/**
 * Round a positive value up to a "nice" axis maximum (1 / 1.5 / 2 / 3 / 4 / 5 /
 * 6 / 8 / 10 × a power of ten) so bar/line charts pick identical gridline
 * ceilings. Non-positive / non-finite input → `1` (a safe unit axis for empty
 * data). (HIS `geometry.niceCeil`.)
 */
export function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const steps = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
  return (steps.find((s) => norm <= s) ?? 10) * mag;
}

/**
 * Frame the y-axis on the data range (padded by 12%), NOT baselined at 0. A
 * value series in a tight band (e.g. 500k–531k) baselined at 0 renders as a
 * near-flat line; framing on [min,max] restores the amplitude. A flat series
 * (span 0) falls back to a padded domain so it never collapses to zero height.
 * Clamped ≥ 0 (a NAV never plots below zero). Pass to a Recharts
 * `<YAxis domain={valueYDomain(values)} allowDataOverflow />`.
 *
 * Ported from the retired HcValueChart; the framing contract is covered by the
 * migrated value-chart unit test.
 */
export function valueYDomain(yData: readonly number[]): readonly [number, number] {
  const finite = yData.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [0, 1];
  let min = finite[0]!;
  let max = finite[0]!;
  for (const v of finite) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  const pad = span > 0 ? span * 0.12 : Math.max(Math.abs(max) * 0.05, 1);
  return [Math.max(0, min - pad), max + pad];
}
