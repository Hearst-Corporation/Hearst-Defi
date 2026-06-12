// /vaults/[id] — Step 2 of 4: Product details (term sheet preview)
// Server Component. Reads vault by ticker or id. Single vault MVP.
// Non-negotiable #1: APY always range via <ApyRange>.
// Non-negotiable #2: provenance badges grouped — not per KPI row.
// Non-negotiable #5: no forbidden words in any copy.
// Non-negotiable #10: disclaimers + "not guaranteed" present.

import { notFound } from "next/navigation";
import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { getVault } from "@/lib/data/vaults";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepProgress } from "@/components/vaults/step-progress";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Term Sheet — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  review: "In review",
  draft: "Draft",
  paused: "Paused",
  closed: "Closed",
};

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "default" | "danger"
> = {
  live: "success",
  review: "warning",
  draft: "default",
  paused: "warning",
  closed: "danger",
};

function InvestFlowCta({
  isLive,
  investHref,
  layout,
}: {
  isLive: boolean;
  investHref: string;
  layout: "header" | "footer";
}) {
  if (layout === "header") {
    return isLive ? (
      <Button variant="primary" size="md" asChild className="font-bold shrink-0">
        <Link href={investHref}>Continue to deposit</Link>
      </Button>
    ) : (
      <Button variant="secondary" size="md" disabled aria-disabled className="shrink-0">
        Coming soon
      </Button>
    );
  }

  return (
    <section
      aria-label="Invest flow actions"
      className="glass-panel flex flex-col gap-4 rounded-xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="eyebrow ct-text-muted">Next step</p>
        <p className="h4 ct-text-strong mt-1">Ready to subscribe?</p>
        <p className="body-xs ct-text-muted mt-1 max-w-xl">
          Term sheet and regime assumptions reviewed — proceed to deposit when ready.
        </p>
      </div>
      {isLive ? (
        <Button
          variant="primary"
          size="lg"
          asChild
          className="w-full shrink-0 font-bold sm:w-auto"
        >
          <Link href={investHref}>Continue to deposit</Link>
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="lg"
          disabled
          aria-disabled
          className="w-full shrink-0 sm:w-auto"
        >
          Coming soon
        </Button>
      )}
    </section>
  );
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vault = await getVault(id);

  if (!vault) notFound();

  const isLive = vault.status === "live";
  const investHref = `/vaults/${id}/invest`;

  return (
    <div className="space-y-8 pb-4">
      <ProductPageHeader
        lead={
          <Link
            href="/vaults"
            className="body-sm ct-text-muted transition-opacity hover:opacity-80"
            aria-label="Back to product list"
          >
            ← Products
          </Link>
        }
        eyebrow="Invest · Step 2 of 4"
        title={vault.name}
        actions={
          <>
            <span className="ct-pill accent mono eyebrow">{vault.ticker}</span>
            <Badge variant={STATUS_VARIANT[vault.status] ?? "default"}>
              {STATUS_LABEL[vault.status] ?? vault.status}
            </Badge>
            <InvestFlowCta
              isLive={isLive}
              investHref={investHref}
              layout="header"
            />
          </>
        }
      >
        <div className="pt-2">
          <StepProgress active="product" />
        </div>
      </ProductPageHeader>

      <TermSheetPreview vault={vault} />

      <InvestFlowCta isLive={isLive} investHref={investHref} layout="footer" />

      <footer className="border-t border-[var(--ct-border-soft)] pt-6">
        <div
          role="note"
          aria-label="Important disclaimers"
          className="max-w-3xl space-y-3"
        >
          <p className="body-sm ct-text-muted leading-relaxed">
            {vault.disclaimers}
          </p>
          <p className="body-xs ct-text-faint leading-relaxed">
            APY ranges are target projections based on stated assumptions — they
            are not a projection of future returns and are subject to change
            without notice. Past performance does not indicate future results.
            Allocations shown are targets and may deviate. This document is
            informational only and does not constitute an offer or solicitation
            where prohibited by law.
          </p>
        </div>
      </footer>
    </div>
  );
}
