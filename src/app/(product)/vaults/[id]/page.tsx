import { notFound } from "next/navigation";
import Link from "next/link";

import { getVault } from "@/lib/data/vaults";
import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import { buildDemoVaultDetail } from "@/lib/demo/builders";
import { DEMO_SANDBOX_DISCLAIMER } from "@/lib/demo/markers";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
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
import { investDepositPath, INVEST_SELECT_PATH } from "@/lib/vaults/invest-routes";

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
  if (!isLive) return null;

  return (
    <Button variant="primary" size={size} asChild className={className}>
      <Link href={investHref}>Continue to deposit</Link>
    </Button>
  );
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const investor = await getInvestor();
  const demo = isDemoInvestor(investor);
  const vault = demo ? buildDemoVaultDetail(id) : await getVault(id);

  if (!vault) notFound();

  const isLive = vault.status === "live";
  const investHref = investDepositPath(id);

  return (
    <InvestFlowShell
      step="product"
      workspace
      title={vault.name}
      lead={
        <Link
          href={INVEST_SELECT_PATH}
          className="body-sm ct-link-accent"
          aria-label="Back to product list"
        >
          ← Products
        </Link>
      }
      actions={
        <>
          <Badge variant="accent" className="mono">{vault.ticker}</Badge>
          <Badge variant={VAULT_STATUS_VARIANT[vault.status]}>
            {vaultStatusLabel(vault.status)}
          </Badge>
          <InvestCta
            isLive={isLive}
            investHref={investHref}
            className="invest-flow-shell__header-cta"
          />
        </>
      }
      headerBelowStepper={
        <dl className="vault-detail-kpis">
          <div>
            <dt className="stat-label">APY range</dt>
            <dd className="mt-0.5">
              <ApyRange
                low={vault.apyLow}
                high={vault.apyHigh}
                precision={1}
                className="stat-value tabular mono ct-text-strong"
              />
            </dd>
          </div>
          <div>
            <dt className="stat-label">Min subscription</dt>
            <dd className="stat-value tabular mono ct-text-strong mt-0.5">
              {formatMinTicketUsdc(vault.minTicketUsdc)}
            </dd>
          </div>
          <div>
            <dt className="stat-label">Soft lock-up</dt>
            <dd className="stat-value tabular mono ct-text-strong mt-0.5">
              {vault.softLockupDays} days
            </dd>
          </div>
          <div className="vault-detail-kpis__mobile-cta">
            <InvestCta
              isLive={isLive}
              investHref={investHref}
              className="w-full"
            />
          </div>
        </dl>
      }
    >
      {demo ? (
        <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} className="mb-[var(--ct-space-4)]" />
      ) : null}
      <TermSheetPreview vault={vault} />
    </InvestFlowShell>
  );
}
