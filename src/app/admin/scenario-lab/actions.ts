"use server";

import { z } from "zod";
import { getPresetInputs, runScenario } from "@/lib/engine/scenario";
import { VAULTS, VAULT_YIELD } from "@/lib/engine/vaults";
import type {
  BacktestKey,
  BacktestOutput,
  Preset,
  ScenarioInputs,
  ScenarioOutput,
  VaultId,
} from "@/lib/engine/types";
import { requireAuth } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { runScenarioNarrative } from "@/lib/agents/scenario-narrative";
import type { ScenarioNarrativeOutput } from "@/lib/agents/schemas";

const PresetSchema = z.enum([
  "base",
  "btc_bear",
  "btc_bull",
  "mining_compression",
  "extreme_stress",
] as const);

const VaultIdSchema = z.enum(["yield", "defensive", "btc-plus"] as const);

/**
 * Resolves the requested vault id (optional) to a concrete `VaultDefinition`,
 * defaulting to the Hearst Yield Vault. ADR-006 #9: never reuse another vault's
 * preset silently — an unknown id is rejected by Zod so the engine call cannot
 * be tricked into mixing vaults.
 */
function resolveVault(vaultId: string | undefined) {
  if (vaultId === undefined) return VAULT_YIELD;
  const parsed: VaultId = VaultIdSchema.parse(vaultId);
  return VAULTS[parsed];
}

const BacktestKeySchema = z.enum([
  "bear_2022",
  "etf_halving_2024",
  "mining_crunch_2024",
] as const);

const BOUNDS: Record<keyof ScenarioInputs, { min: number; max: number }> = {
  btc_price_change_pct: { min: -100, max: 300 },
  hashprice_usd_th_day: { min: 0.01, max: 1000 },
  energy_cost_kwh: { min: 0.01, max: 1 },
  stable_apy_pct: { min: 0, max: 30 },
  vol_index: { min: 0, max: 100 },
};

function assertBounds(inputs: ScenarioInputs): void {
  for (const [key, { min, max }] of Object.entries(BOUNDS) as Array<
    [keyof ScenarioInputs, { min: number; max: number }]
  >) {
    const v = inputs[key];
    if (v < min || v > max) {
      throw new Error(
        `Input out of bounds: ${key}=${v} (allowed ${min}–${max})`,
      );
    }
  }
}

/**
 * Runs a single scenario through the deterministic engine + Scenario Narrative
 * agent.
 *
 * Flow:
 *   1. requireAuth() — DB-backed session (hc_session) → userId (throws on failure)
 *   2. assertRateLimit by userId — 10/min (LLM-aware threshold; was 30/min
 *      before the narrative agent was wired in)
 *   3. assertBounds(inputs) — slider bounds (throws on out-of-range)
 *   4. runScenario(inputs) — pure-function engine
 *   5. Persist ScenarioRun (engine output)
 *   6. runScenarioNarrative({ scenario_id, scenario_output }) — GPT-4.1
 *      with graceful degradation: if the agent throws (timeout, forbidden-words
 *      filter, schema fail), the run still returns the engine output with
 *      `narrative: null` and the error is logged.
 *   7. Update ScenarioRun with the narrative if produced
 *   8. Return { ...engineOutput, runId, narrative }
 *
 * The Scenario Lab UI MUST tolerate `narrative === null`.
 *
 * Rate limited to 10 calls per minute per user (LLM-aware — was 30/min before
 * the narrative agent was wired in).
 */
export async function runScenarioAction(
  inputs: ScenarioInputs,
  scenarioId: string = "custom",
  vaultId?: string,
): Promise<
  ScenarioOutput & {
    runId: string | null;
    narrative: ScenarioNarrativeOutput | null;
  }
> {
  const { userId } = await requireAuth();
  try {
    await assertRateLimit(`run-scenario:${userId}`, 10, 60_000);
    assertBounds(inputs);
    const vault = resolveVault(vaultId);
    const outputs = runScenario(inputs, { now: new Date(), vault });

    let runId: string | null = null;
    try {
      // `ScenarioRun` does not yet carry a `vaultDeploymentId` column. Until
      // the Phase 3 schema migration lands, persist the vault id inside the
      // `inputs` JSON envelope so the run is fully reproducible without losing
      // which vault it was bound to (ADR-006 #9: no silent reuse).
      const inputsEnvelope = {
        ...inputs,
        _vaultId: vault.id,
      };
      const run = await prisma.scenarioRun.create({
        data: {
          userId,
          inputs: JSON.stringify(inputsEnvelope),
          outputs: JSON.stringify(outputs),
          status: "completed",
          confidence: outputs.confidence,
        },
        select: { id: true },
      });
      runId = run.id;
    } catch (persistErr) {
      // Persistence failure must not fail the response.
      logger.warn("runScenarioAction persistence failed", { userId }, persistErr);
    }

    // Narrative agent — graceful degradation on any failure (LLM down,
    // forbidden-words filter trip, schema validation fail). Engine result is
    // still returned with `narrative: null`.
    let narrative: ScenarioNarrativeOutput | null = null;
    if (runId !== null) {
      try {
        narrative = await runScenarioNarrative(
          {
            scenario_id: scenarioId,
            scenario_output: outputs,
          },
          { userId },
        );

        // Persist narrative on the same run row. A failure here is non-fatal:
        // narrative was produced, just couldn't be stored.
        try {
          await prisma.scenarioRun.update({
            where: { id: runId },
            data: {
              narrative: narrative.narrative_md,
              riskWarning: narrative.risk_warning,
              confidence: narrative.confidence,
            },
          });
        } catch (updateErr) {
          logger.warn(
            "runScenarioAction narrative persistence failed",
            { userId, runId },
            updateErr,
          );
        }
      } catch (agentErr) {
        logger.error(
          "runScenarioAction narrative agent failed",
          { userId, runId, scenarioId },
          agentErr,
        );
      }
    }

    return { ...outputs, runId, narrative };
  } catch (err) {
    logger.error("runScenarioAction failed", { userId }, err);
    throw err;
  }
}

export async function getPresetInputsAction(
  preset: Preset,
): Promise<ScenarioInputs> {
  const { userId } = await requireAuth();
  try {
    PresetSchema.parse(preset);
    return getPresetInputs(preset);
  } catch (err) {
    logger.error("getPresetInputsAction failed", { userId }, err);
    throw err;
  }
}

export async function runComparisonAction(
  presets: [Preset, Preset],
  vaultId?: string,
): Promise<[ScenarioOutput, ScenarioOutput]> {
  const { userId } = await requireAuth();
  try {
    await assertRateLimit(`run-comparison:${userId}`, 15, 60_000);
    PresetSchema.parse(presets[0]);
    PresetSchema.parse(presets[1]);
    const vault = resolveVault(vaultId);
    const now = new Date();
    const a = runScenario(getPresetInputs(presets[0]), { now, preset: presets[0], vault });
    const b = runScenario(getPresetInputs(presets[1]), { now, preset: presets[1], vault });
    return [a, b];
  } catch (err) {
    logger.error("runComparisonAction failed", { userId }, err);
    throw err;
  }
}

export async function runBacktestAction(
  key: BacktestKey,
): Promise<BacktestOutput & { runId: string | null }> {
  const { userId } = await requireAuth();
  try {
    await assertRateLimit(`run-backtest:${userId}`, 10, 60_000);
    BacktestKeySchema.parse(key);
    const { runBacktest } = await import("@/lib/engine/backtest");
    const outputs = runBacktest(key, { now: new Date() });

    let runId: string | null = null;
    try {
      const run = await prisma.backtestRun.create({
        data: {
          userId,
          backtestKey: key,
          initialCapital: outputs.initialCapital,
          rulesMode: outputs.hearstRulesMode ? "hearst_rules" : "without_rules",
          endingValue: outputs.endingValue,
          totalReturnPct: outputs.totalReturnPct,
          maxDrawdownPct: outputs.maxDrawdownPct,
          worstMonthPct: outputs.worstMonthPct,
          numRebalances: outputs.numRebalances,
          monthlySeries: JSON.stringify(outputs.monthlySeries),
        },
        select: { id: true },
      });
      runId = run.id;
    } catch (persistErr) {
      // Persistence failure must not fail the response.
      logger.warn("runBacktestAction persistence failed", { userId }, persistErr);
    }

    return { ...outputs, runId };
  } catch (err) {
    logger.error("runBacktestAction failed", { userId }, err);
    throw err;
  }
}
