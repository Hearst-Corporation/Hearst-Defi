import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isTotpEnabled } from "@/lib/auth/totp";

import { TotpEnrolmentClient } from "./TotpEnrolmentClient";

import "../admin-proof.css";

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
        titleLead="Security"
        titleAccent="Center"
        contextLabel="Account Security"
      />

      <Card className="max-w-lg">
        <DashboardPanelHeader
          title="Two-factor sign-in (TOTP)"
          tone="quiet"
        />
        <p className="body-xs ct-text-muted security-totp-lead">
          Use an authenticator app (Google Authenticator, Authy, 1Password) to
          generate a time-based code at login. Required once enrolled.
        </p>
        <TotpEnrolmentClient initialEnabled={totpEnabled} />
      </Card>
    </div>
  );
}
