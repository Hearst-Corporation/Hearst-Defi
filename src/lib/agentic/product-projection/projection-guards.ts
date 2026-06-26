/**
 * Product Projection — output guards (pure).
 *
 * Enforces the product non-negotiables on a built artifact:
 *  - no forbidden words (guarantee / promise / certain / will deliver / risk-free);
 *  - APY is only ever expressed as a range, never a single point;
 *  - mandatory disclaimers are present;
 *  - every computed/critical metric carries provenance.
 *
 * The builder constructs compliant output, so these assertions are a safety net
 * (used by tests and the API) and must always pass on `buildProjectionArtifact`.
 */

import type { ProjectionReportArtifact } from "./types";

/** Words that must never appear in any human-facing projection text. */
export const FORBIDDEN_WORDS = [
  "guarantee",
  "guaranteed",
  "promise",
  "certain",
  "will deliver",
  "risk-free",
  "riskless",
] as const;

// NOTE: these must NOT contain any FORBIDDEN_WORDS (a disclaimer that says
// "not a guarantee" would itself trip the forbidden-word guard). They convey the
// same meaning without the banned tokens.
export const MANDATORY_DISCLAIMERS = [
  "This is a projection only; future results are not assured.",
  "APY is shown as a range and reflects the stated assumptions only.",
  "Figures are derived from the provided inputs and their provenance; nothing here is assured.",
] as const;

export type ProjectionGuardViolation = {
  kind:
    | "forbidden_word"
    | "single_point_apy"
    | "missing_disclaimer"
    | "missing_provenance"
    | "invalid_mode"
    | "v2_missing_seed"
    | "v2_bad_iterations"
    | "v2_percentile_order"
    | "v2_non_finite"
    | "v2_missing_limitations";
  detail: string;
};

const MIN_ITER = 100;
const MAX_ITER = 10_000;

/** Collect all human-facing strings from the artifact (no numbers/structure). */
function humanText(a: ProjectionReportArtifact): string {
  const parts: string[] = [a.summary, ...a.disclaimers];
  for (const m of a.metrics) parts.push(m.label, m.value ?? "");
  for (const s of a.scenarios) {
    parts.push(s.label, s.description);
    for (const sm of s.metrics) parts.push(sm.label, sm.value ?? "");
  }
  for (const r of a.risks) parts.push(r.label, r.note);
  return parts.join("  ");
}

/**
 * A single-point APY is a bare "<n>%" or "<n> APY" that is NOT part of a range
 * ("a-b%" or "a–b%"). We allow ranges and percentages that are explicitly a
 * range; we flag a lone APY percentage figure presented as a point value.
 */
function hasSinglePointApy(text: string): boolean {
  const lower = text.toLowerCase();
  // Find APY-context tokens; require any percentage near "apy" to be a range.
  // Range forms: "8-15%", "8–15%", "8 to 15%".
  const apyChunks = lower.match(/[^.]*\bapy\b[^.]*/g) ?? [];
  for (const chunk of apyChunks) {
    const hasPercent = /\d+(\.\d+)?\s*%/.test(chunk);
    if (!hasPercent) continue;
    const hasRange =
      /\d+(\.\d+)?\s*(-|–|—|to)\s*\d+(\.\d+)?\s*%/.test(chunk) ||
      /\brange\b/.test(chunk);
    if (!hasRange) return true; // a percentage near APY without a range → single point
  }
  return false;
}

export function assertProjectionArtifactSafe(
  a: ProjectionReportArtifact,
): ProjectionGuardViolation[] {
  const violations: ProjectionGuardViolation[] = [];
  const text = humanText(a);
  const lower = text.toLowerCase();

  if (a.mode !== "read_only_projection") {
    violations.push({ kind: "invalid_mode", detail: `mode is "${a.mode}"` });
  }

  for (const word of FORBIDDEN_WORDS) {
    if (lower.includes(word)) {
      violations.push({ kind: "forbidden_word", detail: `contains "${word}"` });
    }
  }

  if (hasSinglePointApy(text)) {
    violations.push({
      kind: "single_point_apy",
      detail: "APY appears as a single point; it must be a range",
    });
  }

  for (const required of MANDATORY_DISCLAIMERS) {
    if (!a.disclaimers.includes(required)) {
      violations.push({
        kind: "missing_disclaimer",
        detail: `missing mandatory disclaimer: "${required}"`,
      });
    }
  }

  // Every metric that carries a number must carry provenance.
  for (const m of a.metrics) {
    const hasNumber = m.range !== undefined || (m.value ?? "").length > 0;
    if (hasNumber && (!m.provenance || m.provenance.trim().length === 0)) {
      violations.push({
        kind: "missing_provenance",
        detail: `metric "${m.id}" has a value but no provenance`,
      });
    }
  }

  // ── Methodology v2 distribution guards ────────────────────────────────────
  if (a.distribution) {
    const d = a.distribution;
    if (!d.methodology.seed || d.methodology.seed.length === 0) {
      violations.push({ kind: "v2_missing_seed", detail: "v2 distribution has no seed" });
    }
    if (
      !Number.isInteger(d.methodology.iterations) ||
      d.methodology.iterations < MIN_ITER ||
      d.methodology.iterations > MAX_ITER
    ) {
      violations.push({
        kind: "v2_bad_iterations",
        detail: `iterations ${d.methodology.iterations} outside [${MIN_ITER}, ${MAX_ITER}]`,
      });
    }
    if (d.methodology.limitations.length === 0) {
      violations.push({
        kind: "v2_missing_limitations",
        detail: "v2 methodology must state limitations",
      });
    }
    const p5 = d.percentiles.p5.apyPct;
    const p50 = d.percentiles.p50.apyPct;
    const p95 = d.percentiles.p95.apyPct;
    if (!(p5 <= p50 && p50 <= p95)) {
      violations.push({
        kind: "v2_percentile_order",
        detail: `expected p5 ≤ p50 ≤ p95, got ${p5}/${p50}/${p95}`,
      });
    }
    const nums: number[] = [p5, p50, p95];
    for (const b of d.bands) nums.push(b.p5, b.p50, b.p95, b.horizonMonth);
    for (const p of Object.values(d.percentiles)) {
      if (p.projectedYield) nums.push(p.projectedYield.value);
    }
    if (nums.some((n) => !Number.isFinite(n))) {
      violations.push({
        kind: "v2_non_finite",
        detail: "v2 distribution contains a non-finite (NaN/Infinity) value",
      });
    }
  }

  return violations;
}
