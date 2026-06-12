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
import { ApyRange } from "@/components/ui/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { StepProgress } from "@/components/vaults/step-progress";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";
import { DynamicAllocationCards } from "@/components/vaults/dynamic-allocation-cards";

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

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 0,
});

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vault = await getVault(id);

  if (!vault) notFound();

  const isLive = vault.status === "live";
  const investHref = `/vaults/${id}/invest`;

  return (
    <div className="space-y-10 pb-4">
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
          </>
        }
      >
        {/* Hero metrics — synthesis, not a compliance grid */}
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="stat-label">Target APY range</span>
                <ProvenanceBadge kind="estimated" />
              </div>
              <ApyRange
                low={vault.apyLow}
                high={vault.apyHigh}
                precision={1}
                className="stat-value"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="stat-label">Min. ticket</span>
              <span className="tabular text-lg font-semibold ct-text-strong">
                {USD_COMPACT.format(vault.minTicketUsdc)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="stat-label">Soft lock-up</span>
              <span className="tabular text-lg font-semibold ct-text-strong">
                {vault.softLockupDays}d
              </span>
            </div>
          </div>
          <StepProgress active="product" />
        </div>
      </ProductPageHeader>

      <TermSheetPreview vault={vault} />

      <section aria-labelledby="sec-regimes" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="sec-regimes" className="h2">
              Market regimes
            </h2>
            <p className="body-sm ct-text-muted mt-2 max-w-2xl">
              Target postures under Bull, Sideways, and Bear scenarios from
              Methodology v1.0. APY ranges are conditional — not a projection.
            </p>
          </div>
          <p className="body-xs ct-text-faint flex items-center gap-1.5">
            <span>Scenarios:</span>
            <ProvenanceBadge kind="estimated" />
          </p>
        </div>
        <DynamicAllocationCards />
      </section>

      {/* Sticky CTA — calm, action-focused */}
      <nav
        aria-label="Invest flow actions"
        className="sticky bottom-6 z-(--ct-z-bottom-bar) flex items-center justify-between gap-4 rounded-lg border border-(--ct-border-soft) bg-(--ct-bg-deep)/95 backdrop-blur-sm px-5 py-3"
      >
        <p className="body-sm ct-text-muted min-w-0 truncate hidden sm:block">
          Ready to subscribe?
        </p>

        {isLive ? (
          <Button
            variant="primary"
            size="md"
            asChild
            className="font-bold w-full sm:w-auto sm:shrink-0 sm:ml-auto"
          >
            <Link href={investHref}>Continue to deposit</Link>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="md"
            disabled
            aria-disabled
            className="w-full sm:w-auto sm:shrink-0 sm:ml-auto"
          >
            Coming soon
          </Button>
        )}
      </nav>

      <footer>
        <p className="body-xs ct-text-faint max-w-3xl">
          {vault.disclaimers} APY ranges are target projections — they are not a
          projection of future returns and are subject to change without notice.
        </p>
      </footer>
    </div>
  );
}
