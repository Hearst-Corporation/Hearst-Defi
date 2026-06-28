"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BENTO_PRIMARY_BTN } from "@/components/ui/bento";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { sendCampaign } from "@/app/admin/outreach/actions";

interface SendCampaignButtonProps {
  campaignId: string;
  approvedCount: number;
}

/**
 * Wires the existing `sendCampaign` server action to the UI.
 * Shows a confirm dialog ("Send N approved emails?"), then calls the action
 * which flips campaign status to "sending" and emits the Inngest fan-out event.
 * No dry-run / sandbox / test-recipient gate — the action fires directly.
 */
export function SendCampaignButton({
  campaignId,
  approvedCount,
}: SendCampaignButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    setDialogOpen(true);
  }

  async function onConfirm(): Promise<void> {
    const fd = new FormData();
    fd.set("campaignId", campaignId);
    startTransition(async () => {
      try {
        await sendCampaign(fd);
        toast.success(
          `Campaign queued — ${approvedCount} email${approvedCount === 1 ? "" : "s"} dispatched`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Send failed: ${message}`);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={BENTO_PRIMARY_BTN}
        onClick={openDialog}
        disabled={isPending || approvedCount === 0}
        aria-busy={isPending}
      >
        {isPending
          ? "Sending…"
          : `Send ${approvedCount} approved email${approvedCount === 1 ? "" : "s"}`}
      </button>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Release campaign"
        description={
          <>
            This will dispatch{" "}
            <strong className="font-semibold text-[var(--ct-text-strong)]">
              {approvedCount} approved email{approvedCount === 1 ? "" : "s"}
            </strong>{" "}
            via Resend immediately. The campaign status will switch to{" "}
            <span className="font-mono">sending</span> and cannot be paused once
            started.
          </>
        }
        confirmLabel="Send now"
        confirmVariant="primary"
        onConfirm={onConfirm}
      />
    </>
  );
}
