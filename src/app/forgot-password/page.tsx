import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = {
  title: "Forgot password — Hearst Connect",
  description: "Request a password reset link.",
};

/**
 * /forgot-password — initiates the email-based password reset flow.
 *
 * The form is a client component (uses useState/useTransition); the page itself
 * is a plain Server Component wrapper so we get static metadata and no extra
 * bundle weight.
 */
export default function ForgotPasswordPage() {
  return (
    <main
      className="min-h-dvh flex items-center justify-center"
      style={{ background: "var(--ct-bg-deep)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 space-y-6"
        style={{
          background:
            "color-mix(in srgb, var(--ct-surface) 60%, transparent)",
          border: "1px solid var(--ct-border-soft)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Header */}
        <div className="space-y-1">
          <h1
            className="h1"
          >
            Forgot your password?
          </h1>
          <p className="body-xs ct-text-muted">
            Enter your email and we&rsquo;ll send you a reset link valid for 1 hour.
          </p>
        </div>

        <ForgotPasswordForm />
      </div>
    </main>
  );
}
