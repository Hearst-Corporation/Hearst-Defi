"use client";

/**
 * WithdrawForm — the investor-facing request form for /withdrawals.
 *
 * Request-only, human-gated: submitting this form calls `requestWithdrawal`
 * (a Server Action that creates a `pending` row and moves ZERO funds — see
 * actions.ts). A `ConfirmDialog` gate stands between "Submit" and the actual
 * call, so an investor cannot fire the request from a single accidental
 * click. Button copy is deliberately "Submit withdrawal request" — never
 * "Withdraw" or "Send", to avoid implying any fund movement happens here.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { ConfirmDialog } from "@/components/catalyst/confirm-dialog";
import { Input } from "@/components/catalyst/input";
import { formatBtc } from "@/lib/format/btc";
import { formatUsdFull } from "@/lib/vaults/product-display";

import { requestWithdrawal } from "./actions";

const NETWORKS = [
  { value: "bitcoin", label: "Bitcoin (on-chain)" },
  { value: "lightning", label: "Lightning" },
] as const;

/**
 * Documented estimate — mirrors the server's FLAT_ESTIMATED_FEE_BTC constant.
 * Purely a display hint; the server derives its own snapshot independently.
 */
const FLAT_ESTIMATED_FEE_BTC = 0.0005;

export interface WithdrawFormProps {
  btcPriceUsd: number;
}

export function WithdrawForm({ btcPriceUsd }: WithdrawFormProps) {
  const router = useRouter();
  const labelId = useId();

  const [walletAddress, setWalletAddress] = useState("");
  const [amountBtc, setAmountBtc] = useState("");
  const [network, setNetwork] = useState<"bitcoin" | "lightning">("bitcoin");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const parsedAmount = Number.parseFloat(amountBtc);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const hasValidAddress = walletAddress.trim().length > 0;
  const canSubmit = hasValidAmount && hasValidAddress && !isPending;

  const estimatedUsd = hasValidAmount ? parsedAmount * btcPriceUsd : 0;

  async function handleConfirm(): Promise<void> {
    setSubmitError(null);
    const result = await requestWithdrawal({
      walletAddress: walletAddress.trim(),
      amountBtc: parsedAmount,
      network,
    });
    if (!result.ok) {
      setSubmitError(result.error);
      throw new Error(result.error);
    }
    setSubmitted(true);
    setWalletAddress("");
    setAmountBtc("");
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-(--ct-space-6)">
      <div className="grid grid-cols-1 gap-(--ct-space-4) @md:grid-cols-2">
        <div className="flex flex-col gap-(--ct-space-2)">
          <label htmlFor={`${labelId}-address`} className="stat-label">
            Wallet address
          </label>
          <Input
            id={`${labelId}-address`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="bc1q… or lnbc…"
            value={walletAddress}
            disabled={isPending || submitted}
            onChange={(e) => setWalletAddress(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-(--ct-space-2)">
          <label htmlFor={`${labelId}-network`} className="stat-label">
            Network
          </label>
          <select
            id={`${labelId}-network`}
            value={network}
            disabled={isPending || submitted}
            onChange={(e) => setNetwork(e.target.value as "bitcoin" | "lightning")}
            className="w-full rounded-lg border border-[var(--ct-border)] bg-surface-inset px-3 py-2.5 text-[length:var(--ct-text-xs)] text-[var(--ct-text-strong)] transition-colors focus:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] focus:outline-none disabled:opacity-[var(--ct-opacity-50)]"
          >
            {NETWORKS.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-(--ct-space-2)">
          <label htmlFor={`${labelId}-amount`} className="stat-label">
            Amount (BTC)
          </label>
          <Input
            id={`${labelId}-amount`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00000000"
            value={amountBtc}
            disabled={isPending || submitted}
            onChange={(e) => setAmountBtc(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-(--ct-space-2)">
          <span className="stat-label">Estimated USD value</span>
          <div className="flex h-9 items-center rounded-lg border border-[var(--ct-border-soft)] bg-surface-inset px-3 text-[length:var(--ct-text-xs)] tabular-nums ct-text-muted">
            {hasValidAmount ? formatUsdFull(estimatedUsd) : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-(--ct-space-4) rounded-lg border border-[var(--ct-border-soft)] bg-surface-inset px-4 py-3">
        <span className="body-xs ct-text-muted">
          Estimated network fee (flat estimate, not a live quote)
        </span>
        <span className="body-xs tabular-nums ct-text-strong">
          {formatBtc(FLAT_ESTIMATED_FEE_BTC, { unit: true })}
        </span>
      </div>

      {submitError ? (
        <div role="alert" className="ct-status-danger-bg ct-alert-danger">
          {submitError}
        </div>
      ) : null}

      {submitted ? (
        <div role="status" className="body-xs ct-text-strong">
          Withdrawal request submitted. It now awaits custody operations
          review.
        </div>
      ) : null}

      <div className="flex justify-end">
        <CockpitButton
          type="button"
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          onClick={() => setConfirmOpen(true)}
        >
          Submit withdrawal request
        </CockpitButton>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit withdrawal request?"
        description={
          <div className="flex flex-col gap-(--ct-space-2)">
            <p>
              This creates a request for custody operations to review — it
              does NOT move any funds. Requests are settled off-platform only
              after multisig approval.
            </p>
            <p className="tabular-nums">
              {hasValidAmount ? formatBtc(parsedAmount, { unit: true }) : "—"}
              {" · "}
              {hasValidAmount ? formatUsdFull(estimatedUsd) : "—"}
              {" · "}
              {NETWORKS.find((n) => n.value === network)?.label}
            </p>
          </div>
        }
        confirmLabel="Submit request"
        confirmVariant="primary"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
