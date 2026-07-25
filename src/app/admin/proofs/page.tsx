import { prisma } from "@/lib/db";
import { AdminProofsView } from "@/views/admin/proofs-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proofs — Hearst Connect",
};

export default async function ProofsPage() {
  const items = await prisma.proof.findMany({
    orderBy: { postedAt: "desc" },
    take: 200,
  });

  return <AdminProofsView items={items} />;
}
