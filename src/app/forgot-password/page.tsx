import { RESET_TOKEN_TTL_MS } from "@/lib/auth/password-reset";
import { AuthFormShell } from "@/views/auth/auth-form-shell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = {
  title: "Forgot password — Hearst Connect",
  description: "Request a password reset link.",
};

const ttlHours = RESET_TOKEN_TTL_MS / 3_600_000;
const ttlLabel = `${ttlHours} hour${ttlHours === 1 ? "" : "s"}`;

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell
      title="Forgot your password?"
      description={`Enter your email and we'll send you a reset link valid for ${ttlLabel}.`}
    >
      <ForgotPasswordForm />
    </AuthFormShell>
  );
}
