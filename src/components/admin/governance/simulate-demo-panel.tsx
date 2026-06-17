"use client";

import { useState } from "react";

import { SimulationPanel } from "@/components/simulation/simulation-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { simulateProposal } from "@/lib/simulation/tenderly-stub";
import type { SimulationResult } from "@/lib/simulation/types";

const MOCK_PROPOSALS = [
  {
    label: "setFeeRecipient",
    vaultAddress: "0x1234567890abcdef1234567890abcdef12345678",
    calldata: "0xa9059cbb000000000000000000000000dead000000000000000000000000000000000003e8",
    actionType: "setFeeRecipient",
  },
  {
    label: "updateAllocation",
    vaultAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    calldata: "0x40c10f19000000000000000000000000dead0000000000000000000000000000000003e8",
    actionType: "updateAllocation",
  },
  {
    label: "deliberateRevert (test error path)",
    vaultAddress: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    calldata: "0xdeadbeef",
    actionType: "deliberateRevert",
  },
] as const;

export function SimulateDemoPanel() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const selectedProposal = MOCK_PROPOSALS[selectedIdx as 0 | 1 | 2];

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await simulateProposal({
        vaultAddress: selectedProposal.vaultAddress,
        calldata: selectedProposal.calldata,
        actionType: selectedProposal.actionType,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown simulation error");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  return (
    <>
      <Card>
        <DashboardPanelHeader title="Mock proposal" tone="quiet" className="mb-[var(--ct-space-4)]" />

        <div className="admin-doc-stack admin-doc-stack--tight">
          {MOCK_PROPOSALS.map((proposal, index) => (
            <label key={proposal.label} className="admin-doc-inline-row admin-doc-inline-row--actions cursor-pointer">
              <input
                type="radio"
                name="proposal"
                value={index}
                checked={selectedIdx === index}
                onChange={() => {
                  setSelectedIdx(index);
                  handleReset();
                }}
                className="accent-[var(--ct-accent)]"
              />
              <span className="body-sm ct-text-strong">{proposal.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-[var(--ct-space-4)] admin-doc-stack admin-doc-stack--compact ct-nested-callout">
          <p className="mono body-xs ct-text-muted">vault: {selectedProposal.vaultAddress}</p>
          <p className="mono body-xs ct-text-faint truncate">
            calldata: {selectedProposal.calldata}
          </p>
          <p className="mono body-xs ct-text-faint">actionType: {selectedProposal.actionType}</p>
        </div>

        <div className="mt-[var(--ct-space-4)] admin-doc-inline-row admin-doc-inline-row--actions">
          <Button type="button" variant="primary" size="md" onClick={handleSimulate} disabled={loading}>
            {loading ? "Simulating…" : "Simulate"}
          </Button>
          {result !== null || error !== null ? (
            <Button type="button" variant="secondary" size="md" onClick={handleReset}>
              Reset
            </Button>
          ) : null}
        </div>
      </Card>

      <SimulationPanel result={result} loading={loading} error={error} />
    </>
  );
}
