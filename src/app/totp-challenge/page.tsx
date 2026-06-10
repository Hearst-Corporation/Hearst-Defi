export const metadata = {
  title: "Two-factor authentication — Hearst Connect",
};

import { TotpChallengeForm } from "./TotpChallengeForm";

/**
 * /totp-challenge — second factor for admin accounts with TOTP enrolled.
 *
 * Shown after a successful password login when the user has TOTP enabled.
 * The pending state is carried by the `hc_totp_pending` httpOnly cookie
 * (set by the `login` server action, cleared by `verifyTotpChallenge`).
 */
export default function TotpChallengePage() {
  return (
    <main
      className="min-h-dvh flex items-center justify-center"
      style={{ background: "var(--ct-bg-deep)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 space-y-6"
        style={{
          background: "color-mix(in srgb, var(--ct-surface) 60%, transparent)",
          border: "1px solid var(--ct-border-soft)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="space-y-1">
          <h1
            className="h1"
          >
            Two-factor authentication
          </h1>
          <p className="body-xs ct-text-muted">
            Open your authenticator app and enter the 6-digit code.
          </p>
        </div>

        <TotpChallengeForm />
      </div>
    </main>
  );
}
