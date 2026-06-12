"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NestedCallout } from "@/components/ui/nested-panel";
import { discardWizardDraft } from "../draft-actions";

interface DraftGateProps {
  ticker?: string;
  stepLabel: string;
  stepNumber: number;
  updatedAt: Date;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return "1 hr ago";
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

/**
 * DraftGate — explicit entry screen shown when an existing wizard draft is
 * detected. Forces the admin to pick between resuming the draft or starting
 * fresh, instead of silently loading the previous session's data.
 *
 * Kept exported as `ResumeDraftBanner` so the page import stays stable.
 */
export function ResumeDraftBanner({
  ticker,
  stepLabel,
  stepNumber,
  updatedAt,
}: DraftGateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function handleResume() {
    // Re-enter the page with explicit consent; page.tsx reads ?resume=1
    // and unlocks the wizard with the persisted draft.
    router.push("/admin/vaults/new?resume=1");
  }

  function handleStartFresh() {
    startTransition(async () => {
      await discardWizardDraft();
      router.refresh();
    });
  }

  const draftLabel = ticker ? `${ticker} draft` : "vault draft";
  const relTime = formatRelativeTime(new Date(updatedAt));

  return (
    <Card className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <p className="body-sm ct-text-strong">
          An autosaved {draftLabel} was found on this account.
        </p>
        <p className="body-xs ct-text-faint">
          Step {stepNumber}/7 — {stepLabel} · Autosaved {relTime}
        </p>
      </div>

      {confirmDiscard ? (
        <NestedCallout className="space-y-3 border border-(--ct-status-danger-border) ct-status-danger-bg">
          <p className="body-xs ct-text-strong">
            You are about to lose this draft. Continue?
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              type="button"
              onClick={handleStartFresh}
              disabled={isPending}
            >
              {isPending ? "Discarding…" : "Yes, discard and start fresh"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setConfirmDiscard(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </NestedCallout>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            type="button"
            onClick={handleResume}
            disabled={isPending}
          >
            Resume draft (step {stepNumber}/7, autosaved {relTime})
          </Button>
          <Button
            variant="secondary"
            size="lg"
            type="button"
            onClick={() => setConfirmDiscard(true)}
            disabled={isPending}
          >
            Start from scratch
          </Button>
        </div>
      )}
    </Card>
  );
}
