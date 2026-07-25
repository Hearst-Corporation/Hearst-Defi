import Link from "next/link";

import { ResetPasswordForm } from "@/app/reset-password/ResetPasswordForm";
import { Button } from "@/ui/button";

export function ResetPasswordView({ token }: { token?: string }) {
  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          This reset link is invalid or has expired.
        </p>
        <p className="text-sm text-muted">
          Request a fresh link to continue resetting your password.
        </p>
        <Link href="/forgot-password">
          <Button className="w-full">Request a new link</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Choose a password of at least 8 characters.
      </p>
      <ResetPasswordForm token={token} />
      <p className="text-center text-xs text-subtle">
        For your security, reset links expire after a short window and can only be
        used once.
      </p>
      <p className="text-center text-xs text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
