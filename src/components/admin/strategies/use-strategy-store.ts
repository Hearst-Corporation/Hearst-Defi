"use client";

/**
 * useStrategyStore — client-side local CRUD store for the Strategy Hub.
 *
 * LOCAL / IN-MEMORY ONLY. No DB, no fetch, no server action. State lives
 * in React useState and is lost on page reload. The `persistencePending`
 * constant signals to the UI that this draft has not been persisted yet.
 *
 * This module intentionally:
 *  - Accepts timestamps as args (no Date.now() / new Date() calls inside)
 *  - Derives ids deterministically from slugs + a counter seed
 *  - Defends against Fast Refresh counter resets by uniquifying draft ids/slugs
 *  - Uses no Math.random()
 *  - Emits no forbidden words (guarantee/promise/certain/will deliver/risk-free)
 */

import { useState } from "react";
import type {
  ProductFamily,
  ProductStrategy,
  ProductStrategyScenario,
  Priority,
  RiskProfileKey,
  ScenarioAllocation,
  StrategyStatus,
} from "@/lib/product-strategies";

// ---------------------------------------------------------------------------
// Surface signal — the UI should display "Local draft — persistence pending"
// wherever it shows unsaved drafts.
// ---------------------------------------------------------------------------

export const persistencePending = true as const;

// ---------------------------------------------------------------------------
// Counter — purely module-level, deterministic across the session.
// HMR can reset it, so store-level create/duplicate also de-dupe ids defensively.
// ---------------------------------------------------------------------------

let _draftCounter = 0;

function nextDraftCounter(): number {
  _draftCounter += 1;
  return _draftCounter;
}

// ---------------------------------------------------------------------------
// Slug helper — lower-kebab from a name, strip non-alphanum.
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function makeDraftId(slug: string): string {
  return `draft-${slug}`;
}

/**
 * Fast Refresh can preserve the surrounding React tree while resetting this
 * module's `_draftCounter`. When that happens, the next generated draft id may
 * collide with an already-mounted strategy. Normalize the incoming draft to a
 * unique id/slug pair against the current store snapshot.
 */
export function ensureUniqueDraftIdentity(
  draft: ProductStrategy,
  existing: readonly ProductStrategy[],
): ProductStrategy {
  const existingIds = new Set(existing.map((strategy) => strategy.id));
  const existingSlugs = new Set(existing.map((strategy) => strategy.slug));

  if (!existingIds.has(draft.id) && !existingSlugs.has(draft.slug)) {
    return draft;
  }

  const baseSlug = draft.slug;
  let suffix = 2;
  let nextSlug = `${baseSlug}-${suffix}`;
  let nextId = makeDraftId(nextSlug);

  while (existingIds.has(nextId) || existingSlugs.has(nextSlug)) {
    suffix += 1;
    nextSlug = `${baseSlug}-${suffix}`;
    nextId = makeDraftId(nextSlug);
  }

  return {
    ...draft,
    id: nextId,
    slug: nextSlug,
  };
}

// ---------------------------------------------------------------------------
// Scenario builder helpers
// All scenarios must satisfy validateStrategy:
//   1. allocations sum to 10_000
//   2. safe.stableReserveBps >= balanced.stableReserveBps
//   3. opp.btcBps >= balanced.btcBps
//   4. effective vol non-decreasing safe → balanced → opp
// ---------------------------------------------------------------------------

function buildSafeAllocation(): ScenarioAllocation {
  return { miningBps: 2000, btcBps: 1000, stableReserveBps: 3500, yieldOverlayBps: 3500 };
}

function buildBalancedAllocation(): ScenarioAllocation {
  return { miningBps: 2500, btcBps: 2000, stableReserveBps: 2500, yieldOverlayBps: 3000 };
}

function buildOpportunisticAllocation(): ScenarioAllocation {
  return { miningBps: 2500, btcBps: 3000, stableReserveBps: 1500, yieldOverlayBps: 3000 };
}

function buildSafeScenario(horizonMonths: ProductStrategy["defaultHorizonMonths"]): ProductStrategyScenario {
  return {
    label: "Safe",
    allocation: buildSafeAllocation(),
    assumptions: {
      horizonMonths,
      btcAnnualVol: 0.6,
      volatilityMultiplier: 0.9,
      distributionTargetLowBps: 600,
      distributionTargetHighBps: 900,
      totalPerformanceLowBps: 700,
      totalPerformanceHighBps: 1000,
      floorBps: 600,
    },
    constraints: { minStableReserveBps: 3000 },
    narrativeBullets: [
      "Largest stable reserve — capital-protection focused.",
      "Lower BTC exposure to dampen drawdown risk.",
      "Modelled projection, conditional on stated assumptions, not guaranteed.",
    ],
  };
}

function buildBalancedScenario(horizonMonths: ProductStrategy["defaultHorizonMonths"]): ProductStrategyScenario {
  return {
    label: "Balanced",
    allocation: buildBalancedAllocation(),
    assumptions: {
      horizonMonths,
      btcAnnualVol: 0.6,
      volatilityMultiplier: 1.0,
      distributionTargetLowBps: 700,
      distributionTargetHighBps: 1100,
      totalPerformanceLowBps: 900,
      totalPerformanceHighBps: 1400,
      floorBps: 600,
    },
    constraints: {},
    narrativeBullets: [
      "Balanced blend — the modelled default.",
      "Yield overlay supports the monthly distribution target.",
      "Modelled projection, conditional on stated assumptions, not guaranteed.",
    ],
  };
}

function buildOpportunisticScenario(horizonMonths: ProductStrategy["defaultHorizonMonths"]): ProductStrategyScenario {
  return {
    label: "Opportunistic",
    allocation: buildOpportunisticAllocation(),
    assumptions: {
      horizonMonths,
      btcAnnualVol: 0.6,
      volatilityMultiplier: 1.15,
      distributionTargetLowBps: 700,
      distributionTargetHighBps: 1200,
      totalPerformanceLowBps: 1000,
      totalPerformanceHighBps: 1800,
      floorBps: 600,
    },
    constraints: { maxYieldOverlayBps: 4000 },
    narrativeBullets: [
      "Higher BTC sleeve for broader participation.",
      "Smaller stable reserve — wider dispersion in adverse regimes.",
      "Modelled projection, conditional on stated assumptions, not guaranteed.",
    ],
  };
}

// ---------------------------------------------------------------------------
// newStrategyDraft
// ---------------------------------------------------------------------------

const DEFAULT_NOW = "2026-07-01T00:00:00.000Z";

/**
 * Build a valid draft ProductStrategy with intelligent defaults.
 *
 * Rules satisfied:
 *  - allocations sum to 10_000 per scenario
 *  - safe.stableReserveBps (3500) >= balanced.stableReserveBps (2500)
 *  - opp.btcBps (3000) >= balanced.btcBps (2000)
 *  - effective vol non-decreasing: 0.54 / 0.60 / 0.69
 *  - no forbidden words
 *  - minConfidence in [0,1]
 *  - status "draft", isFallback false
 *
 * @param seed Partial overrides — applied after defaults, before id/slug derivation.
 * @param now  ISO timestamp string. Never calls Date.now() or new Date() internally.
 */
export function newStrategyDraft(
  seed: Partial<ProductStrategy> = {},
  now: string = DEFAULT_NOW,
): ProductStrategy {
  const counter = nextDraftCounter();

  const name = seed.name ?? `Draft Strategy ${counter}`;
  const family: ProductFamily = seed.productFamily ?? "generic";
  const risk: RiskProfileKey = seed.defaultRiskProfile ?? "balanced";
  const horizon = seed.defaultHorizonMonths ?? 24;
  const priority: Priority = seed.defaultPriority ?? "total_return";
  const slug = seed.slug ?? toSlug(name);
  const id = seed.id ?? `draft-${slug}-${counter}`;

  const draft: ProductStrategy = {
    id,
    slug,
    name,
    description: seed.description ?? `Draft strategy — ${name}. Subject to review before activation.`,
    status: "draft" as StrategyStatus,
    productFamily: family,
    defaultRiskProfile: risk,
    defaultHorizonMonths: horizon,
    defaultPriority: priority,
    selectionRules: seed.selectionRules ?? {
      keywords: [],
      productFamilies: [family],
      riskProfiles: ["safe", "balanced", "opportunistic"],
      priorities: [priority],
      minConfidence: 0.5,
    },
    scenarios: seed.scenarios ?? {
      safe: buildSafeScenario(horizon),
      balanced: buildBalancedScenario(horizon),
      opportunistic: buildOpportunisticScenario(horizon),
    },
    disclaimers: seed.disclaimers ?? [
      "Projections are conditional on the stated assumptions and are not guaranteed.",
      "This draft has not been reviewed or activated.",
    ],
    isFallback: false,
    createdAt: now,
    updatedAt: now,
    // Apply remaining overrides last (but never allow isFallback:true from seed)
    ...Object.fromEntries(
      Object.entries(seed).filter(
        ([k]) =>
          ![
            "id",
            "slug",
            "name",
            "status",
            "isFallback",
            "createdAt",
            "updatedAt",
          ].includes(k),
      ),
    ),
  };

  return draft;
}

// ---------------------------------------------------------------------------
// strategyToProductPayload
// ---------------------------------------------------------------------------

/**
 * Build a concise, URL-safe objective string for handoff to
 * /admin/product-workspace?objective=…
 *
 * - ≤ 200 characters
 * - No forbidden words: guarantee/promise/certain/risk-free/will deliver
 * - Summarises family, risk, horizon, priority, and the active scenario allocation
 */
export function strategyToProductPayload(
  strategy: ProductStrategy,
  scenario: RiskProfileKey,
): { objective: string } {
  const sc = strategy.scenarios[scenario];
  const alloc = sc.allocation;
  // Format as e.g. "Mining 25% / BTC 20% / Stable 25% / Yield 30%"
  const allocStr = [
    `Mining ${(alloc.miningBps / 100).toFixed(0)}%`,
    `BTC ${(alloc.btcBps / 100).toFixed(0)}%`,
    `Stable ${(alloc.stableReserveBps / 100).toFixed(0)}%`,
    `Yield ${(alloc.yieldOverlayBps / 100).toFixed(0)}%`,
  ].join(" / ");

  const raw = `${strategy.productFamily} | ${scenario} | ${strategy.defaultHorizonMonths}mo | ${strategy.defaultPriority} | ${allocStr}`;
  // Clamp to 200 chars
  const objective = raw.length <= 200 ? raw : raw.slice(0, 197) + "...";

  return { objective };
}

// ---------------------------------------------------------------------------
// Deep clone helper — no structuredClone for broader compat, explicit spread.
// ---------------------------------------------------------------------------

function cloneStrategy(s: ProductStrategy): ProductStrategy {
  return {
    ...s,
    selectionRules: { ...s.selectionRules, keywords: [...s.selectionRules.keywords], productFamilies: [...s.selectionRules.productFamilies], riskProfiles: [...s.selectionRules.riskProfiles], priorities: [...s.selectionRules.priorities] },
    scenarios: {
      safe: { ...s.scenarios.safe, allocation: { ...s.scenarios.safe.allocation }, assumptions: { ...s.scenarios.safe.assumptions }, constraints: { ...s.scenarios.safe.constraints }, narrativeBullets: [...s.scenarios.safe.narrativeBullets] },
      balanced: { ...s.scenarios.balanced, allocation: { ...s.scenarios.balanced.allocation }, assumptions: { ...s.scenarios.balanced.assumptions }, constraints: { ...s.scenarios.balanced.constraints }, narrativeBullets: [...s.scenarios.balanced.narrativeBullets] },
      opportunistic: { ...s.scenarios.opportunistic, allocation: { ...s.scenarios.opportunistic.allocation }, assumptions: { ...s.scenarios.opportunistic.assumptions }, constraints: { ...s.scenarios.opportunistic.constraints }, narrativeBullets: [...s.scenarios.opportunistic.narrativeBullets] },
    },
    disclaimers: [...s.disclaimers],
  };
}

// ---------------------------------------------------------------------------
// useStrategyStore
// ---------------------------------------------------------------------------

export interface StrategyStore {
  /** Current list of strategies (immutable reference). */
  strategies: ProductStrategy[];
  /** Id of the currently selected strategy, or null. */
  selectedId: string | null;
  /** Select a strategy by id. Pass null to deselect. */
  select: (id: string | null) => void;
  /** Add a new draft strategy. Returns the created strategy. */
  create: (draft: ProductStrategy) => ProductStrategy;
  /** Patch an existing strategy by id (shallow merge at top level). */
  update: (id: string, patch: Partial<Omit<ProductStrategy, "id" | "createdAt">>) => void;
  /** Deep-clone a strategy with a new id/slug/name ("… (copy)"), status = draft. */
  duplicate: (id: string, now?: string) => ProductStrategy | null;
  /** Set status = "archived". */
  archive: (id: string) => void;
  /** Set status = "active". */
  publish: (id: string) => void;
  /** Set status = "draft". */
  unpublish: (id: string) => void;
}

/**
 * useStrategyStore — pure useState-based local CRUD for the Strategy Hub.
 *
 * LOCAL / IN-MEMORY — state is NOT persisted to the DB. `persistencePending`
 * is exported as `true` so the UI can surface a "Local draft" badge.
 *
 * @param initial Seed strategies (typically PRODUCT_STRATEGIES from the config).
 */
export function useStrategyStore(initial: ProductStrategy[]): StrategyStore {
  const [strategies, setStrategies] = useState<ProductStrategy[]>(() =>
    initial.map(cloneStrategy),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function select(id: string | null): void {
    setSelectedId(id);
  }

  function create(draft: ProductStrategy): ProductStrategy {
    const copy = ensureUniqueDraftIdentity(cloneStrategy(draft), strategies);
    setStrategies((prev) => [...prev, copy]);
    return copy;
  }

  function update(
    id: string,
    patch: Partial<Omit<ProductStrategy, "id" | "createdAt">>,
  ): void {
    setStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  function duplicate(id: string, now: string = DEFAULT_NOW): ProductStrategy | null {
    const source = strategies.find((s) => s.id === id);
    if (!source) return null;

    const counter = nextDraftCounter();
    const newName = `${source.name} (copy)`;
    const newSlug = `${toSlug(newName)}-${counter}`;
    const newId = `draft-${newSlug}`;

    const copy: ProductStrategy = {
      ...cloneStrategy(source),
      id: newId,
      slug: newSlug,
      name: newName,
      status: "draft",
      isFallback: false,
      createdAt: now,
      updatedAt: now,
    };

    const uniqueCopy = ensureUniqueDraftIdentity(copy, strategies);
    setStrategies((prev) => [...prev, uniqueCopy]);
    return uniqueCopy;
  }

  function archive(id: string): void {
    update(id, { status: "archived" });
  }

  function publish(id: string): void {
    update(id, { status: "active" });
  }

  function unpublish(id: string): void {
    update(id, { status: "draft" });
  }

  return {
    strategies,
    selectedId,
    select,
    create,
    update,
    duplicate,
    archive,
    publish,
    unpublish,
  };
}
