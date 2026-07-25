import { loadDashboardPageData } from "@/app/(product)/dashboard/_data/dashboard-loader";
import { DashboardView } from "@/views/dashboard/dashboard-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview · Hearst Bitcoin Reserve Vault — Series 1",
};

export default async function DashboardPage() {
  const data = await loadDashboardPageData();
  return <DashboardView data={data} />;
}
