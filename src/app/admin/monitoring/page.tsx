import { getMonitoringStats } from "@/lib/data/monitoring";
import { AdminMonitoringView } from "@/views/admin/monitoring-view";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const stats = await getMonitoringStats();
  return <AdminMonitoringView stats={stats} />;
}
