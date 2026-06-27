"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { BENTO_PRIMARY_BTN } from "@/components/ui/bento";
import { draftAllCampaignEmails } from "@/app/admin/outreach/actions";

/**
 * Triggers the email agent to draft one email per recipient for a campaign. The
 * draftCampaign server action runs the agent (structured output, forbidden-word
 * + APY-range guarded server-side) and writes the drafts; it revalidates the
 * campaign detail so the new emails appear below. Toast on completion / error.
 */
export function DraftCampaignButton({ campaignId }: { campaignId: string }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const result = await draftAllCampaignEmails(campaignId);
        const drafted = result?.drafted ?? 0;
        toast.success(
          `Drafted ${drafted} email${drafted === 1 ? "" : "s"} for review`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Draft failed: ${message}`);
      }
    });
  }

  return (
    <button
      type="button"
      className={BENTO_PRIMARY_BTN}
      onClick={onClick}
      disabled={isPending}
    >
      {isPending ? "Drafting…" : "Draft with agent"}
    </button>
  );
}
