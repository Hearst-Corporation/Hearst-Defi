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
import { Card } from "@/components/ui/card";
import type { ScenarioInputs, VaultId } from "@/lib/engine/types";

export interface LabShellProps {
  /** Vault context — threaded into every scenario / compare run (ADR-006 #9). */
  vaultId: VaultId;
  /** Live market data seeded at page render; falls back to BASE_INPUTS when absent. */
  initialInputs?: ScenarioInputs;
  /** Optional objective seeded from admin chat when framing a product. */
  initialObjective?: string;
  /** When true, auto-run scenario once the shell mounts (chat-directed flow). */
  autostart?: boolean;
  /** Optional BTC spot used for center context rendering. */
  liveBtcPrice?: { usd: number; stale: boolean };
}

export function LabShell({
  vaultId,
  initialInputs,
  initialObjective,
  autostart,
  liveBtcPrice,
}: LabShellProps) {
  const [activeTab, setActiveTab] = useState<LabTab>("scenario");
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>("single");

  return (
    <div className="scenario-lab-shell admin-doc-stack admin-doc-stack--roomy">
      <Card className="scenario-lab-toolbar p-(--ct-space-4)" hoverOverlay={false}>
        <ScenarioTabBar active={activeTab} onChange={setActiveTab} />
        {activeTab === "scenario" ? (
          <ScenarioModeToggle active={scenarioMode} onChange={setScenarioMode} />
        ) : null}
      </Card>

      {/* scenario-lab-body = internal scroll region in the fit gate */}
      <div className="scenario-lab-body">
        <div
          role="tabpanel"
          id="tabpanel-scenario"
          aria-labelledby="tab-scenario"
          hidden={activeTab !== "scenario"}
          className="admin-doc-stack admin-doc-stack--roomy"
        >
          <div
            role="tabpanel"
            id="tabpanel-mode-single"
            aria-labelledby="tab-mode-single"
            hidden={scenarioMode !== "single"}
            tabIndex={0}
          >
            {scenarioMode === "single" ? (
              <SingleMode
                vaultId={vaultId}
                initialInputs={initialInputs}
                initialObjective={initialObjective}
                autostart={autostart}
                liveBtcPrice={liveBtcPrice}
              />
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
          className="admin-doc-stack admin-doc-stack--roomy"
        >
          {activeTab === "backtest" ? <BacktestTab /> : null}
        </div>
      </div>
    </div>
  );
}
