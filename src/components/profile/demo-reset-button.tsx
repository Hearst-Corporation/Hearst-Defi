"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { resetDemoAccount } from "@/lib/demo/actions";

/**
 * Demo-only control: unsubscribes from everything and resets onboarding back to
 * square one, so the whole investor flow can be re-run from scratch. Rendered in
 * /profile ONLY for demo accounts (allowlist-gated server-side + at the render
 * site) — a real investor never sees it, and the server action refuses them too.
 *
 * Two-step confirm: the reset destroys positions, transactions and NAV history
 * for the demo account (KYC/accreditation/wallet are kept so it stays verified),
 * so an accidental single click is guarded.
 */
export function DemoResetButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onReset() {
    setError(null);
    startTransition(async () => {
      const result = await resetDemoAccount();
      if (!result.ok) {
        setError(result.error);
        setArmed(false);
        return;
      }
      setArmed(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onReset}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? "Resetting…" : "Yes, reset everything"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => setArmed(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => setArmed(true)}
        >
          Reset demo account
        </Button>
      )}

      <p className="body-xs ct-text-faint m-0">
        Unsubscribes from every vault and clears positions, distributions and NAV
        history so the flow can be re-run. Keeps you verified (KYC stays approved).
        Demo accounts only.
      </p>

      {error ? (
        <p className="body-xs ct-status-danger m-0" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
