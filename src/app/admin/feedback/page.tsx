import { prisma } from "@/lib/db";
import { AdminFeedbackView } from "@/views/admin/feedback-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Feedback — Hearst Connect" };

export default async function FeedbackPage() {
  const items = await prisma.feedback.findMany({
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return <AdminFeedbackView items={items} />;
}
