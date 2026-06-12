import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/system-panel";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isTotpEnabled } from "@/lib/auth/totp";

import { TotpEnrolmentClient } from "./TotpEnrolmentClient";

export const metadata = {
  title: "Account security — Hearst Connect",
};

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const { userId } = await requireAdmin();
  const totpEnabled = await isTotpEnabled(userId);

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Security"
        description="Manage two-factor authentication and session security."
      />

      <Card className="max-w-lg">
        <DashboardPanelHeader
          title="Two-factor authentication (TOTP)"
          tone="quiet"
        />
        <p className="body-xs ct-text-muted mb-4">
          Use an authenticator app (Google Authenticator, Authy, 1Password) to
          generate a time-based code at login. Required once enrolled.
        </p>
        <TotpEnrolmentClient initialEnabled={totpEnabled} />
      </Card>
    </div>
  );
}
