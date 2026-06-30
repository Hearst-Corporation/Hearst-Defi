"use client";

// ManualSignalTrigger — dev/demo-only widget to seed a `pending` RebalanceEvent
// without the Inngest Dev Server running. Calls requestManualSignal (server
// action, itself guarded to NODE_ENV==="development") then refreshes the page.
// Bento canon: native bento buttons + <Modal> overlay + native <select>.

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BENTO_PRIMARY_BTN, BENTO_SECONDARY_BTN, BentoLabel } from "@/components/catalyst/bento";
import { Modal } from "@/components/catalyst/modal";

const RULE_IDS = [
  "R1",
  "R2",
  "R-BTC-1",
  "R-BTC-2",
  "R-BTC-3",
  "R-BTC-4",
  "R-BTC-5",
  "R-BTC-6",
] as const;

interface ManualSignalTriggerProps {
  /** Server Action (requestManualSignal) — returns the created event id. */
  action: (ruleId: string, vaultId?: string) => Promise<string>;
  /** Optional vault scope to attach to the seeded signal. */
  vaultId?: string;
}

export function ManualSignalTrigger({ action, vaultId }: ManualSignalTriggerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState<string>(RULE_IDS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const labelId = useId();

  function handleOpen() {
    setRuleId(RULE_IDS[0]);
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await action(ruleId, vaultId);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className={BENTO_SECONDARY_BTN}>
        Trigger test signal
      </button>

      <Modal
        isOpen={open}
        onClose={handleClose}
        title="Trigger a test signal"
        className="max-w-md"
      >
        <p className="mb-4 text-[length:var(--ct-text-xs)] leading-relaxed text-[var(--ct-text-muted)]">
          Dev only. Seeds a pending rebalance signal with placeholder PTAI text
          so the approve / reject flow can be exercised without the Inngest Dev
          Server.
        </p>

        <div className="flex flex-col gap-2">
          <BentoLabel htmlFor={`${labelId}-rule`}>Rule</BentoLabel>
          <select
            id={`${labelId}-rule`}
            aria-labelledby={labelId}
            disabled={isPending}
            value={ruleId}
            onChange={(e) => setRuleId(e.target.value)}
            className="w-full rounded-lg border border-[var(--ct-border)] bg-surface-inset px-3 py-2.5 text-[length:var(--ct-text-xs)] text-[var(--ct-text-strong)] transition-colors focus:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] focus:outline-none disabled:opacity-[var(--ct-opacity-50)]"
          >
            {RULE_IDS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] px-3 py-2.5 text-[length:var(--ct-text-xs)] text-[var(--ct-status-danger)]"
          >
            {error}
          </div>
        )}

        <div className="mt-8 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className={BENTO_SECONDARY_BTN}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className={BENTO_PRIMARY_BTN}
          >
            {isPending ? "…" : "Create signal"}
          </button>
        </div>
      </Modal>
    </>
  );
}
