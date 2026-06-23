"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { runScenario, getPresetInputs } from "@/lib/engine/scenario";
import { prisma } from "@/lib/db";
import { assertRateLimit } from "@/lib/rate-limit";
import type { ScenarioOutput } from "@/lib/engine/types";

/** Admin projection actions rate limit: 10 requests / 60s / admin. */
const PROJ_RATE_MAX = 10;
const PROJ_RATE_WINDOW_MS = 60_000;

// ─── Input schemas ────────────────────────────────────────────────────────────

const ScenarioInputsSchema = z
  .object({
    btc_price_change_pct: z.number().min(-100).max(300),
    hashprice_usd_th_day: z.number().min(0.01).max(1000),
    energy_cost_kwh: z.number().min(0.01).max(1),
    stable_apy_pct: z.number().min(0).max(30),
    vol_index: z.number().min(0).max(100),
  })
  .strict();

type ScenarioInputs = z.infer<typeof ScenarioInputsSchema>;

const BatchAxisSchema = z
  .object({
    field: z.enum([
      "btc_price_change_pct",
      "hashprice_usd_th_day",
      "stable_apy_pct",
    ]),
    // 1..5 values per axis — enforced so max cells = 5×5 = 25
    values: z.array(z.number()).min(1).max(5),
  })
  .strict();

type BatchAxis = z.infer<typeof BatchAxisSchema>;

const RunProjectionStudyInputSchema = z
  .object({
    label: z.string().max(120).optional(),
    base: ScenarioInputsSchema,
    // axes: [xAxis] or [xAxis, yAxis] — max 2 axes
    axes: z.tuple([BatchAxisSchema, BatchAxisSchema]).or(z.tuple([BatchAxisSchema])).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

// ─── Types ────────────────────────────────────────────────────────────────────

type MatrixCell = {
  apyLow: number;
  apyHigh: number;
  riskScore: number;
  scenarioRunId: string;
  allocations: { bucket: string; pct: number }[];
  confidence: string;
};

type RunProjectionStudyResult = {
  studyId: string;
  runIds: string[];
  matrix: {
    x?: string;
    y?: string;
    cells: MatrixCell[];
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyAxisOverride(
  base: ScenarioInputs,
  field: BatchAxis["field"],
  value: number,
): ScenarioInputs {
  return { ...base, [field]: value };
}

async function persistScenarioRun(
  userId: string,
  inputs: ScenarioInputs,
  outputs: ScenarioOutput,
): Promise<string> {
  const run = await prisma.scenarioRun.create({
    data: {
      userId,
      inputs: JSON.stringify(inputs),
      outputs: JSON.stringify(outputs),
      status: "completed",
      confidence: outputs.confidence,
    },
    select: { id: true },
  });
  return run.id;
}

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * runProjectionStudy
 *
 * Runs a single scenario or an NxM batch matrix (max 25 cells = 5×5).
 * All engine calls are pure-function, I/O happens only in DB persistence.
 *
 * Single run  → 1 ScenarioRun, ProjectionStudyRun.matrixSize = 1
 * 1D batch    → N ScenarioRun rows, matrixSize = N (N ≤ 5)
 * 2D batch    → N×M ScenarioRun rows, matrixSize = N×M (max 25)
 */
export async function runProjectionStudy(input: {
  label?: string;
  base: z.infer<typeof ScenarioInputsSchema>;
  axes?: [z.infer<typeof BatchAxisSchema>, z.infer<typeof BatchAxisSchema>?];
  notes?: string;
}): Promise<RunProjectionStudyResult> {
  const { userId, walletAddress } = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:projection:${userId}`,
      PROJ_RATE_MAX,
      PROJ_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const actor = walletAddress ?? userId;

  // Validate all inputs
  const parsed = RunProjectionStudyInputSchema.parse(input);
  const { base, axes, label, notes } = parsed;

  const now = new Date();

  // Build the list of (inputs, cellIndex) tuples that will run in parallel
  type CellJob = { inputs: ScenarioInputs; xLabel?: string; yLabel?: string };
  const jobs: CellJob[] = [];

  if (!axes) {
    // Single run
    jobs.push({ inputs: base });
  } else {
    const [xAxis, yAxis] = axes;
    if (!yAxis) {
      // 1D: vary first axis
      for (const xVal of xAxis.values) {
        jobs.push({
          inputs: applyAxisOverride(base, xAxis.field, xVal),
          xLabel: `${xAxis.field}=${xVal}`,
        });
      }
    } else {
      // 2D: vary both axes — max 5×5 = 25 cells
      for (const xVal of xAxis.values) {
        for (const yVal of yAxis.values) {
          const withX = applyAxisOverride(base, xAxis.field, xVal);
          jobs.push({
            inputs: applyAxisOverride(withX, yAxis.field, yVal),
            xLabel: `${xAxis.field}=${xVal}`,
            yLabel: `${yAxis.field}=${yVal}`,
          });
        }
      }
    }
  }

  // Run all engine calls (pure, synchronous) + persist in parallel
  const runResults = await Promise.all(
    jobs.map(async (job) => {
      const outputs = runScenario(job.inputs, { now });
      const runId = await persistScenarioRun(userId, job.inputs, outputs);
      return { runId, outputs, xLabel: job.xLabel, yLabel: job.yLabel };
    }),
  );

  const runIds = runResults.map((r) => r.runId);
  const matrixSize = runIds.length;

  // Derive x/y axis labels for response
  const xAxisField = axes ? axes[0]?.field : undefined;
  const yAxisField = axes && axes[1] ? axes[1].field : undefined;

  const cells: MatrixCell[] = runResults.map((r) => ({
    apyLow: r.outputs.apy_range.low,
    apyHigh: r.outputs.apy_range.high,
    riskScore: r.outputs.risk_score,
    scenarioRunId: r.runId,
    allocations: r.outputs.allocations.map((a) => ({
      bucket: a.bucket,
      pct: a.pct,
    })),
    confidence: r.outputs.confidence,
  }));

  // Persist the ProjectionStudyRun parent
  const study = await prisma.projectionStudyRun.create({
    data: {
      createdBy: userId,
      label: label ?? null,
      presetIds: JSON.stringify([]),
      matrixSize,
      scenarioRunIds: JSON.stringify(runIds),
      methodologyVersion: "v1.0",
      notes: notes ?? null,
    },
    select: { id: true },
  });

  // Audit log
  await recordAdminAudit({
    actorWallet: actor,
    action: "projection.run",
    entityType: "ProjectionStudyRun",
    entityId: study.id,
    after: { runIds, matrixSize, label },
  });

  return {
    studyId: study.id,
    runIds,
    matrix: {
      x: xAxisField,
      y: yAxisField,
      cells,
    },
  };
}

// ─── Promotion defaults ───────────────────────────────────────────────────────

/**
 * Default multisig signers applied when promoting a study to a vault draft.
 * Read from `VAULT_DEFAULT_SIGNERS` (comma-separated 0x addresses); only
 * well-formed addresses survive the filter. Empty when unset — the draft is then
 * created with NO signers (honest) instead of persisting `PLACEHOLDER_SIGNER_*`
 * strings into VaultDeployment rows. The admin fills the real whitelist in the
 * wizard before submitting the draft for review.
 */
const DEFAULT_SIGNERS: string[] = (process.env.VAULT_DEFAULT_SIGNERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => /^0x[a-fA-F0-9]{40}$/.test(s));

/** Default fee/lockup/governance values applied when promoting a study to draft. */
const PROMOTE_DEFAULTS = {
  mgmtFeeBps: 200,
  perfFeeBps: 2_000,
  hurdleBps: 0,
  softLockupDays: 60,
  requiredSigners: 2,
  shareClass: "A",
  spvJurisdiction: "cayman",
  regExemption: "regD_506c",
  minTicketUsdc: 250_000,
  capacityUsdc: 25_000_000,
  /** Real signers from env (VAULT_DEFAULT_SIGNERS), or empty — never placeholders. */
  signersWhitelist: DEFAULT_SIGNERS,
  disclaimers:
    "Projections are conditional on stated assumptions and are not warranted. Past performance does not predict future results. Hearst Yield Vault is offered exclusively to professional and qualified investors. Capital is subject to market risk. This is a scenario projection only, not an offer or solicitation.",
  /** Fallback allocation defaults summing to 10000 bps (40/20/25/15). */
  fallbackAllocBps: {
    mining: 4_000,
    btcTactical: 2_000,
    usdcBase: 2_500,
    stableReserve: 1_500,
  },
} as const;

/**
 * Normalise four allocation bps values so they sum to exactly 10000.
 *
 * Strategy: compute the raw values, distribute any rounding residual onto
 * the largest bucket so the invariant is always satisfied.
 */
function normaliseAllocBps(
  miningPct: number,
  btcPct: number,
  usdcPct: number,
  reservePct: number,
): { mining: number; btcTactical: number; usdcBase: number; stableReserve: number } {
  const totalPct = miningPct + btcPct + usdcPct + reservePct;

  // If the engine returned all-zero allocations, fall back to defaults.
  if (totalPct === 0) {
    return { ...PROMOTE_DEFAULTS.fallbackAllocBps };
  }

  // Scale all buckets so they nominally sum to 10000, then floor each.
  const scale = 10_000 / totalPct;
  const mining = Math.floor(miningPct * scale);
  const btcTactical = Math.floor(btcPct * scale);
  const usdcBase = Math.floor(usdcPct * scale);
  const stableReserve = Math.floor(reservePct * scale);

  // Distribute the residual onto the largest bucket.
  const residual = 10_000 - (mining + btcTactical + usdcBase + stableReserve);
  const buckets = [
    { key: "mining" as const, val: mining },
    { key: "btcTactical" as const, val: btcTactical },
    { key: "usdcBase" as const, val: usdcBase },
    { key: "stableReserve" as const, val: stableReserve },
  ];
  const largest = buckets.reduce((a, b) => (b.val > a.val ? b : a));
  const result = { mining, btcTactical, usdcBase, stableReserve };
  result[largest.key] += residual;
  return result;
}

/**
 * promoteStudyToDraft
 *
 * Reads the first ScenarioRun of a study and creates a VaultDeployment in
 * status=draft with ALL fields required by CreateDraftSchema seeded from the
 * engine output and sensible defaults. The admin can then edit the deployment
 * in the wizard before submitting for review — the form will be ≥ 80% pre-filled.
 *
 * Fields seeded from study:  targetApyLowBps, targetApyHighBps, allocation bps,
 *                             name (from study label), description.
 * Fields set to defaults:    mgmtFeeBps, perfFeeBps, hurdleBps, softLockupDays,
 *                             requiredSigners, shareClass, spvJurisdiction,
 *                             regExemption, disclaimers, signersWhitelist (placeholders).
 */
export async function promoteStudyToDraft(
  studyId: string,
  ticker?: string,
): Promise<{ deploymentId: string }> {
  const { userId, walletAddress } = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:projection:${userId}`,
      PROJ_RATE_MAX,
      PROJ_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const actor = walletAddress ?? userId;

  const studyIdParsed = z.string().cuid().parse(studyId);
  const tickerParsed = ticker
    ? z.string().min(2).max(20).regex(/^[A-Z0-9-]+$/).parse(ticker)
    : undefined;

  const study = await prisma.projectionStudyRun.findUniqueOrThrow({
    where: { id: studyIdParsed },
    select: { id: true, scenarioRunIds: true, label: true },
  });

  let runIds: string[];
  try {
    runIds = JSON.parse(study.scenarioRunIds ?? "[]") as string[];
  } catch {
    throw new Error("Invalid scenarioRunIds format");
  }
  const firstRunId = runIds[0];
  if (!firstRunId) {
    throw new Error("Study has no associated ScenarioRun rows.");
  }

  const scenarioRun = await prisma.scenarioRun.findUniqueOrThrow({
    where: { id: firstRunId },
    select: { outputs: true, inputs: true },
  });

  let outputs: ScenarioOutput;
  try {
    outputs = JSON.parse(scenarioRun.outputs ?? "{}") as ScenarioOutput;
  } catch {
    throw new Error("Invalid scenario outputs format");
  }

  // Derive allocation targets (pct) from engine output
  const findAlloc = (bucket: string) =>
    outputs.allocations.find((a) => a.bucket === bucket)?.pct ?? 0;

  const miningPct = findAlloc("mining");
  const btcPct = findAlloc("btc_tactical");
  const usdcPct = findAlloc("usdc_base");
  const reservePct = findAlloc("stable_reserve");

  // Normalise to exactly 10000 bps (handles float rounding and all-zero edge case)
  const allocBps = normaliseAllocBps(miningPct, btcPct, usdcPct, reservePct);

  const apyLowBps = Math.round(outputs.apy_range.low * 100);
  const apyHighBps = Math.round(outputs.apy_range.high * 100);

  // APY range must be a valid range; guard against degenerate engine outputs.
  const finalApyLow = apyLowBps;
  const finalApyHigh = apyHighBps > apyLowBps ? apyHighBps : apyLowBps + 100;

  const derivedTicker =
    tickerParsed ?? `HYV-${Date.now().toString(36).toUpperCase().slice(-4)}`;

  const deployment = await prisma.vaultDeployment.create({
    data: {
      ticker: derivedTicker,
      name: study.label ?? `Projection Draft — ${derivedTicker}`,
      description: `Seeded from ProjectionStudyRun ${study.id}. Methodology v1.0.`,
      strategy: "mining_yield",
      status: "draft",
      minTicketUsdc: PROMOTE_DEFAULTS.minTicketUsdc,
      capacityUsdc: PROMOTE_DEFAULTS.capacityUsdc,
      mgmtFeeBps: PROMOTE_DEFAULTS.mgmtFeeBps,
      perfFeeBps: PROMOTE_DEFAULTS.perfFeeBps,
      hurdleBps: PROMOTE_DEFAULTS.hurdleBps,
      softLockupDays: PROMOTE_DEFAULTS.softLockupDays,
      targetApyLowBps: finalApyLow,
      targetApyHighBps: finalApyHigh,
      spvJurisdiction: PROMOTE_DEFAULTS.spvJurisdiction,
      shareClass: PROMOTE_DEFAULTS.shareClass,
      regExemption: PROMOTE_DEFAULTS.regExemption,
      disclaimers: PROMOTE_DEFAULTS.disclaimers,
      targetMiningBps: allocBps.mining,
      targetBtcTacticalBps: allocBps.btcTactical,
      targetUsdcBaseBps: allocBps.usdcBase,
      targetStableReserveBps: allocBps.stableReserve,
      signersWhitelist: JSON.stringify(PROMOTE_DEFAULTS.signersWhitelist),
      requiredSigners: PROMOTE_DEFAULTS.requiredSigners,
      createdBy: userId,
      seededFromStudyId: study.id,
    },
    select: { id: true },
  });

  await recordAdminAudit({
    actorWallet: actor,
    action: "projection.promoteStudyToDraft",
    entityType: "VaultDeployment",
    entityId: deployment.id,
    after: {
      studyId: study.id,
      ticker: derivedTicker,
      apyLowBps,
      apyHighBps,
    },
  });

  return { deploymentId: deployment.id };
}

/**
 * getPresetInputsForProjection
 *
 * Admin-gated wrapper around getPresetInputs — returns validated ScenarioInputs
 * for a given preset key.
 */
export async function getPresetInputsForProjection(
  preset: "base" | "btc_bear" | "btc_bull" | "mining_compression" | "extreme_stress",
): Promise<ScenarioInputs> {
  await requireAdmin();
  const presetParsed = z
    .enum(["base", "btc_bear", "btc_bull", "mining_compression", "extreme_stress"])
    .parse(preset);
  return getPresetInputs(presetParsed);
}
