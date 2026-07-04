"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { simulateKycApproval } from "@/lib/demo/actions";

/**
 * Demo-only shortcut on the identity step: "pass" KYC without a real Sumsub
 * round-trip. Rendered ONLY for demo accounts (allowlist-gated at the render
 * site + re-checked in the server action). A real investor never sees it and
 * the action refuses them.
 */
export function DemoKycSimulate() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSimulate() {
    setError(null);
    startTransition(async () => {
      const result = await simulateKycApproval();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-[var(--ct-border)] bg-surface-inset p-4">
      <span className="ct-bento-label">Demo shortcut</span>
      <p className="body-xs ct-text-faint m-0">
        Skip the real verification and mark this demo account as approved.
      </p>
      <div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onSimulate}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? "Approving…" : "Simulate KYC approval"}
        </Button>
      </div>
      {error ? (
        <p className="body-xs ct-status-danger m-0" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
