export const metadata = {
  title: "Two-factor authentication — Hearst Connect",
};

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { TotpChallengeForm } from "./TotpChallengeForm";

export default function TotpChallengePage() {
  return (
    <AuthFormShell
      title="Two-factor authentication"
      description="Open your authenticator app and enter the 6-digit code."
    >
      <TotpChallengeForm />
    </AuthFormShell>
  );
}
