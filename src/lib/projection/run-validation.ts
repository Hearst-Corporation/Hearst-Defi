/**
 * run-validation.ts — PURE derived validation status for a ProjectionStudyRun.
 *
 * There is NO status column on ProjectionStudyRun and adding a migration is out
 * of scope/risky, so the validation status is DERIVED from data already present:
 * outputs presence, parseable APY range, p5/p50/p95 ordering, source statuses
 * (assumptions CONFIGURED, risk UNAUDITED), and the demo/no-run flag.
 *
 * Hard rule: a run is investor-eligible ONLY when it carries NO mock, NO demo,
 * NO unaudited-critical, NO configured-critical, valid percentile ordering, and
 * a coherent APY range. Today nothing reaches that bar (assumptions stay
 * CONFIGURED, risk baselines UNAUDITED), so the realistic outcome is
 * VALIDATED_ADMIN at best — never INVESTOR_ELIGIBLE. The verdict stays
 * GO ADMIN ONLY by construction.
 *
 * Pure: no I/O, no Date.now(), deterministic from its inputs.
 */

import type { LatestStudyRunSummary } from "./latest-study-run";
import { getDefaultProjectionAssumptionsConfig } from "./assumptions-config";

export type ProjectionRunValidationStatus =
  | "NO_RUN"
  | "DRAFT"
  | "NEEDS_REVIEW"
  | "VALIDATED_ADMIN"
  | "INVESTOR_ELIGIBLE";

export interface ProjectionRunSourceSummary {
  live: number;
  fallback: number;
  configured: number;
  mock: number;
  demo: number;
  unaudited: number;
}

export interface ProjectionRunValidationResult {
  status: ProjectionRunValidationStatus;
  investorEligible: boolean;
  reasons: string[];
  warnings: string[];
  sourceSummary: ProjectionRunSourceSummary;
}

/**
 * Truth context describing the assumptions/risk provenance backing the run.
 * Defaults reflect the CURRENT reality (assumptions CONFIGURED, risk UNAUDITED,
 * no live yields validated) so callers that pass nothing get the honest, blocked
 * result. A future audited/validated pipeline flips these.
 */
export interface RunValidationContext {
  /** True when the surfaced data is the demo fixture (no real run). */
  isDemoFixture?: boolean;
  /** Company/risk/mining assumptions are admin-configured, not validated. */
  assumptionsConfigured?: boolean;
  /** Smart-contract / counterparty risk baselines not audited. */
  riskUnaudited?: boolean;
  /** Any MOCK source present in the run. */
  hasMockSource?: boolean;
  /** Critical fallback present without justification. */
  hasUnjustifiedFallback?: boolean;
  /** p5/p50/p95 triple if known (for ordering validation). */
  percentiles?: { p5: number; p50: number; p95: number } | null;
}

const DEFAULT_CONTEXT: Required<Omit<RunValidationContext, "percentiles">> & {
  percentiles: RunValidationContext["percentiles"];
} = {
  isDemoFixture: false,
  assumptionsConfigured: true, // current reality
  riskUnaudited: true, // current reality (pre-Spearbit)
  hasMockSource: false,
  hasUnjustifiedFallback: false,
  percentiles: null,
};

/**
 * Build validation context from the central assumptions config (CONFIGURED today).
 * Keeps preview eligibility aligned with assumptions-config provenance — no DB migration.
 */
export function defaultRunValidationContext(
  isDemoFixture: boolean,
): RunValidationContext {
  const cfg = getDefaultProjectionAssumptionsConfig();
  const preAudit = cfg.status !== "AUDITED";
  return {
    isDemoFixture,
    assumptionsConfigured: preAudit,
    riskUnaudited: preAudit,
    hasMockSource: false,
    hasUnjustifiedFallback: false,
    percentiles: null,
  };
}

/**
 * Derive a validation result for a (possibly null) latest run + truth context.
 */
export function validateProjectionRun(
  run: LatestStudyRunSummary | null,
  ctx: RunValidationContext = {},
): ProjectionRunValidationResult {
  const c = { ...DEFAULT_CONTEXT, ...ctx };
  const reasons: string[] = [];
  const warnings: string[] = [];

  // ── No run / demo ──────────────────────────────────────────────────────────
  if (!run || c.isDemoFixture) {
    return {
      status: "NO_RUN",
      investorEligible: false,
      reasons: ["No real ProjectionStudyRun (demo fixture)."],
      warnings: ["Illustrative preview — not tied to a real projection."],
      sourceSummary: emptySummary({ demo: c.isDemoFixture ? 1 : 0 }),
    };
  }

  // ── Structural completeness ─────────────────────────────────────────────────
  let structurallyOk = true;
  if (!run.apyRange) {
    reasons.push("APY range missing from the run outputs.");
    structurallyOk = false;
  } else if (run.apyRange.low > run.apyRange.high) {
    reasons.push("APY range inconsistent (low > high).");
    structurallyOk = false;
  }
  if (run.scenarioRunCount <= 0) {
    reasons.push("No scenario run attached.");
    structurallyOk = false;
  }

  // ── Percentile ordering (when known) ────────────────────────────────────────
  if (c.percentiles) {
    const { p5, p50, p95 } = c.percentiles;
    if (!(p5 <= p50 && p50 <= p95)) {
      reasons.push("Invalid percentiles (p5 ≤ p50 ≤ p95 violated).");
      structurallyOk = false;
    }
  }

  // ── Investor-eligibility blockers ───────────────────────────────────────────
  const blockers: string[] = [];
  if (c.hasMockSource) blockers.push("MOCK source present.");
  if (c.assumptionsConfigured)
    blockers.push("Assumptions CONFIGURED (not business-validated).");
  if (c.riskUnaudited)
    blockers.push("Risk baselines UNAUDITED (pre-Spearbit audit).");
  if (c.hasUnjustifiedFallback)
    blockers.push("Critical fallback not justified.");

  const sourceSummary = emptySummary({
    configured: c.assumptionsConfigured ? 1 : 0,
    unaudited: c.riskUnaudited ? 1 : 0,
    mock: c.hasMockSource ? 1 : 0,
    fallback: c.hasUnjustifiedFallback ? 1 : 0,
  });

  if (!structurallyOk) {
    return {
      status: "NEEDS_REVIEW",
      investorEligible: false,
      reasons,
      warnings: blockers, // surface blockers as warnings too
      sourceSummary,
    };
  }

  // Structurally sound but blocked from investor → admin-validated only.
  if (blockers.length > 0) {
    return {
      status: "VALIDATED_ADMIN",
      investorEligible: false,
      reasons: ["Run structurally valid for ADMIN use."],
      warnings: blockers,
      sourceSummary,
    };
  }

  // No blockers at all → investor-eligible (not reachable today).
  return {
    status: "INVESTOR_ELIGIBLE",
    investorEligible: true,
    reasons: ["Run validated, no blocking source."],
    warnings: [],
    sourceSummary,
  };
}

function emptySummary(
  over: Partial<ProjectionRunSourceSummary> = {},
): ProjectionRunSourceSummary {
  return {
    live: 0,
    fallback: 0,
    configured: 0,
    mock: 0,
    demo: 0,
    unaudited: 0,
    ...over,
  };
}
