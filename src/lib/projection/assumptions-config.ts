/**
 * assumptions-config.ts — single versioned config block for ALL projection
 * assumptions (company + risk + mining), with strict provenance.
 *
 * Today this returns CODE_DEFAULT values (the layers from #148/#150). It is the
 * SINGLE seam where a DB row / admin UI / env would later plug in WITHOUT
 * touching callers. There is NO settings/config table in Prisma yet (only
 * VaultDeployment / ProjectionStudyRun / AdminChatMode), and adding one is out
 * of scope for this lot — so this is a pure service, honestly labelled
 * CODE_DEFAULT, not pretending to be DB.
 *
 * Truth rules (non-negotiable):
 *  - ADMIN_CONFIG !== REAL. An admin-entered assumption stays CONFIGURED.
 *  - status becomes AUDITED only with a real audited source (none yet).
 *  - overrides change VALUES, never formulas, never the status to REAL.
 */

import {
  DEFAULT_PROJECTION_COMPANY_ASSUMPTIONS,
  type ProjectionCompanyAssumptions,
} from "./company-assumptions";
import {
  DEFAULT_RISK_REFERENCES,
  type RiskReferenceInputs,
} from "./risk-references";
import { DEFAULT_MINING_COSTS, type MiningCostInputs } from "./mining-cost-assumptions";

export type ProjectionConfigStatus = "CONFIGURED" | "PARTIAL" | "AUDITED";
export type ProjectionConfigSource = "ADMIN_CONFIG" | "CODE_DEFAULT";

/** Risk assumptions in config form (references + pre-audit baselines). */
export interface ProjectionRiskAssumptions {
  hashpriceRefUsdPerThDay: number;
  energyRefUsdPerKwh: number;
  stableApyRefPct: number;
  /** Pre-audit baselines (0–100). Stay CONFIGURED until a real audit source. */
  smartContractBaseline: number;
  counterpartyBaseline: number;
}

/** Mining assumptions in config form. */
export interface ProjectionMiningAssumptions {
  efficiencyKwhPerThDay: number;
  hostingUsdPerThDay: number;
  targetNetMarginUsdPerThDay: number;
  uptimePct: number;
}

export interface ProjectionAssumptionsConfig {
  version: string;
  status: ProjectionConfigStatus;
  company: ProjectionCompanyAssumptions;
  risk: ProjectionRiskAssumptions;
  mining: ProjectionMiningAssumptions;
  metadata: {
    source: ProjectionConfigSource;
    updatedBy?: string;
    updatedAt?: string;
    notes: string[];
  };
}

/** Pre-audit risk baselines mirror METHODOLOGY_BASELINES (kept in sync here for config). */
const RISK_BASELINE_SMART_CONTRACT = 80;
const RISK_BASELINE_COUNTERPARTY = 35;

/** The CODE_DEFAULT config — assembled from the #148/#150 layers verbatim. */
export function getDefaultProjectionAssumptionsConfig(): ProjectionAssumptionsConfig {
  return {
    version: "v1",
    status: "CONFIGURED",
    company: DEFAULT_PROJECTION_COMPANY_ASSUMPTIONS,
    risk: {
      hashpriceRefUsdPerThDay: DEFAULT_RISK_REFERENCES.hashpriceUsdPerThDay,
      energyRefUsdPerKwh: DEFAULT_RISK_REFERENCES.energyUsdPerKwh,
      stableApyRefPct: DEFAULT_RISK_REFERENCES.stableApyPct,
      smartContractBaseline: RISK_BASELINE_SMART_CONTRACT,
      counterpartyBaseline: RISK_BASELINE_COUNTERPARTY,
    },
    mining: {
      efficiencyKwhPerThDay: DEFAULT_MINING_COSTS.efficiencyKwhPerThDay,
      hostingUsdPerThDay: DEFAULT_MINING_COSTS.hostingUsdPerThDay,
      targetNetMarginUsdPerThDay: DEFAULT_MINING_COSTS.targetNetMarginUsdPerThDay,
      uptimePct: DEFAULT_MINING_COSTS.uptimePct,
    },
    metadata: {
      source: "CODE_DEFAULT",
      notes: [
        "Code default values (#148/#150) — NOT yet DB/admin.",
        "CONFIGURED ≠ REAL: company/risk/mining assumptions, not business-validated.",
        "smart-contract & counterparty = pre-Spearbit audit (never REAL without an audit).",
        "Next-P: persist in DB + admin UI; wire Preview to ProjectionStudyRun.",
      ],
    },
  };
}

/** Deep-ish override shape (every field optional, formulas never overridable). */
export interface ProjectionAssumptionsOverrides {
  company?: Partial<
    Pick<
      ProjectionCompanyAssumptions,
      "markupPct" | "revenueSharePct" | "borrowAprPct" | "feePct"
    >
  > & { btcScenarios?: Partial<ProjectionCompanyAssumptions["btcScenarios"]> };
  risk?: Partial<ProjectionRiskAssumptions>;
  mining?: Partial<ProjectionMiningAssumptions>;
  updatedBy?: string;
  updatedAt?: string;
}

/**
 * Merge admin overrides onto the default config. Returns a NEW config whose
 * source becomes ADMIN_CONFIG when any override applied — but status STAYS
 * CONFIGURED (admin input is not validated/audited). Values are validated;
 * invalid numbers are dropped (fall back to default), never silently NaN'd.
 */
export function mergeProjectionAssumptionsOverrides(
  base: ProjectionAssumptionsConfig,
  overrides?: ProjectionAssumptionsOverrides,
): ProjectionAssumptionsConfig {
  if (!overrides) return base;

  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  const company = { ...base.company };
  let touched = false;
  if (overrides.company) {
    const o = overrides.company;
    if (o.markupPct !== undefined) { company.markupPct = num(o.markupPct, company.markupPct); touched = true; }
    if (o.revenueSharePct !== undefined) { company.revenueSharePct = num(o.revenueSharePct, company.revenueSharePct); touched = true; }
    if (o.borrowAprPct !== undefined) { company.borrowAprPct = num(o.borrowAprPct, company.borrowAprPct); touched = true; }
    if (o.feePct !== undefined) { company.feePct = num(o.feePct, company.feePct); touched = true; }
    if (o.btcScenarios) {
      company.btcScenarios = {
        bearPct: num(o.btcScenarios.bearPct, company.btcScenarios.bearPct),
        basePct: num(o.btcScenarios.basePct, company.btcScenarios.basePct),
        bullPct: num(o.btcScenarios.bullPct, company.btcScenarios.bullPct),
      };
      touched = true;
    }
  }

  const risk = { ...base.risk };
  if (overrides.risk) {
    for (const k of Object.keys(risk) as (keyof ProjectionRiskAssumptions)[]) {
      if (overrides.risk[k] !== undefined) {
        risk[k] = num(overrides.risk[k], risk[k]);
        touched = true;
      }
    }
  }

  const mining = { ...base.mining };
  if (overrides.mining) {
    for (const k of Object.keys(mining) as (keyof ProjectionMiningAssumptions)[]) {
      if (overrides.mining[k] !== undefined) {
        mining[k] = num(overrides.mining[k], mining[k]);
        touched = true;
      }
    }
  }

  return {
    ...base,
    company,
    risk,
    mining,
    // status NEVER promoted to REAL/AUDITED by an admin override.
    status: "CONFIGURED",
    metadata: {
      ...base.metadata,
      source: touched ? "ADMIN_CONFIG" : base.metadata.source,
      updatedBy: overrides.updatedBy ?? base.metadata.updatedBy,
      updatedAt: overrides.updatedAt ?? base.metadata.updatedAt,
    },
  };
}

/**
 * Single entry point. Today: code defaults (+ optional in-memory overrides).
 * Later: this is where a DB/admin/env lookup plugs in — callers stay unchanged.
 */
export function getProjectionAssumptionsConfig(
  overrides?: ProjectionAssumptionsOverrides,
): ProjectionAssumptionsConfig {
  return mergeProjectionAssumptionsOverrides(
    getDefaultProjectionAssumptionsConfig(),
    overrides,
  );
}

/** Adapt config → the risk engine's injectable RiskReferenceInputs. */
export function toRiskReferenceInputs(
  cfg: ProjectionAssumptionsConfig,
): RiskReferenceInputs {
  return {
    hashpriceUsdPerThDay: cfg.risk.hashpriceRefUsdPerThDay,
    energyUsdPerKwh: cfg.risk.energyRefUsdPerKwh,
    stableApyPct: cfg.risk.stableApyRefPct,
    smartContractRiskScore: cfg.risk.smartContractBaseline,
    counterpartyRiskScore: cfg.risk.counterpartyBaseline,
    metadata: {
      hashpriceSource: cfg.metadata.source === "ADMIN_CONFIG" ? "CONFIGURED" : "FALLBACK",
      energySource: cfg.metadata.source === "ADMIN_CONFIG" ? "CONFIGURED" : "FALLBACK",
      stableYieldSource: cfg.metadata.source === "ADMIN_CONFIG" ? "CONFIGURED" : "FALLBACK",
      riskBaselineSource: "CONFIGURED",
    },
  };
}

/** Adapt config → the mining engine's injectable MiningCostInputs. */
export function toMiningCostInputs(
  cfg: ProjectionAssumptionsConfig,
): MiningCostInputs {
  return {
    efficiencyKwhPerThDay: cfg.mining.efficiencyKwhPerThDay,
    hostingUsdPerThDay: cfg.mining.hostingUsdPerThDay,
    targetNetMarginUsdPerThDay: cfg.mining.targetNetMarginUsdPerThDay,
    uptimePct: cfg.mining.uptimePct,
    source: cfg.metadata.source === "ADMIN_CONFIG" ? "CONFIGURED" : "FALLBACK",
  };
}
