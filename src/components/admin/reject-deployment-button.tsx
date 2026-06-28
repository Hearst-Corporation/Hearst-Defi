"use client";

// RejectDeploymentButton — modal + textarea reason form for the admin
// hard-reject action. Uses <Modal> (existing primitive) + Button component only.
// No new primitive, no new token, no new .ct-* class.

import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface RejectDeploymentButtonProps {
  /** Server Action already bound to the vault id. */
  action: (reason: string) => Promise<void>;
}

export function RejectDeploymentButton({ action }: RejectDeploymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const labelId = useId();

  const MAX_REASON_CHARS = 200;

  const trimmed = reason.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= MAX_REASON_CHARS;

  function handleOpen() {
    setReason("");
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function handleSubmit() {
    if (!isValid) return;
    setError(null);
    startTransition(async () => {
      try {
        await action(trimmed);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={handleOpen}>
        Reject deployment
      </Button>

      <Modal
        isOpen={open}
        onClose={handleClose}
        title="Reject this deployment?"
        className="max-w-md"
      >
        <p className="mb-4 text-[13px] text-zinc-400">
          Pushes the vault back to draft. Requires a written reason for the
          audit log.
        </p>

        <div className="flex flex-col gap-2">
          <label
            id={labelId}
            htmlFor={`${labelId}-reason`}
            className="ct-bento-label block"
          >
            Reason{" "}
            <span className="text-zinc-600">
              ({trimmed.length}/{MAX_REASON_CHARS})
            </span>
          </label>
          <textarea
            id={`${labelId}-reason`}
            aria-labelledby={labelId}
            rows={4}
            maxLength={MAX_REASON_CHARS}
            disabled={isPending}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Missing audit report, incorrect fee structure…"
            className="w-full resize-none rounded-lg border border-[var(--ct-border)] bg-surface-inset px-4 py-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] focus:outline-none"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-[13px] text-red-400"
          >
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={handleSubmit}
            disabled={isPending || !isValid}
          >
            {isPending ? "…" : "Reject deployment"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
