// /vaults/[id]/invest/confirmed — Step 4 of 4: Institutional confirmation
//
// Non-negotiable #2: Provenance grouped — not on every row.
// Non-negotiable #5: no forbidden words.
// Non-negotiable #10: "not guaranteed" disclaimer.

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NestedPanel } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { DepositSuccessIcon } from "@/components/vaults/deposit-success-icon";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import {
  VaultDetailRow,
  VaultPanelHeader,
  VaultPanelInsetBlock,
  VaultPanelLink,
} from "@/components/vaults/vault-flow-primitives";
import { OpsContactCard } from "@/components/onboarding/OpsContactCard";
import { getIrContact } from "@/lib/ir-contact";
import {
  buildDistributionIcsUri,
  daysFromNow,
  formatDateGb,
  formatUsdcFromParam,
} from "@/lib/vaults/product-display";
import { CopyAddressButton } from "./copy-address-button";
import { abbreviateAddress } from "@/lib/onchain";
import { getPublicClient, explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/client";
import { readNavPerShare, formatNavPerShare, isVaultStale } from "@/lib/onchain/vault";
import { getVault } from "@/lib/data/vaults";
import { INVEST_SELECT_PATH } from "@/lib/vaults/invest-routes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deposit Confirmed — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tx?: string;
    amount?: string;
    positionId?: string;
    email?: string;
  }>;
}

const VAULT_CONTRACT =
  process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS ??
  process.env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS ??
  null;

export default async function ConfirmedPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([
    params,
    searchParams,
  ]);

  const txHash = sp.tx ?? null;
  const amount = formatUsdcFromParam(sp.amount);
  const positionId = sp.positionId ?? null;
  const email = sp.email ?? null;

  const hasHash = txHash !== null && !isPlaceholderTxHash(txHash);
  const baseScanHref = hasHash ? explorerTxUrl(txHash) : null;

  // Read NAV per share on-chain if the vault has a real (non-placeholder)
  // contract address. Degrades gracefully — never crashes the page on RPC failure.
  let navDisplay = "1.0000 USDC / share";
  let navProvenance: "live" | "estimated" = "estimated";

  if (VAULT_CONTRACT && !isVaultStale()) {
    try {
      const rawNav = await readNavPerShare(getPublicClient());
      if (rawNav !== null) {
        navDisplay = `${formatNavPerShare(rawNav)} USDC / share`;
        navProvenance = "live";
      }
    } catch {
      // RPC failure — fall back to estimated, no crash.
    }
  }

  // Soft-lock days from the vault (Class A=60, Class B=90) — never hardcoded.
  const vaultForLock = await getVault(id);
  const LOCK_DAYS = vaultForLock?.softLockupDays ?? 60;
  const currentDay = 0;
  const unlockDate = daysFromNow(LOCK_DAYS);

  const today = new Date();
  const nextDistrib = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const icsUri = buildDistributionIcsUri("Hearst Yield Vault — Distribution", nextDistrib);

  const hasOnChainProof = hasHash && positionId;
  const irContact = getIrContact();

  return (
    <InvestFlowShell
      width="narrow"
      step="confirmed"
      align="center"
      lead={<DepositSuccessIcon />}
      title={amount !== "—" ? `${amount} deposited` : "Deposit recorded"}
      description={
        hasOnChainProof
          ? "Your position has been recorded on-chain. Details below."
          : "Your subscription request is recorded. On-chain confirmation may still be pending."
      }
    >
      <div className="product-doc-stack">
        <NestedPanel className="py-0">
          <VaultPanelHeader
            title="Position details"
            trailing={
              <ProvenanceBadge kind={hasHash ? "manual" : "estimated"} />
            }
          />

          <div className="vault-panel-body">
            <VaultDetailRow
              label="Transaction"
              value={hasHash ? abbreviateAddress(txHash) : "Pending confirmation"}
              action={
                baseScanHref ? (
                  <VaultPanelLink
                    href={baseScanHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View transaction on Base Sepolia (opens in new tab)"
                  >
                    BaseScan ↗
                  </VaultPanelLink>
                ) : undefined
              }
            />

            {VAULT_CONTRACT ? (
              <VaultDetailRow
                label="Vault contract"
                value={abbreviateAddress(VAULT_CONTRACT)}
                action={<CopyAddressButton address={VAULT_CONTRACT} />}
              />
            ) : null}

            <VaultDetailRow
              label="NAV at entry"
              value={navDisplay}
              action={
                <ProvenanceBadge kind={navProvenance} />
              }
            />

            {positionId ? (
              <VaultDetailRow label="Position ID" value={positionId} />
            ) : null}

            <VaultPanelInsetBlock>
              <div className="vault-panel-inset-block__meta">
                <span className="stat-label ct-text-muted">Soft-lock</span>
                <span className="body-xs ct-text-muted">
                  Day {currentDay} of {LOCK_DAYS} · unlock {formatDateGb(unlockDate)}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={currentDay}
                aria-valuemin={0}
                aria-valuemax={LOCK_DAYS}
                aria-label={`Soft-lock: day ${currentDay} of ${LOCK_DAYS}`}
                className="ct-lock-track"
              >
                <div
                  className="h-full rounded-full ct-bg-accent transition-[width] duration-[var(--ct-dur-base)] ease-[var(--ct-ease)]"
                  style={{
                    width: `${Math.round((currentDay / LOCK_DAYS) * 100)}%`,
                    minWidth: currentDay > 0 ? "var(--ct-space-1)" : "0",
                  }}
                />
              </div>
            </VaultPanelInsetBlock>

            <VaultDetailRow
              label="Next distribution"
              value={formatDateGb(nextDistrib)}
              action={
                <VaultPanelLink
                  href={icsUri}
                  download="hearst-distribution.ics"
                  aria-label="Add distribution date to calendar (.ics download)"
                >
                  Add to calendar
                </VaultPanelLink>
              }
            />
          </div>
        </NestedPanel>

        <div className="product-doc-stack--tight">
          <p className="stat-label ct-text-muted">Next steps</p>
          <ul className="body-sm ct-text-body product-doc-bullet-list">
            <li>Track your position and distributions in Portfolio</li>
            <li>Review attestations in Proof Center</li>
            <li>Contact IR if you need settlement support</li>
          </ul>
        </div>

        {irContact ? (
          <OpsContactCard
            name={irContact.name}
            title={irContact.title}
            email={irContact.email}
            calendlyHref={irContact.calendlyHref}
          />
        ) : null}

        <div className="product-doc-stack--actions">
          <Button variant="primary" size="lg" asChild className="w-full">
            <Link href={positionId ? `/portfolio/${positionId}` : "/portfolio"}>
              Go to portfolio
            </Link>
          </Button>
          <Button variant="ghost" size="md" asChild className="w-full">
            <Link href={INVEST_SELECT_PATH}>View other products</Link>
          </Button>
        </div>

        <p className="body-xs ct-text-muted text-center">
          {email
            ? `Receipt and Methodology v1.0 PDF sent to ${email}`
            : "Receipt and Methodology v1.0 PDF sent to your registered email"}
        </p>
      </div>
    </InvestFlowShell>
  );
}
