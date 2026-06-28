"use client";

import { useState } from "react";

import { BentoLabel, BENTO_SECONDARY_BTN } from "@/components/catalyst/bento";
import { cn } from "@/lib/cn";
import { deployPosition, type DeployPositionResult } from "@/app/admin/customers/actions";

// Shared tokenized form control — canonical `.ct-input/.ct-select/.ct-textarea`
// (cockpit.css), token-only. Replaces a hardcoded class string that was copy-
// pasted across 5 customer forms (#A7FB90 / border-white / text-white / text-[13px]).
const SELECT_INPUT = "ct-select";

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
    <div className="flex flex-col gap-3">
      {blocked && (
        <p className="ct-metric-caption text-[var(--ct-status-warning)]">
          KYC must be approved before deploying a position. Use the Approve button
          above first.
        </p>
      )}

      <form action={handleSubmit} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="investorId" value={investorId} />

        <div className="flex flex-col gap-2">
          <BentoLabel htmlFor={`deploy-amount-${investorId}`}>
            Amount (USDC)
          </BentoLabel>
          <input
            id={`deploy-amount-${investorId}`}
            name="amountUsdc"
            type="number"
            min={1}
            step={1000}
            defaultValue={250000}
            required
            disabled={blocked || pending}
            className={cn(SELECT_INPUT, "w-40 tabular-nums")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <BentoLabel htmlFor={`deploy-class-${investorId}`}>
            Share class
          </BentoLabel>
          <select
            id={`deploy-class-${investorId}`}
            name="classCode"
            defaultValue="A"
            disabled={blocked || pending}
            className={SELECT_INPUT}
          >
            <option value="A">Class A — $250k min · 60d</option>
            <option value="B">Class B — $1M min · 90d</option>
          </select>
        </div>

        <button
          type="submit"
          className={BENTO_SECONDARY_BTN}
          disabled={blocked || pending}
        >
          {pending ? "Deploying…" : "Deploy position"}
        </button>
      </form>

      {result !== null && (
        <p
          className={cn(
            "ct-metric-caption",
            result.ok
              ? "text-[var(--ct-status-success)]"
              : "text-[var(--ct-status-danger)]",
          )}
        >
          {result.ok
            ? `Position deployed — id ${result.positionId}`
            : `Error: ${result.error}`}
        </p>
      )}
    </div>
  );
}
