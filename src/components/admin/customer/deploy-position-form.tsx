"use client";

import { useState } from "react";

import { BentoLabel } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { cn } from "@/lib/cn";
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
          <Input
            id={`deploy-amount-${investorId}`}
            name="amountUsdc"
            type="number"
            min={1}
            step={1000}
            defaultValue={250000}
            required
            disabled={blocked || pending}
            className="w-40 tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-2">
          <BentoLabel htmlFor={`deploy-class-${investorId}`}>
            Share class
          </BentoLabel>
          <Select
            id={`deploy-class-${investorId}`}
            name="classCode"
            defaultValue="A"
            disabled={blocked || pending}
          >
            <option value="A">Class A — $250k min · 60d</option>
            <option value="B">Class B — $1M min · 90d</option>
          </Select>
        </div>

        <CockpitButton
          type="submit"
          variant="secondary"
          shape="rect"
          size="lg"
          disabled={blocked || pending}
        >
          {pending ? "Deploying…" : "Deploy position"}
        </CockpitButton>
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
