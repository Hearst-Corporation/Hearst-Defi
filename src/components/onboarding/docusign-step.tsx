"use client";

/**
 * DocusignStep — client wrapper for the DocuSign embedded signing ceremony.
 *
 * Responsibilities:
 *   1. Calls `createSubscriptionEnvelope` (Server Action) on first mount to
 *      obtain a one-time `{ envelopeId, signingUrl }`.
 *   2. Renders `DocusignEmbedded` when the URL is available.
 *   3. Falls back to `DocsignPlaceholder` when DocuSign is not configured
 *      (server action throws "Missing DocuSign configuration").
 *
 * Props passed down from the Server Component parent (`step-content.tsx`):
 *   - `label`  — human-readable step label (e.g. "Accreditation")
 *   - `userId` — authenticated user ID (from session)
 *   - `email`  — authenticated user email (from session, replaces placeholder)
 *   - `vaultId` — default "HYV-A" for the MVP single vault
 *   - `amount`  — subscription amount; defaults to the $250 000 min ticket
 *   - `configured` — whether the server has all three DocuSign env vars
 *
 * No business logic here — all math and env resolution lives server-side.
 * Cockpit tokens only.
 */

import { useEffect, useState } from "react";

import { DocusignEmbedded, type DocusignEvent } from "@/components/onboarding/docusign-embedded";
import { DocsignPlaceholder } from "@/components/onboarding/docsign-placeholder";
import { createSubscriptionEnvelope } from "@/app/onboarding/actions";
import { cn } from "@/lib/cn";

export interface DocusignStepProps {
  label: string;
  userId: string;
  email: string;
  vaultId: string;
  amount: number;
  /** True when DOCUSIGN_BASE_URL, DOCUSIGN_API_KEY, DOCUSIGN_ACCOUNT_ID are all set. */
  configured: boolean;
}

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; envelopeId: string; signingUrl: string }
  | { phase: "done"; event: DocusignEvent }
  | { phase: "error"; message: string };

export function DocusignStep({
  label,
  userId,
  email,
  vaultId,
  amount,
  configured,
}: DocusignStepProps) {
  const [state, setState] = useState<State>({ phase: "idle" });

  // If DocuSign is not configured, surface the placeholder immediately —
  // no server action call, no crash.
  if (!configured) {
    return <DocsignPlaceholder label={label} />;
  }

  return (
    <DocusignStepInner
      label={label}
      userId={userId}
      email={email}
      vaultId={vaultId}
      amount={amount}
      state={state}
      setState={setState}
    />
  );
}

// Split into inner to isolate the hook (hooks cannot follow an early return
// but we need the guard above; putting hooks in a sub-component is clean).
interface InnerProps extends Omit<DocusignStepProps, "configured"> {
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
}

function DocusignStepInner({
  label,
  userId,
  email,
  vaultId,
  amount,
  state,
  setState,
}: InnerProps) {
  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/onboarding/signed`
      : "https://connect.hearst.app/onboarding/signed";

  useEffect(() => {
    // Only fire once (idle phase) — prevents re-triggering on re-renders.
    if (state.phase !== "idle") return;

    setState({ phase: "loading" });

    void createSubscriptionEnvelope(userId, vaultId, amount, email)
      .then(({ envelopeId, signingUrl }) => {
        setState({ phase: "ready", envelopeId, signingUrl });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "DocuSign unavailable";
        // If the error is a "Missing DocuSign configuration" sentinel, fall
        // back gracefully — treat as unconfigured rather than crashing.
        setState({ phase: "error", message });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional empty array — fire once on mount

  function handleEvent(event: DocusignEvent) {
    setState({ phase: "done", event });
  }

  if (state.phase === "loading" || state.phase === "idle") {
    return (
      <div
        className={cn(
          "rounded-lg border border-[var(--ct-border-soft)]",
          "ct-surface-1 px-6 py-10 text-center",
        )}
        aria-live="polite"
        aria-busy="true"
      >
        <p className="text-sm font-medium ct-text-muted animate-pulse">
          Preparing signing session…
        </p>
      </div>
    );
  }

  if (state.phase === "error") {
    // Graceful degradation: show placeholder rather than a broken state.
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-[var(--ct-border)]",
          "ct-surface-1 px-6 py-10 text-center",
        )}
        role="region"
        aria-label={`${label} — configuration pending`}
      >
        <p className="text-sm font-medium ct-text-muted">{label}</p>
        <p className="mt-1 text-xs ct-text-dim">
          Document signing is not yet available.
        </p>
        <span
          className={cn(
            "mt-3 inline-flex items-center gap-2 px-3 py-1",
            "rounded-full border border-[var(--ct-status-warning-border)]",
            "ct-status-warning-bg ct-status-warning",
            "text-[length:var(--ct-text-micro)] font-medium uppercase tracking-[var(--ct-tracking-wide)]",
          )}
        >
          <span
            aria-hidden="true"
            className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          />
          Configuration en attente
        </span>
      </div>
    );
  }

  if (state.phase === "done") {
    return (
      <div
        className={cn(
          "rounded-lg border border-[var(--ct-status-success-border)]",
          "ct-status-success-bg px-6 py-10 text-center",
        )}
        role="status"
        aria-live="assertive"
      >
        <p className="text-sm font-semibold ct-status-success">
          Signing complete
        </p>
        <p className="mt-1 text-xs ct-text-muted">
          {label} — document signed successfully.
        </p>
      </div>
    );
  }

  // phase === "ready"
  return (
    <DocusignEmbedded
      envelopeId={state.envelopeId}
      signingUrl={state.signingUrl}
      returnUrl={returnUrl}
      onEvent={handleEvent}
    />
  );
}
