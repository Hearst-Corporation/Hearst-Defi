"use client";

// LabShell — Scenario Lab orchestrator. Owns only the tab/mode toggle state;
// each sub-view owns its own data via dedicated hooks (useScenario / useBacktest
// / the CompareMode internals). Behaviour preserved from the original monolith.

import { useState } from "react";

import { BacktestTab } from "@/components/scenario/backtest-tab";
import { CompareMode } from "@/components/scenario/compare-mode";
import {
  ScenarioTabBar,
  type LabTab,
} from "@/components/scenario/scenario-tab-bar";
import {
  ScenarioModeToggle,
  type ScenarioMode,
} from "@/components/scenario/scenario-mode-toggle";
import { SingleMode } from "@/components/scenario/single-mode";
import type { ScenarioInputs, VaultId } from "@/lib/engine/types";

export interface LabShellProps {
  /**
   * Vault context for this Lab session. Threaded into the scenario hook and
   * comparison sub-view so every server-action call carries the vault id —
   * ADR-006 #9: a scenario run is always bound to exactly one vault.
   */
  vaultId: VaultId;
  /**
   * Live market data seeded from the server at page render time. Passed
   * straight through to SingleMode → useScenario so sliders open at current
   * real-world values. Falls back to BASE_INPUTS when undefined.
   */
  initialInputs?: ScenarioInputs;
}

export function LabShell({ vaultId, initialInputs }: LabShellProps) {
  const [activeTab, setActiveTab] = useState<LabTab>("scenario");
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>("single");

  return (
    <div className="space-y-6">
      {/* Tab toggle */}
      <ScenarioTabBar active={activeTab} onChange={setActiveTab} />

      {/* ── Scenario tab ──────────────────────────────────────────────── */}
      <div
        role="tabpanel"
        id="tabpanel-scenario"
        aria-labelledby="tab-scenario"
        hidden={activeTab !== "scenario"}
      >
        <div className="space-y-6">
          {/* Mode toggle: Single | Compare */}
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">
              {scenarioMode === "single"
                ? "Run one scenario"
                : "Compare two scenarios side-by-side"}
            </p>
            <ScenarioModeToggle active={scenarioMode} onChange={setScenarioMode} />
          </div>

          {/* Single / Compare sub-panels */}
          <div
            role="tabpanel"
            id="tabpanel-mode-single"
            aria-labelledby="tab-mode-single"
            hidden={scenarioMode !== "single"}
            tabIndex={0}
          >
            {scenarioMode === "single" && <SingleMode vaultId={vaultId} initialInputs={initialInputs} />}
          </div>
          <div
            role="tabpanel"
            id="tabpanel-mode-compare"
            aria-labelledby="tab-mode-compare"
            hidden={scenarioMode !== "compare"}
            tabIndex={0}
          >
            <CompareMode
              active={scenarioMode === "compare"}
              vaultId={vaultId}
            />
          </div>
        </div>
      </div>

      {/* ── Backtest tab ───────────────────────────────────────────────── */}
      <div
        role="tabpanel"
        id="tabpanel-backtest"
        aria-labelledby="tab-backtest"
        hidden={activeTab !== "backtest"}
        tabIndex={0}
      >
        <BacktestTab />
      </div>
    </div>
  );
}
