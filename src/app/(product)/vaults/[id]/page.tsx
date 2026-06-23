import { notFound } from "next/navigation";
import Link from "next/link";

import { getVault, type VaultProduct } from "@/lib/data/vaults";
import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/ui/button";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";
import { formatMinTicketUsdc } from "@/lib/vaults/product-display";
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

  // Non-live: never leave the term sheet actionless. The status badge already
  // says *why* deposit is unavailable; this is the forward route out.
  return (
    <Button variant="secondary" size={size} asChild className={className}>
      <Link href={INVEST_SELECT_PATH}>Browse other products</Link>
    </Button>
  );
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vault = await getVault(id);

  if (!vault) notFound();

  const isLive = vault.status === "live";
  const investHref = investDepositPath(id);

  // Bicolor split: last word of the vault name goes accent (e.g. "Hearst Yield" + "Vault").
  const nameParts = vault.name.trim().split(/\s+/);
  const titleAccent = nameParts.length > 1 ? nameParts.pop()! : vault.name;
  const titleLead = nameParts.length ? nameParts.join(" ") : undefined;

  return (
    <InvestFlowShell
      step="product"
      titleLead={titleLead}
      titleAccent={titleAccent}
      contextLabel="Vault Detail"
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
      <section className="vault-detail-overview" aria-label="Key terms">
        <div className="vault-detail-overview__main">
          <div className="flex flex-wrap items-center gap-(--ct-space-2) mb-(--ct-space-4)">
            <span className="px-(--ct-space-2) py-(--ct-space-0_5) rounded-sm bg-(--ct-surface-2) border border-(--ct-border-ghost) text-(--ct-text-faint) text-(--ct-text-nano) uppercase tracking-widest font-bold">
              Institutional Grade
            </span>
            <span className="px-(--ct-space-2) py-(--ct-space-0_5) rounded-sm bg-(--ct-surface-2) border border-(--ct-border-ghost) text-(--ct-text-faint) text-(--ct-text-nano) uppercase tracking-widest font-bold">
              Cayman SPV
            </span>
            <span className="px-(--ct-space-2) py-(--ct-space-0_5) rounded-sm bg-(--ct-surface-2) border border-(--ct-border-ghost) text-(--ct-text-faint) text-(--ct-text-nano) uppercase tracking-widest font-bold">
              USDC Base
            </span>
          </div>
          <dl className="vault-detail-overview__kpis">
            <div className="vault-detail-overview__kpi">
              <dt className="stat-label">APY range</dt>
              <dd className="mt-(--ct-space-1)">
                <ApyRange
                  low={vault.apyLow}
                  high={vault.apyHigh}
                  precision={1}
                  className="vault-detail-overview__value tabular-nums mono"
                />
              </dd>
            </div>
            <div className="vault-detail-overview__kpi">
              <dt className="stat-label">Min subscription</dt>
              <dd className="vault-detail-overview__value tabular-nums mono mt-(--ct-space-1)">
                {formatMinTicketUsdc(vault.minTicketUsdc)}
              </dd>
            </div>
            <div className="vault-detail-overview__kpi">
              <dt className="stat-label">Soft lock-up</dt>
              <dd className="vault-detail-overview__value tabular-nums mono mt-(--ct-space-1)">
                {vault.softLockupDays} days
              </dd>
            </div>
          </dl>
        </div>
        <div className="vault-detail-overview__cta-zone">
          <div className="vault-detail-overview__cta-stack">
            {!isLive ? (
              <p className="body-xs ct-text-muted mb-(--ct-space-2)">
                {nonLiveNote(vault.status)}
              </p>
            ) : null}
            <InvestCta isLive={isLive} investHref={investHref} size="lg" className="w-full sm:w-auto" />
          </div>
        </div>
      </section>

      <TermSheetPreview vault={vault} />
    </InvestFlowShell>
  );
}
