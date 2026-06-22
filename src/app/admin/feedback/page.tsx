import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FeedbackForm } from "@/components/admin/feedback-form";
import { FeedbackList } from "@/components/admin/feedback-list";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { buildFeedbackKpiStrip } from "@/lib/admin/feedback-kpi-strip";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const items = await prisma.feedback.findMany({
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const kpis = buildFeedbackKpiStrip(items);

  return (
    <>
      <AdminPageHeader
        titleLead="Feedback"
        titleAccent="Review"
        contextLabel="Feedback Review"
      />

      {kpis.length > 0 && <AdminKpiStripPanel kpis={kpis} />}

      <section className="admin-doc-stack admin-doc-stack--actions">
        <h2 className="h2">Submit feedback</h2>
        <Card hoverOverlay={false}>
          <FeedbackForm />
        </Card>
      </section>

      <section className="admin-doc-stack admin-doc-stack--actions">
        <h2 className="h2">Feedback log ({items.length})</h2>
        <FeedbackList items={items} />
      </section>
    </>
  );
}
