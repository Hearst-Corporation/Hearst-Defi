import { prisma } from "@/lib/db";
import { AdminFeedbackView } from "@/views/admin/feedback-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Feedback — Hearst Connect" };

/** Cap on the rendered log window — declared in the view ("Showing X of Y"). */
const LOG_WINDOW = 100;

export default async function FeedbackPage() {
  // The table is a capped window; the KPI aggregates are REAL whole-table
  // counts (no take) so the strip never presents the window as the total.
  const [items, total, resolved, linkedToRoadmap] = await Promise.all([
    prisma.feedback.findMany({
      orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
      take: LOG_WINDOW,
    }),
    prisma.feedback.count(),
    prisma.feedback.count({ where: { resolved: true } }),
    prisma.feedback.count({ where: { itemId: { not: null } } }),
  ]);

  return (
    <AdminFeedbackView
      items={items}
      totals={{ total, resolved, linkedToRoadmap }}
    />
  );
}
