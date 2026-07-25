import { requireAdmin } from "@/lib/auth/require-admin";
import { isTotpEnabled } from "@/lib/auth/totp";
import { AdminSecurityView } from "@/views/admin/security-view";

export const metadata = {
  title: "Account security — Hearst Connect",
};

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const { userId } = await requireAdmin();
  const totpEnabled = await isTotpEnabled(userId);

  return <AdminSecurityView totpEnabled={totpEnabled} />;
}
