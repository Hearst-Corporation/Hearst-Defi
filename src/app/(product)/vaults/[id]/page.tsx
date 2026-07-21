import { notFound } from "next/navigation";
import Link from "next/link";

import { getVault, type VaultProduct } from "@/lib/data/vaults";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";
import { VaultChainReadout } from "@/components/vaults/vault-chain-readout";
import { BtcCompositionPanel } from "@/app/(product)/btc/_components/btc-composition-panel";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";
import { vaultStatusLabel } from "@/lib/constants/vault";
import { cn } from "@/lib/cn";
import { investDepositPath, INVEST_SELECT_PATH } from "@/lib/vaults/invest-routes";

// Series 1 pocket allocation (B1/B2/B3) derived from the vault's own target
// basis points — the three on-chain pockets capital flows into. actualBps stays
// null: the on-chain split is NOT yet indexed per vault, so the donut shows the
// product TARGET (labelled as such) and never a fabricated "actual" split.
// B3 folds the operating/stable reserve legs into the single Reserve USDC pocket.
function toSeries1Pockets(vault: VaultProduct): readonly AllocationPocketViewModel[] {
  return [
    { pocket: "B1", label: "Mining Power", targetBps: vault.targetMiningBps, actualBps: null },
    { pocket: "B2", label: "BTC Pouch", targetBps: vault.targetBtcTacticalBps, actualBps: null },
    {
      pocket: "B3",
      label: "Reserve USDC",
      targetBps: vault.targetStableReserveBps + vault.targetUsdcBaseBps,
      actualBps: null,
    },
  ];
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Term Sheet — Series 1 Reserve Vault",
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
          className="body-sm ct-link-accent -m-2 inline-flex min-h-11 items-center p-2"
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
          <CockpitButton href={investHref} variant="primary" shape="rect" size="lg" className="shrink-0">
            Continue to deposit
          </CockpitButton>
        ) : (
          <CockpitButton href={INVEST_SELECT_PATH} variant="outline" shape="rect" size="lg" className="shrink-0">
            Browse other products
          </CockpitButton>
        )}
      </section>

      {/* ON-CHAIN STATE — what the contract actually returns, in blue, with the
          snapshot aggregate on the line below it. Sits ABOVE the term sheet on
          purpose: the base↔chain gap should not need a scroll to be seen. The
          term sheet below is untouched and keeps its own "estimated" sourcing. */}
      <VaultChainReadout dbAumUsdc={vault.currentAumUsdc} />

      {/* CAPITAL DESTINATION — the three Series 1 pockets (B1 Mining Power /
          B2 BTC Pouch / B3 Reserve USDC, 40/27/33) capital flows into. Visual
          companion to the term-sheet allocation LIST below. Shows the product
          TARGET split (actualBps null → not yet indexed on-chain), covered by a
          "simulated" provenance badge. No accumulated-BTC figure at product
          stage → the centre shows an honest em dash. */}
      <BtcCompositionPanel
        pockets={toSeries1Pockets(vault)}
        totalBtc={null}
        provenance="simulated"
      />

      <TermSheetPreview vault={vault} />
    </InvestFlowShell>
  );
}
