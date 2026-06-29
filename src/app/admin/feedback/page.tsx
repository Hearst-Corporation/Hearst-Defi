import { AdminPageShell, AdminSectionCard, FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { FeedbackForm } from "@/components/admin/feedback-form";
import { FeedbackList } from "@/components/admin/feedback-list";
import { prisma } from "@/lib/db";
import { buildFeedbackKpiStrip } from "@/lib/admin/feedback-kpi-strip";

export const dynamic = "force-dynamic";

export const metadata = { title: "Feedback — Hearst Connect" };

export default async function FeedbackPage() {
  const items = await prisma.feedback.findMany({
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const kpis = buildFeedbackKpiStrip(items);

  return (
    <AdminPageShell
      titleLead="Feedback"
      titleAccent="Review"
      contextLabel="Feedback Review"
    >
      {/* Submit + KPI welded into one card (the /customers "Investor Base" shape). */}
      <AdminSectionCard
        kpis={kpis}
        kpiTitle="Feedback Base"
        kpiSubtitle={`${items.length} ${items.length === 1 ? "entry" : "entries"} logged`}
        title="Submit feedback"
        subtitle="Capture what changed, what feels off, and what should happen next."
        ariaLabel="Submit feedback"
      >
        <div className={FORM_SURFACE}>
          <FeedbackForm />
        </div>
      </AdminSectionCard>

      {/* Feedback log — its own welded section card. */}
      <AdminSectionCard
        title={`Feedback log (${items.length})`}
        subtitle="Most recent first; resolved items sink to the bottom."
        ariaLabel="Feedback log"
      >
        <FeedbackList items={items} />
      </AdminSectionCard>
    </AdminPageShell>
  );
}
