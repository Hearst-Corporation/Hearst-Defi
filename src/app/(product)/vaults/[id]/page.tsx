import { notFound } from "next/navigation";
import Link from "next/link";

import { getVault, type VaultProduct } from "@/lib/data/vaults";
import { Button } from "@/components/catalyst/button";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";
import { VaultChainReadout } from "@/components/vaults/vault-chain-readout";
import { vaultStatusLabel } from "@/lib/constants/vault";
import { cn } from "@/lib/cn";
import { CATALYST_ACCENT_BTN } from "@/lib/ui/catalyst-accent";
import { investDepositPath, INVEST_SELECT_PATH } from "@/lib/vaults/invest-routes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Term Sheet — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Honest one-liner for why a non-live product can't take deposits yet. */
function nonLiveNote(status: VaultProduct["status"]): string {
  switch (status) {
    case "review":
      return "In review — subscriptions open once this product goes live.";
    case "draft":
      return "Not yet open for subscriptions.";
    case "paused":
      return "Subscriptions are temporarily paused.";
    case "closed":
      return "Closed to new capital.";
    default:
      return "";
  }
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vault = await getVault(id);

  if (!vault) notFound();

  const isLive = vault.status === "live";
  const investHref = investDepositPath(id);

  const nameParts = vault.name.trim().split(/\s+/);
  const titleAccent = nameParts.length > 1 ? nameParts.pop() : vault.name;
  const titleLead = nameParts.length ? nameParts.join(" ") : undefined;

  return (
    <InvestFlowShell
      step="product"
      workspace
      titleLead={titleLead}
      titleAccent={titleAccent}
      contextLabel={`Vault Detail · ${vault.ticker}`}
      lead={
        <Link
          href={INVEST_SELECT_PATH}
          className="body-sm ct-link-accent"
          aria-label="Back to product list"
        >
          ← Products
        </Link>
      }
    >
      {/* NEXT ACTION — slim CTA bar (the term sheet below carries the numbers) */}
      <section
        role="region"
        aria-label="Next action"
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] p-5"
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          <span
            className={cn(
              "ct-bento-label inline-flex items-center gap-2",
              isLive ? "text-[var(--ct-accent)]" : "text-[var(--ct-text-muted)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                isLive ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]",
              )}
            />
            {vault.ticker} · {vaultStatusLabel(vault.status)}
          </span>
          <p className="ct-metric-caption">
            {isLive
              ? "Next: confirm your ticket and funding details. No funds move yet."
              : nonLiveNote(vault.status)}
          </p>
        </div>

        {isLive ? (
          <Button href={investHref} className={cn("shrink-0", CATALYST_ACCENT_BTN)}>
            Continue to deposit
          </Button>
        ) : (
          <Button href={INVEST_SELECT_PATH} outline className="shrink-0">
            Browse other products
          </Button>
        )}
      </section>

      {/* ON-CHAIN STATE — what the contract actually returns, in blue, with the
          snapshot aggregate on the line below it. Sits ABOVE the term sheet on
          purpose: the base↔chain gap should not need a scroll to be seen. The
          term sheet below is untouched and keeps its own "estimated" sourcing. */}
      <VaultChainReadout dbAumUsdc={vault.currentAumUsdc} />

      <TermSheetPreview vault={vault} />
    </InvestFlowShell>
  );
}
