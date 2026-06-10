// /vaults/[id]/invest — Step 3 of 4: Deposit
// Server Component. Reads vault from Prisma. Guards non-live vaults.
// Non-negotiable #1: APY range displayed via <ApyRange> inside InvestForm.
// Non-negotiable #3: PTAI projection mandatory — delegated to InvestForm.
// Non-negotiable #5: no forbidden words in any copy.
// Non-negotiable #10: disclaimer present in InvestForm and DepositSummary.

import { notFound } from "next/navigation";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { getVault } from "@/lib/data/vaults";
import { StepProgress } from "@/components/vaults/step-progress";
import { InvestForm } from "@/components/vaults/invest-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deposit — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvestPage({ params }: PageProps) {
  const { id } = await params;
  const vault = await getVault(id);

  if (!vault) notFound();
  // Only live vaults accept deposits
  if (vault.status !== "live") notFound();

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      <ProductPageHeader eyebrow="Deposit" title={vault.name} className="gap-3">
        <StepProgress active="deposit" />
      </ProductPageHeader>

      {/* Deposit form (Client Component) */}
      <InvestForm vault={vault} />

      {/* Footer disclaimer — mandatory #10 */}
      <footer>
        <p className="body-xs ct-text-faint max-w-3xl">
          {vault.disclaimers} APY ranges are target projections based on
          stated assumptions — they are not a projection of future returns
          and are subject to change without notice. Subject to minimum
          subscription of ${(vault.minTicketUsdc / 1_000).toFixed(0)}k,
          {vault.softLockupDays}-day soft lock-up, and jurisdictional
          restrictions. Methodology v1.0.
        </p>
      </footer>
    </div>
  );
}
