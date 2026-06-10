import Link from "next/link";

import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = {
  title: "Reset password — Hearst Connect",
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

/**
 * /reset-password?token=<raw>
 *
 * Server Component that reads the token from the URL and renders either a
 * password-reset form or a "invalid link" state.  Token validation happens
 * at submit time (in the server action) — we do not pre-validate here to
 * avoid leaking timing information about token existence.
 */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

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
            Set a new password
          </h1>
          <p className="body-xs ct-text-muted">
            Choose a password of at least 8 characters.
          </p>
        </div>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <p className="ct-status-danger body-xs">
              Invalid or missing reset token. Please request a new link.
            </p>
            <Link
              href="/forgot-password"
              className="body-xs ct-accent hover:underline"
            >
              Request a new reset link →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
