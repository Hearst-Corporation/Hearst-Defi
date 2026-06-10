import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isTotpEnabled } from "@/lib/auth/totp";
import { TotpEnrolmentClient } from "./TotpEnrolmentClient";

export const metadata = {
  title: "Account security — Hearst Connect",
};

export const dynamic = "force-dynamic";

/**
 * /admin/security — admin account security settings.
 *
 * Currently surfaces TOTP MFA enrolment. More security controls
 * (session management, audit log) can be added here later.
 */
export default async function AdminSecurityPage() {
  const { userId } = await requireAdmin();
  const totpEnabled = await isTotpEnabled(userId);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Account security"
        description="Manage two-factor authentication and session security."
      />

      {/* MFA card */}
      <section className="ct-card p-6 space-y-4 max-w-lg">
        <div className="space-y-1">
          <h2 className="h2">Two-factor authentication (TOTP)</h2>
          <p className="body-xs ct-text-muted">
            Use an authenticator app (Google Authenticator, Authy, 1Password) to
            generate a time-based code at login. Required once enrolled.
          </p>
        </div>

        <TotpEnrolmentClient initialEnabled={totpEnabled} />
      </section>
    </div>
  );
}
