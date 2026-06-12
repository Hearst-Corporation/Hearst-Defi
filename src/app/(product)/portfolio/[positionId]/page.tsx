// /portfolio/[positionId] — Position detail page
// Server Component. Loads position via loadPosition() from lib/data/portfolio.
// Non-negotiable #1: APY range via <ApyRange>.
// Non-negotiable #2: ProvenanceBadge on every metric.
// Non-negotiable #5: no forbidden words in copy.
// Non-negotiable #10: "not guaranteed" disclaimer present.

import { notFound } from "next/navigation";
import { loadPosition } from "@/lib/data/portfolio";
import { PositionHeader } from "@/components/portfolio/position-header";
import { PositionKpis } from "@/components/portfolio/position-kpis";
import { PositionActions } from "@/components/portfolio/position-actions";
import { PositionTransactions } from "@/components/portfolio/position-transactions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ positionId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { positionId } = await params;
  return {
    title: `Position ${positionId.slice(0, 8)} — Hearst Yield Vault`,
  };
}

export default async function PositionDetailPage({ params }: PageProps) {
  const { positionId } = await params;

  const position = await loadPosition(positionId);
  if (!position) notFound();

  return (
    <div className="position-detail-shell product-doc-shell product-doc-shell--cap">
      <PositionHeader position={position} />
      <PositionKpis position={position} />
      <PositionActions position={position} />
      <PositionTransactions transactions={position.transactions} source={position.source} />

      {/* Disclaimer — non-negotiable #10 */}
      <footer className="product-doc-footer-rule">
        <p className="position-detail-disclaimer body-xs ct-text-faint">
          APY ranges are target projections based on stated assumptions — they are
          not a commitment of future returns. Accrued yield figures are indicative
          and subject to change based on vault conditions and Methodology v1.0.
          Past performance does not predict future results.
        </p>
      </footer>
    </div>
  );
}
