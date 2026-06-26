import { notFound } from "next/navigation";
import Link from "next/link";

import { getVault, type VaultProduct } from "@/lib/data/vaults";
import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { TermSheetPreview } from "@/components/vaults/term-sheet-preview";
import { vaultStatusLabel } from "@/lib/constants/vault";
import { cn } from "@/lib/cn";
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

/** Single supporting line under the CTA — what the next step actually is. */
function ctaSupportLine(isLive: boolean): string {
  return isLive
    ? "Step 3 — confirm your ticket and funding details next. No funds move yet."
    : "Browse the other Hearst products while this one finalizes.";
}

function InvestCta({
  isLive,
  investHref,
}: {
  isLive: boolean;
  investHref: string;
}) {
  if (isLive) {
    return (
      <Button
        variant="primary"
        size="lg"
        asChild
        className="vault-summary__cta-btn"
      >
        <Link href={investHref}>Continue to deposit</Link>
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      asChild
      className="vault-summary__cta-btn"
    >
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

  const nameParts = vault.name.trim().split(/\s+/);
  const titleAccent = nameParts.length > 1 ? nameParts.pop()! : vault.name;
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
      <Card
        role="region"
        aria-label="Key terms and next action"
        hoverOverlay={false}
        className="vault-summary"
        contentClassName="vault-summary__content"
      >
        <div className="vault-summary__identity">
          <span className="vault-summary__ticker mono">{vault.ticker}</span>
          <span
            className={cn(
              "vault-summary__status",
              isLive
                ? "vault-summary__status--live"
                : "vault-summary__status--pending",
            )}
          >
            <span className="vault-summary__status-dot" aria-hidden="true" />
            {vaultStatusLabel(vault.status)}
          </span>
        </div>

        <dl className="vault-summary__metrics">
          <div className="vault-summary__metric vault-summary__metric--hero">
            <dt className="stat-label">Target APY range</dt>
            <dd>
              <ApyRange
                low={vault.apyLow}
                high={vault.apyHigh}
                precision={1}
                className="vault-summary__hero-value tabular-nums mono"
              />
            </dd>
          </div>
          <div className="vault-summary__metric">
            <dt className="stat-label">Min subscription</dt>
            <dd className="vault-summary__value tabular-nums mono">
              {formatMinTicketUsdc(vault.minTicketUsdc)}
            </dd>
          </div>
          <div className="vault-summary__metric">
            <dt className="stat-label">Soft lock-up</dt>
            <dd className="vault-summary__value tabular-nums mono">
              {vault.softLockupDays} days
            </dd>
          </div>
        </dl>

        <div className="vault-summary__cta">
          {!isLive ? (
            <p className="body-xs ct-text-faint vault-summary__cta-note">
              {nonLiveNote(vault.status)}
            </p>
          ) : null}
          <InvestCta isLive={isLive} investHref={investHref} />
          <p className="body-xs ct-text-faint vault-summary__cta-support">
            {ctaSupportLine(isLive)}
          </p>
        </div>
      </Card>

      <TermSheetPreview vault={vault} />
    </InvestFlowShell>
  );
}
