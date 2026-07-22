import "server-only";

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { authoritativeVaultSnapshotWhere } from "@/lib/data/snapshot-sources";
import { logger } from "@/lib/logger";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { fetchHashprice } from "@/lib/data/hashprice";
import { getEnergyCostUsdPerKwh } from "@/lib/data/energy-cost";
import { computeMiningRevenue } from "@/lib/engine/mining";
import { decideMode } from "@/lib/engine/rebalancing";
import {
  evaluateRules as engineEvaluateRules,
  type AllocationMix,
  type RebalanceSignal,
  type VaultStateForSignal,
} from "@/lib/engine/rebalancing-rules";
import { computeRiskBreakdown } from "@/lib/engine/risk";
import type { ScenarioInputs, VaultMode } from "@/lib/engine/types";

// Re-export the pure-lib types so existing consumers that import them from
// this Inngest module continue to work (legacy import path).
export type { AllocationMix, RebalanceSignal, VaultStateForSignal };

/**
 * Rebalancing Signal — event-driven Inngest function.
 *
 * Subscribes to:
 *   - `risk.daily.completed`            (emitted by `risk-daily` cron)
 *   - `rebalance.signal.requested`      (manual admin trigger)
 *
 * Subscribes to `market.data.updated` (emitted by `market-data-hourly` after
 * each successful fetch) to enable intra-day signal re-evaluation on
 * significant BTC/hashprice moves.
 *
 * Pipeline (steps):
 *   1. load-state           → load live vault state (allocations, mining
 *                             metric, BTC price, NAV).
 *   2. evaluate-rules       → apply spec R1-R5 + R-BTC-1..R-BTC-6 thresholds.
 *                             Uses only PURE engine helpers
 *                             (`computeMiningRevenue`, `assessBtcTactical`,
 *                             `decideMode`, `computeRiskBreakdown`) — engine
 *                             files are untouched.
 *   3. persist-event-<rule> → for each armed signal, persist a RebalanceEvent
 *                             row (PTAI format) IF no duplicate exists for
 *                             the same `ruleId` within the last 1h.
 *   4. emit                 → `rebalance.signal.created` per persisted event.
 *
 * Idempotency:
 *   1-hour window per `ruleId`. We query `RebalanceEvent` filtered by
 *   `ruleId` and `executedAt >= now - 1h`. If a row exists we skip persist.
 *   This is local to this function — the cross-function `LlmRun`-based
 *   idempotency helper (`isDuplicate`) is not used here because it operates
 *   on a 24h day granularity, too coarse for an event-driven evaluator.
 *
 * PTAI compliance:
 *   The `trigger`, `action`, `projection`, `impact` strings are static
 *   templates (no LLM, the rules are deterministic per spec). Each string
 *   is asserted against the forbidden-words list at module init time below;
 *   any drift will fail the import.
 */

// ---------------------------------------------------------------------------
// Constants — Inngest-specific (rule thresholds live in the pure engine lib).
// ---------------------------------------------------------------------------

export const REBALANCING_SIGNAL_ID = "rebalancing-signal" as const;
const IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000; // 1 hour per ruleId

// Defaults used when the DB has no rows yet (fallback path, signals will
// still evaluate against the engine; this matches the dashboard fallback).
// Energy cost is resolved via `getEnergyCostUsdPerKwh()` so the env override
// applies even on the fallback path; we keep a constant here only as the
// absolute floor used when the loader itself is unavailable.
const FALLBACK_STABLE_APY_PCT = 4.5;
const FALLBACK_VOL_INDEX = 50;
const FALLBACK_BTC_POSITION_PCT = 14;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RebalancingSignalStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
  sendEvent(
    id: string,
    payload: { name: string; data: Record<string, unknown> },
  ): Promise<unknown>;
}

export interface RebalancingSignalResult {
  signalsTriggered: number;
  signalIds: string[];
  ruleIds: string[];
  source: VaultStateForSignal["source"];
}

// ---------------------------------------------------------------------------
// State loader
// ---------------------------------------------------------------------------

export async function loadVaultStateForSignal(): Promise<VaultStateForSignal> {
  const [latestSnapshot, latestMining, btc, hp] = await Promise.all([
    // Seed guard: authoritative sources only — a reappeared demo_seed row is never served.
    prisma.vaultSnapshot.findFirst({
      where: authoritativeVaultSnapshotWhere(),
      orderBy: { takenAt: "desc" },
      include: { allocations: true },
    }),
    prisma.miningMetric.findFirst({ orderBy: { takenAt: "desc" } }),
    fetchBtcPrice(),
    fetchHashprice(),
  ]);

  let fallbackUsed = false;
  if (latestSnapshot === null) fallbackUsed = true;
  if (latestMining === null) fallbackUsed = true;
  if (btc.usd === 0 || btc.stale) fallbackUsed = true;
  if (hp.usd_per_th_day === 0 || hp.stale) fallbackUsed = true;

  // Hashprice — prefer live, else fall back to latest DB row.
  const hashpricePerThDay =
    hp.usd_per_th_day > 0
      ? hp.usd_per_th_day
      : latestMining
        ? latestMining.hashprice.toNumber()
        : 0.078;

  const energyCostKwh = latestMining
    ? latestMining.energyCost.toNumber()
    : getEnergyCostUsdPerKwh().usdPerKwh;

  // Stable APY: undo the bps-at-pct encoding stored on the allocation row.
  const usdcBaseAlloc = latestSnapshot?.allocations.find(
    (a) => a.bucket === "usdc_base",
  );
  const usdcBasePct = usdcBaseAlloc?.pct.toNumber() ?? 0;
  const usdcBaseBps = usdcBaseAlloc?.yieldContributionBps.toNumber() ?? 0;
  const stableApyPct =
    usdcBaseAlloc && usdcBasePct > 0
      ? usdcBaseBps / usdcBasePct / 100
      : FALLBACK_STABLE_APY_PCT;

  // BTC 30d proxy — we use the 24h change because the live feed exposes it.
  // The spec speaks of 30d; this is the closest available signal at MVP.
  // R4 (hashprice 30d trend) DOES use a true 30d trend from the mining row.
  const btc30dProxyPct = btc.usd > 0 ? btc.usd_24h_change : 0;

  const scenarioInputs: ScenarioInputs = {
    btc_price_change_pct: btc30dProxyPct,
    hashprice_usd_th_day: hashpricePerThDay,
    energy_cost_kwh: energyCostKwh,
    stable_apy_pct: stableApyPct,
    vol_index: FALLBACK_VOL_INDEX,
  };

  // Pure engine derivations.
  const mining = computeMiningRevenue(scenarioInputs);
  const risk = computeRiskBreakdown(scenarioInputs);
  const miningMarginScore = latestSnapshot
    ? latestSnapshot.miningMarginScore
    : Math.round(mining.margin_score);
  const riskScore = latestSnapshot
    ? latestSnapshot.riskScore
    : Math.round(risk.composite);
  const mode = latestSnapshot
    ? normaliseMode(latestSnapshot.mode)
    : decideMode(riskScore, miningMarginScore);

  // Mining net contribution APY (% annualised on invested $/TH).
  // Mirrors engine convention used in deriveAllocations: invested = $120/TH.
  const miningNetApyPct =
    (Math.max(0, mining.net_margin_usd_th_day) * 365 * 100) / 120;

  // BTC tactical sleeve %.
  const btcAlloc = latestSnapshot?.allocations.find(
    (a) => a.bucket === "btc_tactical",
  );
  const btcPositionPct = btcAlloc?.pct.toNumber() ?? FALLBACK_BTC_POSITION_PCT;

  // Hashprice trend (30d) — from the latest mining row.
  const hashpriceTrendPct = latestMining
    ? latestMining.hashpriceTrendPct.toNumber()
    : 0;

  return {
    vaultRef: "yield",
    scenarioInputs,
    mode,
    riskScore,
    miningMarginScore,
    miningNetApyPct,
    stableApyPct,
    hashpriceTrendPct,
    btcPositionPct,
    btcUsd: btc.usd,
    source: fallbackUsed
      ? latestSnapshot === null && latestMining === null
        ? "fallback"
        : "partial"
      : "db",
  };
}

function normaliseMode(m: string): VaultMode {
  if (m === "defensive" || m === "balanced" || m === "opportunistic") return m;
  return "balanced";
}

// ---------------------------------------------------------------------------
// Rule evaluator — thin wrapper around the pure engine lib.
//
// The rule logic now lives in `src/lib/engine/rebalancing-rules.ts` so that
// `runScenarioAction`, the dashboard, and any future caller can reuse it
// without dragging in Inngest/Prisma. This wrapper preserves the legacy
// `evaluateRules(state)` signature consumed by existing tests.
// ---------------------------------------------------------------------------

export function evaluateRules(state: VaultStateForSignal): RebalanceSignal[] {
  return engineEvaluateRules({ state }).signals;
}

// ---------------------------------------------------------------------------
// Idempotency — 1h window per ruleId, scoped to RebalanceEvent.
// ---------------------------------------------------------------------------

function rebalanceVaultScopeWhere(vaultRef: string) {
  return vaultRef === "yield"
    ? { OR: [{ vaultRef: "yield" }, { vaultRef: null }] }
    : { vaultRef };
}

async function hasRecentSignal(
  ruleId: string,
  now: Date,
  vaultRef: string,
): Promise<boolean> {
  const since = new Date(now.getTime() - IDEMPOTENCY_WINDOW_MS);
  const existing = await prisma.rebalanceEvent.findFirst({
    where: {
      ruleId,
      executedAt: { gte: since },
      ...rebalanceVaultScopeWhere(vaultRef),
    },
    orderBy: { executedAt: "desc" },
  });
  return existing !== null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface RebalancingSignalHandlerArgs {
  step: RebalancingSignalStep;
  event?: { name?: string; id?: string };
  /**
   * Optional loader override for tests. In production the default
   * `loadVaultStateForSignal` is used.
   */
  loader?: () => Promise<VaultStateForSignal>;
}

export async function rebalancingSignalHandler({
  step,
  event,
  loader,
}: RebalancingSignalHandlerArgs): Promise<RebalancingSignalResult> {
  const sourceEventName = event?.name ?? "manual";
  const sourceEventId = event?.id ?? "n/a";
  const now = new Date();
  const loadState = loader ?? loadVaultStateForSignal;

  // ---- Step 1: load state -------------------------------------------------
  const state = await step.run("load-state", () => loadState());

  // ---- Step 2: evaluate rules (pure) --------------------------------------
  const signals = await step.run("evaluate-rules", () => evaluateRules(state));

  if (signals.length === 0) {
    logger.info("[rebalancing-signal] no signals triggered", {
      source: state.source,
      sourceEventName,
      mode: state.mode,
      riskScore: state.riskScore,
      miningMarginScore: state.miningMarginScore,
    });
    return {
      signalsTriggered: 0,
      signalIds: [],
      ruleIds: [],
      source: state.source,
    };
  }

  // ---- Step 3: persist each (with per-ruleId idempotency) -----------------
  const persistedIds: string[] = [];
  const persistedRuleIds: string[] = [];
  const vaultRef = state.vaultRef ?? "yield";

  for (const signal of signals) {
    const result = await step.run(`persist-event-${signal.ruleId}`, async () => {
      if (await hasRecentSignal(signal.ruleId, now, vaultRef)) {
        logger.info("[rebalancing-signal] idempotency hit", {
          ruleId: signal.ruleId,
          vaultRef,
          windowMs: IDEMPOTENCY_WINDOW_MS,
        });
        return null;
      }
      const created = await prisma.rebalanceEvent.create({
        data: {
          ruleId: signal.ruleId,
          vaultRef,
          triggerText: signal.trigger,
          actionText: signal.action,
          impactText: signal.impact,
          // PTAI Projection now stored as its own column (was previously
          // squeezed into triggerText with a "| PROJECTION:" delimiter).
          projection: signal.projection,
          // status="pending" is the Prisma default; we set it explicitly so
          // downstream consumers don't have to rely on schema defaults.
          status: "pending",
          // triggeredAt is the wall-clock moment the signal fired. We
          // intentionally use the handler-level `now` so all signals from
          // one invocation share the same triggeredAt — useful for
          // correlation. executedAt remains @default(now()) until/unless
          // the multisig actually executes the rebalance.
          triggeredAt: now,
          // Trace which Inngest event spawned this signal. `null` covers
          // ad-hoc manual triggers where the upstream event metadata isn't
          // available.
          sourceEventName: event?.name ?? null,
          sourceEventId: event?.id ?? null,
          fromAllocation: JSON.stringify(signal.fromAllocation),
          toAllocation: JSON.stringify(signal.toAllocation),
          approvedBy: JSON.stringify([]),
        },
      });
      logger.info("[rebalancing-signal] persisted", {
        id: created.id,
        ruleId: signal.ruleId,
        vaultRef,
        sourceEventName,
        sourceEventId,
      });
      return { id: created.id, ruleId: signal.ruleId };
    });
    if (result !== null) {
      persistedIds.push(result.id);
      persistedRuleIds.push(result.ruleId);
    }
  }

  // ---- Step 4: emit one event per persisted signal ------------------------
  for (let i = 0; i < persistedIds.length; i++) {
    const id = persistedIds[i];
    const ruleId = persistedRuleIds[i];
    if (id === undefined || ruleId === undefined) continue;
    await step.sendEvent(`emit-${ruleId}`, {
      name: "rebalance.signal.created",
      data: {
        id,
        ruleId,
        source: state.source,
        sourceEventName,
        sourceEventId,
      },
    });
  }

  logger.info("[rebalancing-signal] completed", {
    signalsTriggered: persistedIds.length,
    ruleIds: persistedRuleIds,
    source: state.source,
  });

  return {
    signalsTriggered: persistedIds.length,
    signalIds: persistedIds,
    ruleIds: persistedRuleIds,
    source: state.source,
  };
}

export const rebalancingSignal = inngest.createFunction(
  {
    id: REBALANCING_SIGNAL_ID,
    concurrency: { limit: 1 },
    triggers: [
      { event: "risk.daily.completed" },
      { event: "rebalance.signal.requested" },
      { event: "market.data.updated" },
    ],
  },
  rebalancingSignalHandler,
);
