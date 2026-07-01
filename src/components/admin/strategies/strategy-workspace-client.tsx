"use client";

/**
 * StrategyWorkspaceClient — the Strategy Studio page body.
 *
 * Section order (calm → deep):
 *   1. Strategy Studio    — scenario switch + sliders + live outcome (hero).
 *      Actions (Archive / Publish / Save) live in this section's header.
 *   2. Scenario Comparison — the three scenarios side by side (tap to switch).
 *   3. Engine Configuration — collateral geometry + rebalancing rules,
 *      read-only reference that seeds the Data Lab.
 *   4. Data Lab            — one gate (the lab's own collapsed summary card),
 *      heavy runners only execute once opened.
 */

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { Metric } from "@/components/catalyst/metric";
import type {
  ProductStrategy,
  RiskProfileKey,
  ScenarioAllocation,
  ScenarioAssumptions,
} from "@/lib/product-strategies";
import { bpsToPct } from "@/lib/product-strategies";
import { useStrategyStore } from "@/components/admin/strategies/use-strategy-store";
import { PoolAllocationHero } from "@/components/admin/strategies/pool-allocation-hero";
import { ScenarioComparisonCards } from "@/components/admin/strategies/scenario-comparison-cards";
import { StrategyDataLab } from "@/components/admin/strategies/data-lab/strategy-data-lab";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { saveStrategyWorkspace, archiveStrategy, publishStrategy } from "@/app/admin/strategies/actions";
import type { StrategyWorkspaceData } from "@/app/admin/strategies/queries";

type SleeveKey = keyof ScenarioAllocation;

const ALLOCATION_KEYS: readonly SleeveKey[] = [
  "miningBps",
  "btcBps",
  "stableReserveBps",
  "yieldOverlayBps",
];

const DATA_LAB_SECTION_ID = "strategy-data-lab";

const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  draft: "Draft",
  archived: "Archived",
};

function scrollToSection(id: string): void {
  if (typeof document === "undefined") return;
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pctToBps(percent: number): number {
  return Math.round(percent * 100);
}

function rebalanceAllocation(
  allocation: ScenarioAllocation,
  changedKey: SleeveKey,
  nextBps: number,
): ScenarioAllocation {
  const target = clamp(Math.round(nextBps), 0, 10_000);
  const next: ScenarioAllocation = { ...allocation, [changedKey]: target };
  const remaining = 10_000 - target;
  const otherKeys = ALLOCATION_KEYS.filter((key) => key !== changedKey);
  const othersTotal = otherKeys.reduce((sum, key) => sum + allocation[key], 0);

  if (otherKeys.length === 0) return next;

  if (remaining <= 0) {
    otherKeys.forEach((key) => {
      next[key] = 0;
    });
    return next;
  }

  if (othersTotal <= 0) {
    const even = Math.floor(remaining / otherKeys.length);
    let leftover = remaining - even * otherKeys.length;
    otherKeys.forEach((key) => {
      next[key] = even + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover -= 1;
    });
    return next;
  }

  const distributed = otherKeys.map((key) => {
    const raw = (remaining * allocation[key]) / othersTotal;
    return {
      key,
      value: Math.max(0, Math.floor(raw)),
      remainder: raw - Math.floor(raw),
    };
  });

  let assigned = distributed.reduce((sum, item) => sum + item.value, 0);
  const ordered = [...distributed].sort((a, b) => b.remainder - a.remainder);
  let cursor = 0;

  while (assigned < remaining && ordered.length > 0) {
    ordered[cursor % ordered.length]!.value += 1;
    assigned += 1;
    cursor += 1;
  }

  distributed.forEach((item) => {
    next[item.key] = item.value;
  });

  return next;
}

function buildLiveAssumptions(
  allocation: ScenarioAllocation,
  previous: ScenarioAssumptions,
): ScenarioAssumptions {
  const mining = bpsToPct(allocation.miningBps);
  const btc = bpsToPct(allocation.btcBps);
  const stable = bpsToPct(allocation.stableReserveBps);
  const yieldOverlay = bpsToPct(allocation.yieldOverlayBps);

  const growthMix = mining + btc;
  const protectionMix = stable + yieldOverlay;

  const distributionMid =
    2.2 + mining * 0.04 + btc * 0.008 + stable * 0.05 + yieldOverlay * 0.075;
  const distributionSpread =
    1.1 +
    Math.max(0, btc - 15) * 0.015 +
    Math.max(0, growthMix - protectionMix) * 0.01;

  const performanceMid =
    4.0 + mining * 0.1 + btc * 0.16 + stable * 0.025 + yieldOverlay * 0.085;
  const performanceSpread =
    2.4 +
    btc * 0.05 +
    Math.max(0, growthMix - protectionMix) * 0.015 +
    previous.volatilityMultiplier * 0.6;

  const floorPct = 3.0 + stable * 0.05 + yieldOverlay * 0.03 + mining * 0.01;
  const volMultiplier = clamp(
    0.8 + growthMix * 0.008 + btc * 0.004 - stable * 0.002,
    0.75,
    1.35,
  );
  const btcAnnualVol = clamp(0.42 + btc * 0.008 + mining * 0.004, 0.35, 0.95);

  return {
    ...previous,
    btcAnnualVol: Number(btcAnnualVol.toFixed(2)),
    volatilityMultiplier: Number(volMultiplier.toFixed(2)),
    distributionTargetLowBps: Math.max(
      100,
      Math.round((distributionMid - distributionSpread / 2) * 100),
    ),
    distributionTargetHighBps: Math.max(
      200,
      Math.round((distributionMid + distributionSpread / 2) * 100),
    ),
    totalPerformanceLowBps: Math.max(
      300,
      Math.round((performanceMid - performanceSpread / 2) * 100),
    ),
    totalPerformanceHighBps: Math.max(
      500,
      Math.round((performanceMid + performanceSpread / 2) * 100),
    ),
    floorBps: Math.max(100, Math.round(floorPct * 100)),
  };
}

export function StrategyWorkspaceClient({
  initialWorkspace,
  allInitialStrategies,
}: {
  initialWorkspace: StrategyWorkspaceData;
  allInitialStrategies: ProductStrategy[];
}) {
  const searchParams = useSearchParams();
  const wantLab = searchParams?.get("tab") === "lab";
  const store = useStrategyStore(allInitialStrategies);

  const initialStrategy = initialWorkspace.strategy;

  // Initialize selection if needed
  useEffect(() => {
    if (store.selectedId !== initialStrategy.id) {
      store.select(initialStrategy.id);
    }
  }, [initialStrategy.id, store]);

  // Deep-link: `?tab=lab` scrolls to the (already open) Data Lab once on mount.
  useEffect(() => {
    if (!wantLab) return;
    scrollToSection(DATA_LAB_SECTION_ID);
  }, [wantLab]);

  const strategy = store.strategies.find((s) => s.id === initialStrategy.id) ?? initialStrategy;

  const [activeScenario, setActiveScenario] = useState<RiskProfileKey>(
    strategy.defaultRiskProfile,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutating, setMutating] = useState(false);

  const now = useCallback(() => new Date().toISOString(), []);

  const handleAllocationChange = useCallback(
    (sleeve: SleeveKey, nextPercent: number) => {
      const currentScenario = strategy.scenarios[activeScenario];
      const nextAllocation = rebalanceAllocation(
        currentScenario.allocation,
        sleeve,
        pctToBps(Number.isFinite(nextPercent) ? nextPercent : 0),
      );
      const nextAssumptions = buildLiveAssumptions(
        nextAllocation,
        currentScenario.assumptions,
      );

      store.update(strategy.id, {
        scenarios: {
          ...strategy.scenarios,
          [activeScenario]: {
            ...currentScenario,
            allocation: nextAllocation,
            assumptions: nextAssumptions,
          },
        },
        updatedAt: now(),
      });
      setDirty(true);
    },
    [activeScenario, now, strategy, store],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveStrategyWorkspace(strategy, initialWorkspace.collateral, initialWorkspace.rules);
      setDirty(false);
    } catch {
      // Save rejected — keep `dirty` truthful ("Unsaved changes" stays up).
    } finally {
      setSaving(false);
    }
  }, [strategy, initialWorkspace.collateral, initialWorkspace.rules]);

  // Publish/Archive mirror the server mutation into the local store so the
  // header status stays truthful (the store seeds useState once — a
  // revalidate alone would not refresh it). On failure, nothing changes.
  const handleMakeLive = useCallback(async () => {
    setMutating(true);
    try {
      await publishStrategy(strategy.id);
      store.publish(strategy.id);
    } catch {
      // Server rejected (e.g. static fallback strategy not in DB) — keep the
      // local state honest by not flipping the status.
    } finally {
      setMutating(false);
    }
  }, [strategy.id, store]);

  const handleArchive = useCallback(async () => {
    setMutating(true);
    try {
      await archiveStrategy(strategy.id);
      store.archive(strategy.id);
    } catch {
      // Same contract as publish: no local flip on server failure.
    } finally {
      setMutating(false);
    }
  }, [strategy.id, store]);

  const statusLabel = STATUS_LABEL[strategy.status] ?? strategy.status;

  return (
    <div className="flex flex-col gap-(--ct-space-5) min-w-0">
      <AdminSectionCard
        title="Strategy Studio"
        subtitle={`${strategy.name} · ${statusLabel} — adjust the active scenario live`}
        headerTrailing={
          <div className="flex flex-wrap items-center justify-end gap-(--ct-space-2)">
            {dirty ? (
              <span className="text-[length:var(--ct-text-2xs)] ct-text-tertiary">
                Unsaved changes
              </span>
            ) : null}
            <CockpitButton
              variant="ghost"
              size="sm"
              onClick={handleArchive}
              disabled={mutating || strategy.status === "archived"}
            >
              Archive
            </CockpitButton>
            {strategy.status === "draft" && (
              <CockpitButton
                variant="secondary"
                size="sm"
                onClick={handleMakeLive}
                disabled={mutating}
              >
                Publish
              </CockpitButton>
            )}
            <CockpitButton
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </CockpitButton>
          </div>
        }
      >
        <div className="p-5 lg:p-6">
          <PoolAllocationHero
            strategy={strategy}
            activeScenario={activeScenario}
            onScenarioChange={setActiveScenario}
            onAllocationChange={handleAllocationChange}
          />
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title="Scenario Comparison"
        subtitle="Safe / Balanced / Opportunistic side by side — tap a tile to switch the Studio"
      >
        <div className="p-5 lg:p-6">
          <ScenarioComparisonCards
            strategy={strategy}
            activeScenario={activeScenario}
            onScenarioChange={setActiveScenario}
          />
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title="Engine Configuration"
        subtitle="Collateral geometry & rebalancing rules — read-only, seeds the Data Lab runs"
      >
        <div className="@container min-w-0 p-5 lg:p-6">
          <div className="grid min-w-0 gap-(--ct-space-5) @[52rem]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex min-w-0 flex-col gap-(--ct-space-3)">
            <span className="ct-bento-label">Collateral</span>
            <div className="grid grid-cols-2 gap-(--ct-space-3)">
              <Metric
                variant="nested"
                label="Initial BTC Collateral"
                value={`${initialWorkspace.collateral.initialBtcCollateral} BTC`}
              />
              <Metric
                variant="nested"
                label="Initial Debt"
                value={`$${initialWorkspace.collateral.initialDebtUsdc.toLocaleString("en-US")}`}
              />
              <Metric
                variant="nested"
                label="Liquidation LTV"
                value={
                  <span className="ct-status-danger tabular-nums">
                    {(initialWorkspace.collateral.liquidationLtvBps / 100).toFixed(1)}%
                  </span>
                }
              />
              <Metric
                variant="nested"
                label="Target Risk LTV"
                value={
                  <span className="ct-text-accent tabular-nums">
                    {(initialWorkspace.collateral.targetRiskLtvBps / 100).toFixed(1)}%
                  </span>
                }
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-(--ct-space-3)">
            <span className="ct-bento-label">Rebalancing rules</span>
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
                    <th className="p-(--ct-space-2) text-left">Type</th>
                    <th className="p-(--ct-space-2) text-left">Trigger</th>
                    <th className="p-(--ct-space-2) text-left">Action</th>
                    <th className="p-(--ct-space-2) text-right">Cooldown</th>
                  </tr>
                </thead>
                <tbody>
                  {initialWorkspace.rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-[var(--ct-border-soft)]">
                      <td className="p-(--ct-space-2) ct-text-strong">{rule.type}</td>
                      <td className="p-(--ct-space-2) ct-text-body">{rule.triggerMetric} {rule.operator} {rule.value}</td>
                      <td className="p-(--ct-space-2) ct-text-body">{rule.action.side} ({rule.action.sizingMode})</td>
                      <td className="p-(--ct-space-2) text-right ct-text-tertiary">{rule.cooldownMonths ?? 0}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      </AdminSectionCard>

      <div id={DATA_LAB_SECTION_ID} className="scroll-mt-24">
        <AdminSectionCard
          title="Data Lab"
          subtitle="Backtest · Forward simulation · Stress · Sensitivity · Triggers — seeded, modelled"
        >
          <div className="p-5 lg:p-6">
            <StrategyDataLab
              strategy={strategy}
              scenario={activeScenario}
              collateral={initialWorkspace.collateral}
              rules={initialWorkspace.rules}
              initialOpen={wantLab}
            />
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
}
