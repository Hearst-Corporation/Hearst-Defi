import { notFound } from "next/navigation";

import { loadPosition } from "@/lib/data/portfolio";
import { PositionDetailView } from "@/views/investor/position-detail-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Position — Series 1 Reserve Vault" };

interface PageProps {
  params: Promise<{ positionId: string }>;
}

export default async function PositionPage({ params }: PageProps) {
  const { positionId } = await params;
  const position = await loadPosition(positionId);
  if (!position) notFound();

  return <PositionDetailView position={position} />;
}
