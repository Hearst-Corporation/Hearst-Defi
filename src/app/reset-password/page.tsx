import Link from "next/link";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { ResetPasswordForm } from "./ResetPasswordForm";

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
      description="Choose a password of at least 8 characters."
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="body-xs ct-status-danger">
            This reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="body-xs ct-text-primary underline underline-offset-2"
          >
            Request a new link
          </Link>
        </div>
      )}
    </AuthFormShell>
  );
}
