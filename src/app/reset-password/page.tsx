import { AuthFormShell } from "@/views/auth/auth-form-shell";
import { ResetPasswordView } from "@/views/auth/reset-password-view";

export const metadata = {
  title: "Reset password — Hearst Connect",
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <AuthFormShell
      title="Set a new password"
      description={
        token
          ? "Choose a password of at least 8 characters."
          : "This reset link is invalid or has expired."
      }
    >
      <ResetPasswordView token={token} />
    </AuthFormShell>
  );
}
