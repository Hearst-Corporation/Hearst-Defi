/**
 * investor-report-view-model.ts — PURE view model for the admin investor-report
 * preview, derived from a (validated) ProjectionStudyRun.
 *
 * It maps latest run + validation result into a stable report shape with a clear
 * MODE that gates investor-facing presentation. Hard rule:
 *   - NO_RUN / BLOCKED  → nothing investor-presentable.
 *   - ADMIN_PREVIEW     → admin-only, strong "GO ADMIN ONLY" disclaimers.
 *   - INVESTOR_ELIGIBLE → eligible state, still NO guarantee wording.
 *
 * A run that is only VALIDATED_ADMIN is NEVER labelled investor-ready. Disclaimers
 * are injected for every CONFIGURED / UNAUDITED / FALLBACK / demo condition.
 *
 * Pure: no I/O, deterministic from inputs.
 */

import type { LatestStudyRunSummary } from "./latest-study-run";
import type { ProjectionRunValidationResult } from "./run-validation";

export type InvestorReportMode =
  | "NO_RUN"
  | "BLOCKED"
  | "ADMIN_PREVIEW"
  | "INVESTOR_ELIGIBLE";

export interface InvestorReportMetric {
  label: string;
  value: string;
}

export interface InvestorReportScenario {
  label: string;
  value: string;
}

export type InvestorReportBadgeTone =
  | "neutral"
  | "configured"
  | "unaudited"
  | "fallback"
  | "demo"
  | "eligible";

export interface InvestorReportBadge {
  tone: InvestorReportBadgeTone;
  label: string;
}

export interface ProjectionInvestorReportViewModel {
  mode: InvestorReportMode;
  runId?: string;
  createdAt?: string;
  status: string;
  /** True only when the run is genuinely investor-eligible. */
  investorEligible: boolean;
  headline: string;
  metrics: InvestorReportMetric[];
  scenarios: InvestorReportScenario[];
  sourceBadges: InvestorReportBadge[];
  warnings: string[];
  disclaimers: string[];
}

const BASE_DISCLAIMER =
  "Projection — pas une garantie. Les résultats dépendent du prix BTC, du hashprice, de la difficulté, des taux et des coûts.";

/**
 * Build the report view model. Pure transform of run + validation.
 */
export function buildInvestorReportViewModel(
  run: LatestStudyRunSummary | null,
  validation: ProjectionRunValidationResult,
): ProjectionInvestorReportViewModel {
  // ── NO_RUN (demo / no real run) ─────────────────────────────────────────────
  if (validation.status === "NO_RUN" || !run) {
    return {
      mode: "NO_RUN",
      status: validation.status,
      investorEligible: false,
      headline: "Aucune projection réelle — aperçu démo",
      metrics: [],
      scenarios: [],
      sourceBadges: [{ tone: "demo", label: "Demo Fixture" }],
      warnings: validation.warnings,
      disclaimers: [
        "Non lié à une projection réelle. Aperçu illustratif uniquement.",
        BASE_DISCLAIMER,
      ],
    };
  }

  const metrics: InvestorReportMetric[] = [];
  if (run.apyRange) {
    metrics.push({
      label: "APY range",
      value: `${run.apyRange.low}% — ${run.apyRange.high}%`,
    });
  }
  if (typeof run.riskScore === "number") {
    metrics.push({ label: "Risk score", value: String(run.riskScore) });
  }
  if (run.mode) metrics.push({ label: "Vault mode", value: run.mode });
  if (run.confidence) metrics.push({ label: "Confidence", value: run.confidence });

  const scenarios: InvestorReportScenario[] = run.apyRange
    ? [
        { label: "Low", value: `${run.apyRange.low}%` },
        { label: "High", value: `${run.apyRange.high}%` },
      ]
    : [];

  // Source badges from the validation source summary (only show what's present).
  const sb = validation.sourceSummary;
  const sourceBadges: InvestorReportBadge[] = [];
  if (sb.configured > 0) sourceBadges.push({ tone: "configured", label: "Assumptions CONFIGURED" });
  if (sb.unaudited > 0) sourceBadges.push({ tone: "unaudited", label: "Risk UNAUDITED" });
  if (sb.fallback > 0) sourceBadges.push({ tone: "fallback", label: "Fallback present" });
  if (sb.mock > 0) sourceBadges.push({ tone: "neutral", label: "MOCK present" });

  // Disclaimers — one per truth condition, never silent.
  const disclaimers: string[] = [BASE_DISCLAIMER];
  if (sb.configured > 0)
    disclaimers.push("Hypothèses configurées (non validées métier).");
  if (sb.unaudited > 0)
    disclaimers.push("Baselines de risque non auditées (pré-audit Spearbit).");
  if (sb.fallback > 0)
    disclaimers.push("Certaines sources sont en fallback.");

  // ── NEEDS_REVIEW → BLOCKED ──────────────────────────────────────────────────
  if (validation.status === "NEEDS_REVIEW") {
    return {
      mode: "BLOCKED",
      runId: run.id,
      createdAt: run.ranAt,
      status: validation.status,
      investorEligible: false,
      headline: "Run à revoir — rapport bloqué",
      metrics,
      scenarios,
      sourceBadges,
      warnings: validation.warnings.length ? validation.warnings : validation.reasons,
      disclaimers,
    };
  }

  // ── INVESTOR_ELIGIBLE ───────────────────────────────────────────────────────
  if (validation.status === "INVESTOR_ELIGIBLE" && validation.investorEligible) {
    return {
      mode: "INVESTOR_ELIGIBLE",
      runId: run.id,
      createdAt: run.ranAt,
      status: validation.status,
      investorEligible: true,
      headline: "Projection éligible — revue investisseur",
      metrics,
      scenarios,
      sourceBadges,
      warnings: validation.warnings,
      disclaimers, // still carries the base "not a guarantee" disclaimer
    };
  }

  // ── VALIDATED_ADMIN (default for a structurally sound, blocked run) ──────────
  return {
    mode: "ADMIN_PREVIEW",
    runId: run.id,
    createdAt: run.ranAt,
    status: validation.status,
    investorEligible: false,
    headline: "Aperçu admin — dérivé du dernier ProjectionStudyRun",
    metrics,
    scenarios,
    sourceBadges,
    warnings: validation.warnings,
    disclaimers: [
      ...disclaimers,
      "GO ADMIN ONLY — non destiné à un investisseur en l'état.",
    ],
  };
}
