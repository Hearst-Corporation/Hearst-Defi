import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FeedbackForm } from "@/components/admin/feedback-form";
import { FeedbackList } from "@/components/admin/feedback-list";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
      />

      <Card>
        <CardHeader>
          <CardTitle>Post new</CardTitle>
        </CardHeader>
        <FeedbackForm />
      </Card>

      <section className="admin-doc-stack--actions">
        <h3 className="h3">Latest ({items.length})</h3>
        <FeedbackList items={items} />
      </section>
    </div>
  );
}
