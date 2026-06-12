"use client";

/**
 * Client component for TOTP enrolment.
 *
 * Renders a two-step flow:
 *  Step 1 — "Enable MFA" button → server action generates QR + secret.
 *  Step 2 — display QR, allow manual secret copy, input field for first code.
 *  Step 3 — success confirmation.
 *
 * The QR data-URL never leaves the client after rendering — it is not
 * persisted, not sent to any API. The encrypted secret is written to DB
 * only after the first valid code is verified in the server action.
 */

import { useState, useTransition } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { startEnrolment, confirmEnrolment } from "./actions";
import type { TotpEnrolmentPayload } from "@/lib/auth/totp";

interface Props {
  initialEnabled: boolean;
}

type UIState =
  | { phase: "idle" }
  | { phase: "pending"; payload: TotpEnrolmentPayload }
  | { phase: "success" };

export function TotpEnrolmentClient({ initialEnabled }: Props) {
  const [state, setState] = useState<UIState>({ phase: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [totpEnabled, setTotpEnabled] = useState(initialEnabled);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const payload = await startEnrolment();
      setState({ phase: "pending", payload });
    });
  }

  function handleConfirm(formData: FormData) {
    if (state.phase !== "pending") return;
    formData.set("secretBase32", state.payload.secretBase32);
    setError(null);
    startTransition(async () => {
      const result = await confirmEnrolment(formData);
      if (result.ok) {
        setState({ phase: "success" });
        setTotpEnabled(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (state.phase === "success") {
    return (
      <div className="admin-doc-stack--tight">
        <p className="body-xs ct-text-accent">
          Two-factor authentication is now enabled. Your next login will require a TOTP code.
        </p>
      </div>
    );
  }

  if (state.phase === "pending") {
    return (
      <div className="admin-doc-stack">
        <div className="admin-doc-stack--tight">
          <p className="body-xs ct-text-muted">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.),
            then enter the 6-digit code below to complete setup.
          </p>

          {/* QR code — radius/padding from tokens; the light background is a
              technical requirement: a QR needs a light field behind its dark
              modules to stay scannable, and the dark theme has no light surface
              token, so #fff is the one justified exception here. */}
          <div className="flex justify-center">
            <Image
              src={state.payload.qrDataUrl}
              alt="TOTP QR code — scan with your authenticator app"
              width={200}
              height={200}
              unoptimized
              className="rounded-sm ct-surface-1 p-2"
            />
          </div>

          {/* Manual entry fallback */}
          <details className="body-xs ct-text-muted">
            <summary className="cursor-pointer select-none hover:underline ct-text-accent">
              Can&apos;t scan? Enter the key manually
            </summary>
            <p
              className="mono mt-2 break-all rounded ct-surface-1 px-2 py-1 select-all"
            >
              {state.payload.secretBase32}
            </p>
          </details>
        </div>

        <form action={handleConfirm} className="admin-doc-stack--relaxed">
          <label className="block" htmlFor="totp-code">
            <span className="mb-1 block stat-label">
              Verification code
            </span>
            <input
              id="totp-code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              required
              disabled={isPending}
              placeholder="123456"
              className="ct-input ct-input-bare ct-input-otp"
            />
          </label>

          {error ? (
            <p className="ct-status-danger body-xs" role="alert">
              {error}
            </p>
          ) : null}

          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? "Verifying…" : "Activate MFA"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={isPending}
              onClick={() => setState({ phase: "idle" })}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // phase === "idle"
  return (
    <div className="admin-doc-stack--relaxed">
      {totpEnabled ? (
        <div className="admin-doc-inline-row">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--ct-accent)]" />
          <span className="body-xs ct-text-accent">
            MFA is enabled for this account.
          </span>
        </div>
      ) : (
        <>
          <div className="admin-doc-inline-row">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--ct-status-warning)]" />
            <span className="body-xs ct-text-muted">
              MFA is not yet enabled. We recommend enabling it for admin accounts.
            </span>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isPending}
            aria-busy={isPending}
            onClick={handleStart}
          >
            {isPending ? "Generating…" : "Enable MFA (TOTP)"}
          </Button>
        </>
      )}
    </div>
  );
}
