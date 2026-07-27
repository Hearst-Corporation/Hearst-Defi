/**
 * construction-timeline.ts — sequenced visual reveal for the product build.
 *
 *   Execution parallel.  Affichage séquencé.  One source of truth.
 *
 * The swarms run in parallel and finish in ANY order. The UI, however, must
 * reveal the construction in a FIXED, deterministic, pedagogical order with
 * dependency gates: a downstream block (performance engines, allocation, the
 * Safe scenario, the product summary) stays in a skeleton/waiting state until
 * its inputs are ready — it is never reordered and never filled with invented
 * numbers.
 *
 * This module is the pure model behind that: it maps the independent swarm
 * signals (which can arrive out of order) into an ORDERED timeline of stages,
 * each carrying its status + provenance + dependency gate, and exposes the four
 * named gates the UI uses. Same signals → same timeline (deterministic).
 *
 * PURE: no I/O, no Date.now(), no Math.random(). Imports the draft type only.
 */

import type { LiveProvenance, ProductConstructionDraft } from "./types";

// ---------------------------------------------------------------------------
// Types (PROMPT §1)
// ---------------------------------------------------------------------------

export type StageStatus =
  | "waiting"
  | "loading"
  | "ready"
  | "fallback"
  | "blocked"
  | "error";

export type StageProvenance =
  | "LIVE"
  | "ATTESTED"
  | "ESTIMATED"
  | "CONFIGURED"
  | "FALLBACK"
  | "UNKNOWN";

/** The ten visual blocks, in their MANDATED display order (PROMPT §2). */
export const STAGE_ORDER = [
  "btc-market",
  "hashprice",
  "btc-yield",
  "usdc-yield",
  "performance-engines",
  "allocation",
  "safe-scenario",
  "balanced-scenario",
  "opportunistic-scenario",
  "product-summary",
] as const;

export type StageId = (typeof STAGE_ORDER)[number];

export interface ProductConstructionStage {
  id: StageId;
  label: string;
  /** Position in the fixed visual order (0-based). */
  order: number;
  status: StageStatus;
  /** Ids this stage waits on before it can render. */
  dependsOn: StageId[];
  provenance: StageProvenance;
  warnings: string[];
}

export interface ProductConstructionTimeline {
  stages: ProductConstructionStage[];
}

const STAGE_LABEL: Record<StageId, string> = {
  "btc-market": "BTC market",
  hashprice: "Hashprice",
  "btc-yield": "BTC yield",
  "usdc-yield": "USDC yield",
  "performance-engines": "Performance engines",
  allocation: "Allocation",
  "safe-scenario": "Safe scenario",
  "balanced-scenario": "Balanced scenario",
  "opportunistic-scenario": "Opportunistic scenario",
  "product-summary": "Product summary",
};

const DEPENDS_ON: Record<StageId, StageId[]> = {
  "btc-market": [],
  hashprice: [],
  "btc-yield": [],
  "usdc-yield": [],
  "performance-engines": ["btc-market", "hashprice", "usdc-yield"],
  allocation: ["performance-engines"],
  "safe-scenario": ["allocation"],
  "balanced-scenario": ["safe-scenario"],
  "opportunistic-scenario": ["safe-scenario"],
  "product-summary": [
    "safe-scenario",
    "balanced-scenario",
    "opportunistic-scenario",
  ],
};

// ---------------------------------------------------------------------------
// Signals — one per independent swarm output (arrive in any order)
// ---------------------------------------------------------------------------

export interface SignalState {
  present: boolean;
  provenance: StageProvenance;
  warnings?: string[];
}

export interface ConstructionSignals {
  btcMarket: SignalState;
  hashprice: SignalState;
  btcYield: SignalState;
  usdcYield: SignalState;
  machineEconomics: SignalState;
  /** The 3-scenario engine + canonical allocation. */
  scenarioEngine: SignalState;
  writeup: SignalState;
}


function liveToStageProvenance(p: LiveProvenance | undefined): StageProvenance {
  switch (p) {
    case "Live":
    case "Oracle":
      return "LIVE";
    case "Attested":
      return "ATTESTED";
    case "Estimated":
      return "ESTIMATED";
    case "Manual":
      return "CONFIGURED";
    case "Stale":
      return "FALLBACK";
    default:
      return "UNKNOWN";
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Order of provenance "strength" — a derived stage inherits the WEAKEST dep. */
const PROVENANCE_RANK: Record<StageProvenance, number> = {
  LIVE: 5,
  ATTESTED: 4,
  ESTIMATED: 3,
  CONFIGURED: 2,
  FALLBACK: 1,
  UNKNOWN: 0,
};

function weakest(provs: StageProvenance[]): StageProvenance {
  if (provs.length === 0) return "UNKNOWN";
  return provs.reduce<StageProvenance>(
    (acc, p) => (PROVENANCE_RANK[p] < PROVENANCE_RANK[acc] ? p : acc),
    "LIVE",
  );
}

function leafStatus(s: SignalState): StageStatus {
  if (!s.present) return "waiting";
  return s.provenance === "FALLBACK" ? "fallback" : "ready";
}

const READY_STATES: ReadonlySet<StageStatus> = new Set<StageStatus>([
  "ready",
  "fallback",
]);

/**
 * Build the ordered timeline from the independent swarm signals. The output is
 * ALWAYS in STAGE_ORDER, regardless of which signals were supplied first — that
 * is the deterministic-render-order guarantee. A downstream stage whose
 * dependencies are not all ready/fallback stays `waiting` (gated), never
 * skipped, never reordered.
 */
export function buildConstructionTimeline(
  signals: ConstructionSignals,
): ProductConstructionTimeline {
  // Resolve leaf signals first.
  const leaf: Partial<Record<StageId, { status: StageStatus; provenance: StageProvenance; warnings: string[] }>> =
    {
      "btc-market": {
        status: leafStatus(signals.btcMarket),
        provenance: signals.btcMarket.provenance,
        warnings: signals.btcMarket.warnings ?? [],
      },
      hashprice: {
        status: leafStatus(signals.hashprice),
        provenance: signals.hashprice.provenance,
        warnings: signals.hashprice.warnings ?? [],
      },
      "btc-yield": {
        status: leafStatus(signals.btcYield),
        provenance: signals.btcYield.provenance,
        warnings: signals.btcYield.warnings ?? [],
      },
      "usdc-yield": {
        status: leafStatus(signals.usdcYield),
        provenance: signals.usdcYield.provenance,
        warnings: signals.usdcYield.warnings ?? [],
      },
    };

  // Resolved status per stage (built in dependency order, but emitted in
  // STAGE_ORDER below).
  const resolved: Partial<Record<StageId, ProductConstructionStage>> = {};

  function depStatuses(id: StageId): StageStatus[] {
    return DEPENDS_ON[id].map((d) => resolved[d]?.status ?? "waiting");
  }
  function depProvenances(id: StageId): StageProvenance[] {
    return DEPENDS_ON[id].map((d) => resolved[d]?.provenance ?? "UNKNOWN");
  }

  function makeStage(
    id: StageId,
    ownStatus: StageStatus,
    ownProvenance: StageProvenance,
    warnings: string[],
  ): ProductConstructionStage {
    const deps = DEPENDS_ON[id];
    const gateOpen = depStatuses(id).every((s) => READY_STATES.has(s));
    // Gated: deps not all ready → waiting (never render out of order).
    const status: StageStatus = !gateOpen ? "waiting" : ownStatus;
    const provenance =
      deps.length > 0 && gateOpen
        ? weakest([ownProvenance, ...depProvenances(id)])
        : ownProvenance;
    return {
      id,
      label: STAGE_LABEL[id],
      order: STAGE_ORDER.indexOf(id),
      status,
      dependsOn: [...deps],
      provenance,
      warnings,
    };
  }

  // 1. Leaves.
  for (const id of ["btc-market", "hashprice", "btc-yield", "usdc-yield"] as const) {
    const l = leaf[id]!;
    resolved[id] = makeStage(id, l.status, l.provenance, l.warnings);
  }

  // 2. Performance engines — needs btc-market + hashprice + usdc-yield gate AND
  //    machine economics present for its own readiness.
  {
    const own: StageStatus = signals.machineEconomics.present
      ? signals.machineEconomics.provenance === "FALLBACK"
        ? "fallback"
        : "ready"
      : "loading";
    resolved["performance-engines"] = makeStage(
      "performance-engines",
      own,
      signals.machineEconomics.provenance,
      signals.machineEconomics.warnings ?? [],
    );
  }

  // 3. Allocation — needs performance engines + the scenario engine (canonical
  //    allocation derives from the balanced scenario).
  {
    const own: StageStatus = signals.scenarioEngine.present
      ? signals.scenarioEngine.provenance === "FALLBACK"
        ? "fallback"
        : "ready"
      : "loading";
    resolved["allocation"] = makeStage(
      "allocation",
      own,
      signals.scenarioEngine.provenance,
      signals.scenarioEngine.warnings ?? [],
    );
  }

  // 4. Scenarios — all three gate on allocation + the scenario engine.
  for (const id of [
    "safe-scenario",
    "balanced-scenario",
    "opportunistic-scenario",
  ] as const) {
    const own: StageStatus = signals.scenarioEngine.present
      ? signals.scenarioEngine.provenance === "FALLBACK"
        ? "fallback"
        : "ready"
      : "loading";
    resolved[id] = makeStage(id, own, signals.scenarioEngine.provenance, []);
  }

  // 5. Product summary — gates on the three scenarios + needs the write-up.
  {
    const own: StageStatus = signals.writeup.present
      ? signals.writeup.provenance === "FALLBACK"
        ? "fallback"
        : "ready"
      : "loading";
    resolved["product-summary"] = makeStage(
      "product-summary",
      own,
      signals.writeup.provenance,
      signals.writeup.warnings ?? [],
    );
  }

  // Emit ALWAYS in the fixed order.
  return { stages: STAGE_ORDER.map((id) => resolved[id]!) };
}

// ---------------------------------------------------------------------------
// Dependency gates (PROMPT §13)
// ---------------------------------------------------------------------------

export function stageById(
  t: ProductConstructionTimeline,
  id: StageId,
): ProductConstructionStage | undefined {
  return t.stages.find((s) => s.id === id);
}

function isReady(t: ProductConstructionTimeline, id: StageId): boolean {
  const s = stageById(t, id);
  return s !== undefined && READY_STATES.has(s.status);
}

export function canRenderPerformanceEngines(
  t: ProductConstructionTimeline,
): boolean {
  return (
    isReady(t, "btc-market") &&
    isReady(t, "hashprice") &&
    isReady(t, "usdc-yield") &&
    isReady(t, "performance-engines")
  );
}

export function canRenderAllocation(t: ProductConstructionTimeline): boolean {
  return canRenderPerformanceEngines(t) && isReady(t, "allocation");
}

export function canRenderSafeScenario(t: ProductConstructionTimeline): boolean {
  return canRenderAllocation(t) && isReady(t, "safe-scenario");
}

export function canRenderProductSummary(
  t: ProductConstructionTimeline,
): boolean {
  return (
    canRenderSafeScenario(t) &&
    isReady(t, "balanced-scenario") &&
    isReady(t, "opportunistic-scenario") &&
    isReady(t, "product-summary")
  );
}

// ---------------------------------------------------------------------------
// Draft → signals
// ---------------------------------------------------------------------------

/**
 * Map a finished construction draft to the swarm signals. Deterministic: a
 * present-with-data input is ready (provenance from the artifact), a degraded
 * one is FALLBACK, an absent one is waiting.
 */
export function deriveSignalsFromDraft(
  draft: ProductConstructionDraft,
): ConstructionSignals {
  const btcOk = draft.market.btcUsd > 0;
  const hashOk = draft.market.hashpriceUsdPerThDay > 0;
  const usdcOk = draft.strategy.usdcYieldPct > 0;
  const machineOk = draft.telegram.machineCount > 0;
  const scenariosOk =
    Array.isArray(draft.scenarios) && draft.scenarios.length > 0;

  return {
    btcMarket: {
      present: btcOk,
      provenance: btcOk ? "LIVE" : "FALLBACK",
    },
    hashprice: {
      present: hashOk,
      provenance: hashOk ? "LIVE" : "FALLBACK",
    },
    // BTC yield is optional (excess liquidity only) — CONFIGURED, present so the
    // block renders its honest "optional" state rather than blocking the gate.
    btcYield: { present: true, provenance: "CONFIGURED" },
    usdcYield: {
      present: usdcOk,
      provenance: liveToStageProvenance(draft.strategy.provenance),
    },
    machineEconomics: {
      present: machineOk || hashOk,
      provenance: machineOk ? "ATTESTED" : hashOk ? "LIVE" : "FALLBACK",
    },
    scenarioEngine: {
      present: scenariosOk,
      provenance: liveToStageProvenance(draft.quant.provenance),
    },
    writeup: {
      present: draft.writeup.prose.length > 0,
      provenance: draft.writeup.llmAuthored ? "ESTIMATED" : "CONFIGURED",
    },
  };
}

/** Build the timeline straight from a draft. */
export function buildTimelineFromDraft(
  draft: ProductConstructionDraft,
): ProductConstructionTimeline {
  return buildConstructionTimeline(deriveSignalsFromDraft(draft));
}
