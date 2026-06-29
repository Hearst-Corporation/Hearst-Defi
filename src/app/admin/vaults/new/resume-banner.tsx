"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { PanelStatusAccent } from "@/components/catalyst/panel-status";
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
  const [relTime, setRelTime] = useState<string | null>(null);

  useEffect(() => {
    // Intentional: client-only Date.now() call to avoid SSR/hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRelTime(formatRelativeTime(new Date(updatedAt)));
  }, [updatedAt]);

  return (
    <AdminSectionCard
      title="Resume your draft"
      subtitle="Pick up the autosaved vault deployment, or discard it and start fresh."
      ariaLabel="Resume vault draft"
      className="max-w-2xl"
    >
      <div className="admin-doc-stack admin-doc-stack--roomy p-5">
        <div className="admin-doc-stack admin-doc-stack--compact">
          <p className="body-sm ct-text-strong">
            An autosaved {draftLabel} was found on this account.
          </p>
          <p className="body-xs ct-text-faint">
            Step {stepNumber}/7 — {stepLabel} · Autosaved {relTime ?? "…"}
          </p>
        </div>

        {confirmDiscard ? (
          <PanelStatusAccent
            className="items-stretch border-l-(--ct-status-danger)"
            role="alert"
          >
            <div className="admin-doc-stack admin-doc-stack--actions">
              <p className="body-xs ct-text-strong m-0">
                You are about to lose this draft. Continue?
              </p>
              <div className="admin-doc-inline-row">
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
            </div>
          </PanelStatusAccent>
        ) : (
          <div className="admin-doc-inline-row">
            <Button
              variant="primary"
              size="lg"
              type="button"
              onClick={handleResume}
              disabled={isPending}
            >
              Resume draft (step {stepNumber}/7{relTime ? `, autosaved ${relTime}` : ""})
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
      </div>
    </AdminSectionCard>
  );
}
