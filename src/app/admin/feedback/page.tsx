import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FeedbackForm } from "@/components/admin/feedback-form";
import { FeedbackList } from "@/components/admin/feedback-list";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { BentoPanel, BentoHeader } from "@/components/ui/bento";
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Feedback"
          titleAccent="Review"
          contextLabel="Feedback Review"
        />

        {kpis.length > 0 && <AdminKpiStripPanel kpis={kpis} />}

        <BentoPanel aria-label="Submit feedback">
          <BentoHeader
            title="Submit feedback"
            subtitle="Capture what changed, what feels off, and what should happen next."
          />
          <div className="p-5 lg:p-6">
            <FeedbackForm />
          </div>
        </BentoPanel>

        <BentoPanel aria-label="Feedback log">
          <BentoHeader title={`Feedback log (${items.length})`} />
          <FeedbackList items={items} />
        </BentoPanel>
      </div>
    </div>
  );
}
