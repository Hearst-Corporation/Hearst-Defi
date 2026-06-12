import { notFound } from "next/navigation";
import Link from "next/link";

import { getVault } from "@/lib/data/vaults";
import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";
import {
  VAULT_STATUS_VARIANT,
  vaultStatusLabel,
} from "@/lib/constants/vault";
import { formatMinTicketUsdc } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Term Sheet — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function InvestCta({
  isLive,
  investHref,
  size = "md",
  className,
}: {
  isLive: boolean;
  investHref: string;
  size?: "md" | "lg";
  className?: string;
}) {
  if (isLive) {
    return (
      <Button variant="primary" size={size} asChild className={className}>
        <Link href={investHref}>Continue to deposit</Link>
      </Button>
    );
  }

  return (
    <Button variant="secondary" size={size} disabled aria-disabled className={className}>
      Coming soon
    </Button>
  );
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vault = await getVault(id);

  if (!vault) notFound();

  const isLive = vault.status === "live";
  const investHref = `/vaults/${id}/invest`;

  return (
    <InvestFlowShell
      step="product"
      title={vault.name}
      description={
        <span className="line-clamp-2 max-w-2xl">{vault.description}</span>
      }
      lead={
        <Link
          href="/vaults"
          className="body-sm ct-text-muted transition-opacity hover:opacity-80"
          aria-label="Back to product list"
        >
          ← Products
        </Link>
      }
      actions={
        <>
          <span className="ct-pill accent mono eyebrow">{vault.ticker}</span>
          <Badge variant={VAULT_STATUS_VARIANT[vault.status]}>
            {vaultStatusLabel(vault.status)}
          </Badge>
          <InvestCta
            isLive={isLive}
            investHref={investHref}
            className="hidden shrink-0 font-bold sm:inline-flex"
          />
        </>
      }
      headerBelowStepper={
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8">
          <div>
            <dt className="stat-label">Target APY</dt>
            <dd className="h4 mt-0.5">
              <ApyRange low={vault.apyLow} high={vault.apyHigh} precision={1} />
            </dd>
          </div>
          <div>
            <dt className="stat-label">Min subscription</dt>
            <dd className="h4 tabular mono ct-text-strong mt-0.5">
              {formatMinTicketUsdc(vault.minTicketUsdc)}
            </dd>
          </div>
          <div>
            <dt className="stat-label">Soft lock-up</dt>
            <dd className="h4 tabular mono ct-text-strong mt-0.5">
              {vault.softLockupDays} days
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1 sm:hidden">
            <InvestCta
              isLive={isLive}
              investHref={investHref}
              className="w-full font-bold"
            />
          </div>
        </dl>
      }
      footer={
        <>
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="body-xs ct-text-muted max-w-md">
              Review complete? Proceed to deposit — term sheet acknowledgement
              required on the next step.
            </p>
            <InvestCta
              isLive={isLive}
              investHref={investHref}
              size="lg"
              className="w-full shrink-0 font-bold sm:w-auto"
            />
          </div>
        </>
      }
    >
      <TermSheetPreview vault={vault} />
    </InvestFlowShell>
  );
}
