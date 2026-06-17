"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { deployPosition, type DeployPositionResult } from "@/app/admin/customers/actions";

/**
 * Admin "Deploy position" form — creates an off-chain position for a specific
 * investor so a demo/pilot cockpit is populated without a real on-chain deposit.
 *
 * Requires the investor to be KYC-approved first. The server action re-asserts
 * that guard; this form surfaces the error inline if KYC is missing.
 */
export function DeployPositionForm({
  investorId,
  kycStatus,
}: {
  investorId: string;
  kycStatus: "pending" | "approved" | "rejected";
}) {
  const [result, setResult] = useState<DeployPositionResult | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setResult(null);
    try {
      const res = await deployPosition(formData);
      setResult(res);
    } finally {
      setPending(false);
    }
  }

  const blocked = kycStatus !== "approved";

  return (
    <div className="admin-doc-stack" style={{ gap: "var(--ct-space-3)" }}>
      {blocked && (
        <p className="body-xs ct-text-warning">
          KYC must be approved before deploying a position. Use the Approve button
          above first.
        </p>
      )}

      <form action={handleSubmit} className="admin-doc-inline-row flex-wrap">
        <input type="hidden" name="investorId" value={investorId} />

        <div className="flex flex-col gap-1">
          <label htmlFor={`deploy-amount-${investorId}`} className="ct-form-label">
            Amount (USDC)
          </label>
          <input
            id={`deploy-amount-${investorId}`}
            name="amountUsdc"
            type="number"
            min={1}
            step={1000}
            defaultValue={250000}
            required
            disabled={blocked || pending}
            className="ct-input body-sm tabular-nums"
            style={{ width: "10rem" }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`deploy-class-${investorId}`} className="ct-form-label">
            Share class
          </label>
          <select
            id={`deploy-class-${investorId}`}
            name="classCode"
            defaultValue="A"
            disabled={blocked || pending}
            className="ct-input body-sm"
          >
            <option value="A">Class A — $250k min · 60d</option>
            <option value="B">Class B — $1M min · 90d</option>
          </select>
        </div>

        <div className="flex flex-col justify-end">
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={blocked || pending}
          >
            {pending ? "Deploying…" : "Deploy position"}
          </Button>
        </div>
      </form>

      {result !== null && (
        <p className={`body-xs ${result.ok ? "ct-text-success" : "ct-text-danger"}`}>
          {result.ok
            ? `Position deployed — id ${result.positionId}`
            : `Error: ${result.error}`}
        </p>
      )}
    </div>
  );
}
