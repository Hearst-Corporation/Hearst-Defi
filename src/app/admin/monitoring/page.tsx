import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { MonitoringBoard } from "@/components/admin/monitoring/monitoring-board";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getMonitoringStats } from "@/lib/data/monitoring";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  await requireAdmin();
  const stats = await getMonitoringStats();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader title="Monitoring" />
      <MonitoringBoard stats={stats} />
    </div>
  );
}
