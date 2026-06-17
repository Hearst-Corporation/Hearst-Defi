import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FeedbackForm } from "@/components/admin/feedback-form";
import { FeedbackList } from "@/components/admin/feedback-list";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  await requireAdmin();
  const items = await prisma.feedback.findMany({
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Feedback"
        description="Capture product feedback, triage open items, and keep resolved notes visible for review."
      />

      <section className="admin-doc-stack admin-doc-stack--actions">
        <h2 className="h2">Log new feedback</h2>
        <Card hoverOverlay={false}>
          <FeedbackForm />
        </Card>
      </section>

      <section className="admin-doc-stack admin-doc-stack--actions">
        <h2 className="h2">Latest entries ({items.length})</h2>
        <FeedbackList items={items} />
      </section>
    </div>
  );
}
