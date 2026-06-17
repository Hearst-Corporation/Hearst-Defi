"use client";

// ManualSignalTrigger — dev/demo-only widget to seed a `pending` RebalanceEvent
// without the Inngest Dev Server running. Calls requestManualSignal (server
// action, itself guarded to NODE_ENV==="development") then refreshes the page.
// Uses <Modal> + Button + native <select> only — no new primitive, no new token.

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

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
      <Button variant="secondary" size="sm" onClick={handleOpen}>
        Trigger test signal
      </Button>

      <Modal
        isOpen={open}
        onClose={handleClose}
        title="Trigger a test signal"
        className="max-w-md"
      >
        <p className="body-sm ct-text-muted mb-4">
          Dev only. Seeds a pending rebalance signal with placeholder PTAI text
          so the approve / reject flow can be exercised without the Inngest Dev
          Server.
        </p>

        <div className="admin-doc-stack admin-doc-stack--tight">
          <label id={labelId} htmlFor={`${labelId}-rule`} className="stat-label block">
            Rule
          </label>
          <select
            id={`${labelId}-rule`}
            aria-labelledby={labelId}
            disabled={isPending}
            value={ruleId}
            onChange={(e) => setRuleId(e.target.value)}
            className="ct-input ct-select w-full"
          >
            {RULE_IDS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div role="alert" className="ct-status-danger-bg ct-alert-danger">
            {error}
          </div>
        )}

        <div className="mt-6 admin-doc-inline-row admin-doc-inline-row--end admin-doc-inline-row--actions justify-end">
          <Button variant="ghost" size="md" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "…" : "Create signal"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
