"use client";

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
  /** Vault context — threaded into every scenario / compare run (ADR-006 #9). */
  vaultId: VaultId;
  /** Live market data seeded at page render; falls back to BASE_INPUTS when absent. */
  initialInputs?: ScenarioInputs;
}

export function LabShell({ vaultId, initialInputs }: LabShellProps) {
  const [activeTab, setActiveTab] = useState<LabTab>("scenario");
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>("single");

  return (
    <div className="scenario-lab-shell">
      <div className="scenario-lab-toolbar">
        <ScenarioTabBar active={activeTab} onChange={setActiveTab} />
        {activeTab === "scenario" ? (
          <ScenarioModeToggle active={scenarioMode} onChange={setScenarioMode} />
        ) : null}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-scenario"
        aria-labelledby="tab-scenario"
        hidden={activeTab !== "scenario"}
      >
        <div
          role="tabpanel"
          id="tabpanel-mode-single"
          aria-labelledby="tab-mode-single"
          hidden={scenarioMode !== "single"}
          tabIndex={0}
        >
          {scenarioMode === "single" ? (
            <SingleMode vaultId={vaultId} initialInputs={initialInputs} />
          ) : null}
        </div>
        <div
          role="tabpanel"
          id="tabpanel-mode-compare"
          aria-labelledby="tab-mode-compare"
          hidden={scenarioMode !== "compare"}
          tabIndex={0}
        >
          <CompareMode active={scenarioMode === "compare"} vaultId={vaultId} />
        </div>
      </div>

      <div
        role="tabpanel"
        id="tabpanel-backtest"
        aria-labelledby="tab-backtest"
        hidden={activeTab !== "backtest"}
        tabIndex={0}
      >
        {activeTab === "backtest" ? <BacktestTab /> : null}
      </div>
    </div>
  );
}
