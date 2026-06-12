"use client";

// RejectDeploymentButton — modal + textarea reason form for the admin
// hard-reject action. Uses <Modal> (existing primitive) + <Button> only.
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
        <p className="body-sm ct-text-muted mb-4">
          Pushes the vault back to draft. Requires a written reason for the
          audit log.
        </p>

        <div className="admin-doc-stack admin-doc-stack--tight">
          <label
            id={labelId}
            htmlFor={`${labelId}-reason`}
            className="stat-label block"
          >
            Reason{" "}
            <span className="ct-text-faint">
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
            className="ct-input w-full resize-none"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="ct-status-danger-bg body-xs mt-3 rounded-sm px-3 py-2"
          >
            {error}
          </div>
        )}

        <div className="mt-6 admin-doc-inline-row admin-doc-inline-row--end admin-doc-inline-row--actions justify-end">
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
