"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DistributionPreview } from "@/components/admin/distribution-preview";
import {
  computeDistribution,
  confirmDistribution,
  retryDistributionFinisher,
  type ComputeDistributionResult,
} from "./actions";

// ---------------------------------------------------------------------------
// getCurrentPeriod — default to current YYYY-MM
// ---------------------------------------------------------------------------

function getCurrentPeriod(): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VaultOption {
  value: string; // vaultSlug — e.g. "yield", "defensive", "btc-plus", "hyv-a"
  label: string; // human label — e.g. "Hearst Yield Vault"
}

export interface DistributionFormProps {
  /** Vault list built on the server via listAllVaults({ status: "live-or-paused" }). */
  vaultOptions: VaultOption[];
}

// ---------------------------------------------------------------------------
// DistributionForm
// ---------------------------------------------------------------------------

export function DistributionForm({ vaultOptions }: DistributionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [totalUsdc, setTotalUsdc] = useState("");
  const [selectedVault, setSelectedVault] = useState(
    vaultOptions[0]?.value ?? "",
  );
  const [preview, setPreview] = useState<ComputeDistributionResult | null>(
    null,
  );
  const [confirmResult, setConfirmResult] = useState<{
    confirmed: boolean;
    signersCount: number;
    required: number;
    finisher?: "ok" | "failed";
    distributionId?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when a retried finalisation fails again.
  const [retryError, setRetryError] = useState<string | null>(null);
  // Two-step confirmation gate
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const totalUsdcNum = parseFloat(totalUsdc);

  function handleCompute() {
    if (!period.match(/^\d{4}-\d{2}$/)) {
      setError("Period must be in YYYY-MM format.");
      return;
    }
    if (isNaN(totalUsdcNum) || totalUsdcNum <= 0) {
      setError("Total USDC must be a positive number.");
      return;
    }
    if (!selectedVault) {
      setError("Vault is required.");
      return;
    }
    setError(null);
    setPreview(null);
    setConfirmResult(null);

    startTransition(async () => {
      try {
        const result = await computeDistribution(
          period,
          totalUsdcNum,
          selectedVault,
        );
        setPreview(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Compute failed.");
      }
    });
  }

  // Step 1 — review: show the confirmation recap Card
  function handleReview() {
    if (!preview) {
      setError("Run compute first.");
      return;
    }
    setError(null);
    setAwaitingConfirm(true);
  }

  // Step 2 — actual execution after explicit confirmation.
  // The signer identity is derived server-side from the authenticated admin —
  // no client-supplied wallet is sent or trusted.
  function handleConfirm() {
    setError(null);
    setRetryError(null);
    setAwaitingConfirm(false);

    startTransition(async () => {
      try {
        const result = await confirmDistribution(
          period,
          totalUsdcNum,
          selectedVault,
        );
        setConfirmResult(result);
        if (result.confirmed) {
          setPreview(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Confirm failed.");
      }
    });
  }

  // Retry the atomic finisher when confirm succeeded but finalisation failed.
  function handleRetryFinisher(distributionId: string) {
    setRetryError(null);

    startTransition(async () => {
      try {
        const result = await retryDistributionFinisher(distributionId);
        if (result.finisher === "ok") {
          setConfirmResult((prev) =>
            prev ? { ...prev, finisher: "ok" } : prev,
          );
        } else {
          setRetryError(result.message);
        }
      } catch (e) {
        setRetryError(e instanceof Error ? e.message : "Retry failed.");
      }
    });
  }

  // Label for selected vault (used in confirmation recap)
  const selectedVaultLabel =
    vaultOptions.find((o) => o.value === selectedVault)?.label ?? selectedVault;

  return (
    <div className="ct-card space-y-6">
      <div className="space-y-1">
        <h3 className="h3">Compute next distribution</h3>
        <p className="body-sm ct-text-muted">
          Dry-run computes pro-rata payouts from active positions. No DB writes
          until multisig confirmation.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Vault select */}
        <div className="space-y-1">
          <label className="stat-label" htmlFor="dist-vault">
            Vault
          </label>
          <select
            id="dist-vault"
            value={selectedVault}
            onChange={(e) => setSelectedVault(e.target.value)}
            className="ct-input w-full"
            disabled={isPending}
            required
          >
            {vaultOptions.length === 0 && (
              <option value="" disabled>
                No live vaults
              </option>
            )}
            {vaultOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="stat-label" htmlFor="dist-period">
            Period (YYYY-MM)
          </label>
          <input
            id="dist-period"
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="2026-05"
            className="ct-input w-full mono"
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <label className="stat-label" htmlFor="dist-usdc">
            Total USDC
          </label>
          <input
            id="dist-usdc"
            type="number"
            value={totalUsdc}
            onChange={(e) => setTotalUsdc(e.target.value)}
            placeholder="50000"
            min={0}
            step={0.01}
            className="ct-input w-full tabular"
            disabled={isPending}
          />
        </div>
      </div>

      <Button
        variant="secondary"
        onClick={handleCompute}
        disabled={isPending || !period || !totalUsdc || !selectedVault}
      >
        {isPending && !preview ? "Computing…" : "Compute"}
      </Button>

      {/* Error */}
      {error && (
        <p className="body-xs ct-status-danger-bg px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Preview */}
      {preview && (
        <>
          <DistributionPreview
            period={preview.period}
            totalUsdc={preview.totalUsdc}
            recipients={preview.recipients}
          />

          {/* Multisig confirm */}
          {preview.recipients.length > 0 && (
            <div className="space-y-3">
              <p className="body-xs ct-text-muted">
                Your multisig signature is recorded under your authenticated
                admin identity. Two distinct admins must confirm the same amount.
              </p>

              {confirmResult && !confirmResult.confirmed && (
                <p className="body-xs ct-status-info-bg px-3 py-2 rounded-lg">
                  Signature {confirmResult.signersCount}/{confirmResult.required}{" "}
                  recorded. Awaiting{" "}
                  {confirmResult.required - confirmResult.signersCount} more
                  distinct signer(s).
                </p>
              )}

              {awaitingConfirm ? (
                <Card className="space-y-4">
                  <h3 className="h3">Confirm distribution</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between body-sm">
                      <span className="ct-text-muted">Vault</span>
                      <span className="ct-text-body font-semibold">
                        {selectedVaultLabel}
                      </span>
                    </div>
                    <div className="flex justify-between body-sm">
                      <span className="ct-text-muted">Period</span>
                      <span className="ct-text-body font-semibold mono">
                        {period}
                      </span>
                    </div>
                    <div className="flex justify-between body-sm">
                      <span className="ct-text-muted">Total USDC</span>
                      <span className="ct-text-strong font-bold tabular">
                        ${totalUsdcNum.toLocaleString("en-US")} USDC
                      </span>
                    </div>
                    <div className="flex justify-between body-sm">
                      <span className="ct-text-muted">Recipients</span>
                      <span className="ct-text-body tabular">
                        {preview.recipients.length}
                      </span>
                    </div>
                  </div>
                  <p className="body-xs ct-text-muted">
                    This will record your multisig signature. Distribution is
                    finalised once the required threshold is reached. Results
                    are not projected — see methodology v1.0.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="secondary"
                      onClick={() => setAwaitingConfirm(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleConfirm}
                      disabled={isPending}
                      className="flex-1"
                    >
                      {isPending
                        ? "Confirming…"
                        : "Confirm distribution (multisig)"}
                    </Button>
                  </div>
                </Card>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleReview}
                  disabled={isPending}
                >
                  Review distribution
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Confirmed — finaliser succeeded */}
      {confirmResult?.confirmed && confirmResult.finisher !== "failed" && (
        <div className="ct-status-success-bg px-4 py-3 rounded-xl space-y-1">
          <p className="body-sm ct-status-success font-semibold">
            Distribution confirmed for period {period}.
          </p>
          <p className="body-xs ct-text-muted">
            Distribution row and investor transactions have been created. Reload
            the page to see the updated history.
          </p>
        </div>
      )}

      {/* Confirmed — but finalisation (ledger / PCAP / emails) failed */}
      {confirmResult?.confirmed &&
        confirmResult.finisher === "failed" &&
        confirmResult.distributionId && (
          <div className="ct-status-warning-bg px-4 py-3 rounded-xl space-y-3">
            <div className="space-y-1">
              <p className="body-sm ct-status-warning font-semibold">
                Confirmed, but finalisation (ledger / PCAP / emails) failed —
                retry below.
              </p>
              <p className="body-xs ct-text-muted">
                The distribution for period {period} stays pending until
                finalisation completes. Investor ledger entries and PCAP have
                not been generated yet.
              </p>
            </div>
            {retryError && (
              <p className="body-xs ct-status-danger-bg px-3 py-2 rounded-lg">
                {retryError}
              </p>
            )}
            <Button
              variant="primary"
              onClick={() =>
                handleRetryFinisher(confirmResult.distributionId!)
              }
              disabled={isPending}
            >
              {isPending ? "Retrying…" : "Retry finalisation"}
            </Button>
          </div>
        )}
    </div>
  );
}
