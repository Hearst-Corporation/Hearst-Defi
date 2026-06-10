// /vaults/[id] — Step 2 of 4: Product details (term sheet preview)
// Server Component. Reads vault by ticker or id. Single vault MVP.
// Non-negotiable #1: APY always range via <ApyRange>.
// Non-negotiable #2: provenance badges on every KPI.
// Non-negotiable #5: no forbidden words in any copy.
// Non-negotiable #9: single vault — no multi-vault UI abstractions.
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

// Next.js 16 App Router — params is a Promise
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

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vault = await getVault(id);

  if (!vault) notFound();

  const isLive = vault.status === "live";
  const investHref = `/vaults/${id}/invest`;

  return (
    <div className="space-y-8">
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
        eyebrow="Invest"
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="stat-label">Target APY range</span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <span className="stat-value">
            <ApyRange low={vault.apyLow} high={vault.apyHigh} precision={1} />
          </span>
        </div>
        <div className="pt-1">
          <StepProgress active="product" />
        </div>
      </ProductPageHeader>

      {/* Term sheet sections */}
      <TermSheetPreview vault={vault} />

      {/* Dynamic allocation cards — Bull / Sideways / Bear from methodology v1.0 */}
      <section aria-labelledby="sec-regimes">
        <h2 id="sec-regimes" className="h2 mb-4">
          Dynamic allocation — market regimes
        </h2>
        <p className="body-sm ct-text-muted mb-6 max-w-2xl">
          The rule engine adjusts sleeve weights in response to market signals
          without discretionary override. Allocations below reflect target
          postures under each regime, derived from Methodology v1.0.
          APY ranges are conditional on stated assumptions — not a projection.
        </p>
        <DynamicAllocationCards />
      </section>

      {/* Sticky CTA footer — single compact row pinned to the scroll
          container (.ct-page-area). OPAQUE surface + strong border + elevated
          shadow + bottom-bar z-index so scrolling content never shows through
          (was a translucent glass <Card> that overlapped — fixed). */}
      <nav
        aria-label="Invest flow actions"
        className="sticky bottom-6 z-[var(--ct-z-bottom-bar)] flex items-center justify-between gap-4 rounded-lg border border-[var(--ct-border-strong)] bg-[var(--ct-bg-deep)] px-5 py-3 shadow-[var(--ct-shadow-elevated)]"
      >
        <div className="flex min-w-0 items-center gap-2 flex-wrap">
          <span className="body-sm font-semibold ct-text-primary truncate">
            {vault.name}
          </span>
          <span className="body-xs ct-text-faint">·</span>
          <ApyRange
            low={vault.apyLow}
            high={vault.apyHigh}
            precision={1}
            className="body-sm mono"
          />
          <span className="body-xs ct-text-faint">·</span>
          <span className="body-xs ct-text-muted whitespace-nowrap">
            Min. ${(vault.minTicketUsdc / 1000).toFixed(0)}k ·{" "}
            {vault.softLockupDays}d lock-up
          </span>
        </div>

        {isLive ? (
          <Button variant="primary" size="md" asChild className="font-bold shrink-0">
            <Link href={investHref}>Continue → Deposit</Link>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="md"
            disabled
            aria-disabled
            className="shrink-0"
          >
            Coming soon
          </Button>
        )}
      </nav>

      {/* Final disclaimer (#10 — "not guaranteed" mandatory) */}
      <footer>
        <p className="body-xs ct-text-faint max-w-3xl">
          {vault.disclaimers} APY ranges are target projections — they are not
          a projection of future returns and are subject to change without
          notice.
        </p>
      </footer>
    </div>
  );
}
