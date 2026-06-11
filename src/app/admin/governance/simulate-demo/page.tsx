"use client";

/**
 * /admin/governance/simulate-demo
 *
 * Demo page for the SimulationPanel component.
 * Uses the deterministic Tenderly stub — no real API calls.
 *
 * ── Wiring to /admin/governance/proposal/[id]/page.tsx (P2) ──────────────
 * 1. Import simulateProposal from "@/lib/simulation/tenderly-stub"
 * 2. Add a "Simulate" button next to "Execute Proposal"
 * 3. On click: setLoading(true) → await simulateProposal(…) → setResult(…) → setLoading(false)
 * 4. Render <SimulationPanel result={result} loading={loading} error={error} />
 *    inline, below the proposal details card (collapsible section recommended)
 * 5. Gate "Sign & Execute" behind result?.ok === true to prevent signing reverts
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SimulationPanel } from "@/components/simulation/simulation-panel";
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

export default function SimulateDemoPage() {
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
    <div className="mx-auto max-w-2xl space-y-8">
      <AdminPageHeader
        title="Simulation Panel — Demo"
      />

      {/* Proposal selector */}
      <div className="ct-card p-5 space-y-4">
        <h3 className="h3">Mock proposal</h3>

        <div className="flex flex-col gap-2">
          {MOCK_PROPOSALS.map((p, i) => (
            <label
              key={p.label}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="radio"
                name="proposal"
                value={i}
                checked={selectedIdx === i}
                onChange={() => {
                  setSelectedIdx(i);
                  handleReset();
                }}
                className="accent-[var(--ct-accent)]"
              />
              <span className="body-sm ct-text-strong">
                {p.label}
              </span>
            </label>
          ))}
        </div>

        <div className="rounded-md ct-surface-1 border border-[var(--ct-border-soft)] px-3 py-2.5 space-y-1">
          <p className="mono body-xs ct-text-muted">
            vault: {selectedProposal.vaultAddress}
          </p>
          <p className="mono body-xs ct-text-faint truncate">
            calldata: {selectedProposal.calldata}
          </p>
          <p className="mono body-xs ct-text-faint">
            actionType: {selectedProposal.actionType}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSimulate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--ct-border-strong)] ct-surface-1 px-4 py-2 body-sm font-medium ct-text-strong transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Simulating…" : "▶ Simulate"}
          </button>
          {(result !== null || error !== null) && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center rounded-md border border-[var(--ct-border-soft)] px-3 py-2 body-xs ct-text-muted transition-opacity hover:opacity-80"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* SimulationPanel */}
      <SimulationPanel result={result} loading={loading} error={error} />
    </div>
  );
}
