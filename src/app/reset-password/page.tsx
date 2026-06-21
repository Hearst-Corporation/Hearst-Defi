import Link from "next/link";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { EmptySurface } from "@/components/ui/empty-surface";
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
        <EmptySurface
          variant="widget"
          message="This reset link is invalid or has expired."
          detail="Request a fresh link to continue resetting your password."
          className="min-h-32"
          ariaLabel="Reset link unavailable"
        >
          <Link
            href="/forgot-password"
            className="body-xs ct-text-primary underline underline-offset-2 mt-[var(--ct-space-1)]"
          >
            Request a new link
          </Link>
        </EmptySurface>
      )}
    </AuthFormShell>
  );
}
