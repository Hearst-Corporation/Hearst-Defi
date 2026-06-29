import "server-only";

/**
 * Product-construction pipeline — orchestrates the six live-read swarms.
 *
 *   A telegram_pricing → B market_live → C strategy_cross →
 *   D quant_montecarlo → E charts → F writeup
 *
 * Sequential, deterministic in (objective, market spot): the Monte-Carlo seed is
 * derived from the objective + the live BTC spot so the same inputs reproduce
 * the same fan (ADR-006 — no Math.random, no Date.now). Read-only end to end:
 * the draft's effects are all suppressed and the floor is asserted before the
 * draft is returned. Nothing is sent, deployed, marked-live, or written
 * custodially; the admin reviews the draft and runs everything manually.
 */

import { inferVault } from "@/lib/llm/product-chat-stream";
import { logger } from "@/lib/logger";

import {
  runTelegramPricing,
  runMarketLive,
  runStrategyCross,
  runQuant,
} from "./runners-data";
import { runCharts } from "./runners-artifacts";
import { runWriteup } from "./runners-writeup";
import { LIVE_SWARM_STAGES } from "./stage-registry";
import {
  assertAllStagesSafe,
  assertDraftEffectsSuppressed,
} from "./assert-live-safe";
import type {
  LiveSwarmStepAudit,
  ProductConstructionDraft,
  ProductConstructionError,
} from "./types";

const DEFAULT_HORIZON_MONTHS = 12;
const DEFAULT_FLOOR_APY_PCT = 8;
const DISCLAIMER =
  "Projection conditionnelle aux hypothèses affichées — non garantie. Aucun produit n'est créé, déployé ou mis en ligne depuis cette construction ; c'est un brouillon que l'admin valide et exécute manuellement.";

/** Deterministic non-crypto seed from a string + spot (stable across runs). */
function deriveSeed(objective: string, btcUsd: number): number {
  let h = 2166136261 >>> 0; // FNV-1a
  const s = `${objective}|${Math.round(btcUsd)}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface PipelineOptions {
  horizonMonths?: number;
  floorApyPct?: number;
  /** Skip the LLM write-up and use the deterministic one (faster / no LLM cost). */
  deterministicWriteupOnly?: boolean;
}

/**
 * Run the full construction. Returns a typed error (never throws) on a floor
 * violation; data-stage failures degrade gracefully (Stale) rather than abort.
 */
export async function runProductConstructionPipeline(
  objective: string,
  opts: PipelineOptions = {},
): Promise<ProductConstructionDraft | ProductConstructionError> {
  // Static safety: every stage definition must satisfy the floor before we run.
  const stageViolations = assertAllStagesSafe(LIVE_SWARM_STAGES);
  if (stageViolations.length > 0) {
    return {
      kind: "floor_violation",
      reasonCode: "stage_floor_violation",
      message: stageViolations.map((v) => v.detail).join(" · "),
    };
  }

  const trimmed = objective.trim().slice(0, 220);
  if (trimmed.length === 0) {
    return {
      kind: "stage_failed",
      reasonCode: "empty_objective",
      message: "An objective is required to construct a product.",
    };
  }

  const horizonMonths = opts.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  const floorApyPct = opts.floorApyPct ?? DEFAULT_FLOOR_APY_PCT;
  const audit: LiveSwarmStepAudit[] = [];

  // A · Telegram pricing  +  B · market live (independent reads, run together).
  const [telegram, market] = await Promise.all([
    runTelegramPricing(),
    runMarketLive(),
  ]);
  audit.push(telegram.audit, market.audit);

  // C · strategy cross (the existing aggregator).
  const strategy = await runStrategyCross();
  audit.push(strategy.audit);

  // D · quant Monte-Carlo (seeded from objective + spot).
  const seed = deriveSeed(trimmed, market.btcUsd);
  const quant = runQuant({
    seed,
    horizonMonths,
    market: {
      btcUsd: market.btcUsd,
      difficulty: market.difficulty,
      hashpriceUsdPerThDay: market.hashpriceUsdPerThDay,
    },
    strategy: {
      miningYieldPct: strategy.artifact.miningYieldPct,
      usdcYieldPct: strategy.artifact.usdcYieldPct,
      headlineApy: strategy.artifact.headlineApy,
    },
    telegram: { bestCostPerThDay: telegram.bestCostPerThDay },
    floorApyPct,
  });
  audit.push(quant.audit);

  // E · charts (pure mapping).
  const charts = runCharts({
    strategy: strategy.artifact,
    quant: quant.artifact,
  });
  audit.push({
    stageId: "charts",
    mode: "live_read",
    ok: true,
    reasonCode: "charts_ok",
    provenance: quant.artifact.provenance,
    degraded: false,
  });

  // F · writeup (LLM + guard, or deterministic).
  const vault = inferVault(trimmed);
  const writeup = await runWriteup({
    objective: trimmed,
    vaultLabel: vault.label,
    strategy: strategy.artifact,
    quant: quant.artifact,
    market: {
      btcUsd: market.btcUsd,
      hashpriceUsdPerThDay: market.hashpriceUsdPerThDay,
    },
  });
  audit.push(writeup.audit);

  const draft: ProductConstructionDraft = {
    objective: trimmed,
    vault: { ticker: vault.ticker, label: vault.label },
    telegram: {
      configured: telegram.configured,
      machineCount: telegram.machineCount,
      ...(telegram.topMachine ? { topMachine: telegram.topMachine } : {}),
    },
    market: {
      btcUsd: market.btcUsd,
      hashpriceUsdPerThDay: market.hashpriceUsdPerThDay,
      defiApyMedianPct: market.defiApyMedianPct,
    },
    strategy: strategy.artifact,
    quant: quant.artifact,
    charts: charts.charts,
    writeup: writeup.artifact,
    audit,
    safe: true,
    disclaimer: DISCLAIMER,
    mode: "live_read",
    effects: {
      externalSend: false,
      deployed: false,
      markedLive: false,
      custodialWrite: false,
    },
  };

  // Runtime floor: the draft must have suppressed every effect. If not, refuse.
  const effectViolations = assertDraftEffectsSuppressed(draft);
  if (effectViolations.length > 0) {
    logger.error("[live-swarm] draft effect not suppressed", {
      detail: effectViolations.map((v) => v.detail).join(" · "),
    });
    return {
      kind: "unsafe",
      reasonCode: "effect_not_suppressed",
      message: effectViolations.map((v) => v.detail).join(" · "),
    };
  }

  return draft;
}

/** Narrow a pipeline result to the error branch. */
export function isProductConstructionError(
  r: ProductConstructionDraft | ProductConstructionError,
): r is ProductConstructionError {
  return (
    (r as ProductConstructionError).kind === "stage_failed" ||
    (r as ProductConstructionError).kind === "floor_violation" ||
    (r as ProductConstructionError).kind === "unsafe"
  );
}
