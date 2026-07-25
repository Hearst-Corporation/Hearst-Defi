import { notFound } from "next/navigation";

import { loadCustomerDetail } from "@/lib/data/customer-detail";
import { loadActiveTemplates } from "@/lib/data/agent-templates";
import { AdminCustomerDetailView } from "@/views/admin/customer-detail-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Customer — Hearst Connect" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, templates] = await Promise.all([
    loadCustomerDetail(id),
    loadActiveTemplates(),
  ]);
  if (!detail) notFound();

  return <AdminCustomerDetailView detail={detail} templates={templates} />;
}
