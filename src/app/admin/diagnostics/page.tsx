import { AdminDiagnosticsView } from "@/views/admin/diagnostics-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Diagnostics — Hearst Connect" };

export default function AdminDiagnosticsPage() {
  return <AdminDiagnosticsView />;
}
