"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import type {
  ProductStrategy,
  RiskProfileKey,
  ScenarioAllocation,
  ScenarioAssumptions,
} from "@/lib/product-strategies";
import { bpsToPct } from "@/lib/product-strategies";
import {
  useStrategyStore,
  persistencePending,
  strategyToProductPayload,
} from "@/components/admin/strategies/use-strategy-store";
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
  const router = useRouter();
  const store = useStrategyStore(allInitialStrategies);

  const initialStrategy = initialWorkspace.strategy;

  // Initialize selection if needed
  useEffect(() => {
    if (store.selectedId !== initialStrategy.id) {
      store.select(initialStrategy.id);
    }
  }, [initialStrategy.id, store]);

  const strategy = store.strategies.find((s) => s.id === initialStrategy.id) ?? initialStrategy;

  const [activeScenario, setActiveScenario] = useState<RiskProfileKey>(
    strategy.defaultRiskProfile,
  );

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
    },
    [activeScenario, now, strategy, store],
  );

  const handleOpenDataLab = useCallback(() => {
    scrollToSection(DATA_LAB_SECTION_ID);
  }, []);

  const handleSave = useCallback(async () => {
    await saveStrategyWorkspace(strategy, initialWorkspace.collateral, initialWorkspace.rules);
  }, [strategy, initialWorkspace.collateral, initialWorkspace.rules]);

  const handleMakeLive = useCallback(async () => {
    await publishStrategy(strategy.id);
  }, [strategy.id]);

  const handleArchive = useCallback(async () => {
    await archiveStrategy(strategy.id);
  }, [strategy.id]);

  return (
    <div className="flex flex-col gap-(--ct-space-5) min-w-0">
      <div className="flex items-center justify-end gap-(--ct-space-2)">
        <CockpitButton variant="secondary" size="sm" onClick={handleArchive}>Archive</CockpitButton>
        {strategy.status === "draft" && (
          <CockpitButton variant="primary" size="sm" onClick={handleMakeLive}>Publish</CockpitButton>
        )}
        <CockpitButton variant="primary" size="sm" onClick={handleSave}>Save Changes</CockpitButton>
      </div>

      <AdminSectionCard
        title="Strategy Studio"
        subtitle={`Editing ${strategy.name}`}
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

      <AdminSectionCard title="Scenario Summary" subtitle="Outcome & constraints">
        <div className="p-5 lg:p-6">
          <ScenarioComparisonCards
            strategy={strategy}
            activeScenario={activeScenario}
            onScenarioChange={setActiveScenario}
          />
        </div>
      </AdminSectionCard>

      <AdminSectionCard title="Collateral Engine" subtitle="Initial pool geometry & risk limits">
        <div className="p-5 lg:p-6 flex flex-col gap-(--ct-space-4)">
          <div className="grid grid-cols-2 gap-(--ct-space-3) sm:grid-cols-4">
            <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] p-(--ct-space-3)">
              <span className="text-[length:var(--ct-text-2xs)] ct-text-faint uppercase tracking-wide">Initial BTC Collateral</span>
              <span className="text-[length:var(--ct-text-sm)] tabular-nums ct-text-body">{initialWorkspace.collateral.initialBtcCollateral} BTC</span>
            </div>
            <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] p-(--ct-space-3)">
              <span className="text-[length:var(--ct-text-2xs)] ct-text-faint uppercase tracking-wide">Initial Debt</span>
              <span className="text-[length:var(--ct-text-sm)] tabular-nums ct-text-body">${initialWorkspace.collateral.initialDebtUsdc.toLocaleString()}</span>
            </div>
            <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] p-(--ct-space-3)">
              <span className="text-[length:var(--ct-text-2xs)] ct-text-faint uppercase tracking-wide">Liquidation LTV</span>
              <span className="text-[length:var(--ct-text-sm)] tabular-nums text-[var(--ct-status-danger)]">{(initialWorkspace.collateral.liquidationLtvBps / 100).toFixed(1)}%</span>
            </div>
            <div className="flex flex-col gap-(--ct-space-1) rounded-(--ct-radius-md) border border-[var(--ct-border-soft)] p-(--ct-space-3)">
              <span className="text-[length:var(--ct-text-2xs)] ct-text-faint uppercase tracking-wide">Target Risk LTV</span>
              <span className="text-[length:var(--ct-text-sm)] tabular-nums ct-text-accent">{(initialWorkspace.collateral.targetRiskLtvBps / 100).toFixed(1)}%</span>
            </div>
          </div>
          <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            These parameters seed the collateral engine in the Data Lab.
          </p>
        </div>
      </AdminSectionCard>

      <AdminSectionCard title="Rebalancing Rules" subtitle="Liquidation and repurchase automation">
        <div className="p-5 lg:p-6 flex flex-col gap-(--ct-space-4)">
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
      </AdminSectionCard>

      <div id={DATA_LAB_SECTION_ID} className="scroll-mt-[100px]">
        <AdminSectionCard
          title="Advanced Data Lab"
          subtitle="Modelled backtests, forward simulations & stress matrices"
        >
          <div className="p-5 lg:p-6">
            <StrategyDataLab 
              strategy={strategy} 
              scenario={activeScenario} 
              collateral={initialWorkspace.collateral}
              rules={initialWorkspace.rules}
            />
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
}
