import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = {
  title: "Forgot password — Hearst Connect",
  description: "Request a password reset link.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFormShell
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link valid for 1 hour."
    >
      <ForgotPasswordForm />
    </AuthFormShell>
  );
}
