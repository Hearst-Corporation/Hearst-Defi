// /vaults/[id]/invest/confirmed — Step 4 of 4: Institutional confirmation
//
// Non-negotiable #2: Provenance grouped — not on every row.
// Non-negotiable #5: no forbidden words.
// Non-negotiable #10: "not guaranteed" disclaimer.

import Link from "next/link";

import { getInvestor } from "@/lib/auth/session";
import { isDemoInvestor } from "@/lib/demo/provider";
import {
  DEMO_CONFIRMED_DESCRIPTION,
  DEMO_CONFIRMED_TITLE,
  DEMO_SANDBOX_DISCLAIMER,
  demoProvenance,
} from "@/lib/demo/markers";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
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
  const [{ id }, sp, investor] = await Promise.all([
    params,
    searchParams,
    getInvestor(),
  ]);

  // Demo status is resolved server-side from the identity (guard-gated → never
  // prod), NEVER from a searchparam (which would be spoofable).
  const demo = isDemoInvestor(investor);

  const txHash = sp.tx ?? null;
  const amount = formatUsdcFromParam(sp.amount);
  const positionId = sp.positionId ?? null;
  const email = sp.email ?? null;

  if (demo) {
    return (
      <InvestFlowShell
        width="narrow"
        step="confirmed"
        align="center"
        lead={<DepositSuccessIcon />}
        title={DEMO_CONFIRMED_TITLE}
        description={DEMO_CONFIRMED_DESCRIPTION}
        footer={
          <p className="body-xs ct-text-faint text-center text-pretty">
            APY ranges are target projections based on stated assumptions — not a
            commitment of future returns. Subject to vault conditions and
            Methodology v1.0.{" "}
            <span className="tabular mono ct-text-muted">Vault {id}</span>
          </p>
        }
      >
        <div className="product-doc-stack">
          <DemoDataBanner message={DEMO_SANDBOX_DISCLAIMER} />

          <NestedPanel className="py-0">
            <VaultPanelHeader
              title="Simulated position"
              trailing={<ProvenanceBadge kind={demoProvenance(true, "estimated")} />}
            />
            <div className="vault-panel-body">
              {amount !== "—" ? (
                <VaultDetailRow label="Amount" value={`${amount} USDC`} />
              ) : null}
              <VaultDetailRow label="NAV at entry" value="1.0000 USDC / share" />
              {/* No transaction row, no contract address, no explorer link:
                  the demo never presents an on-chain settlement. */}
            </div>
          </NestedPanel>

          <div className="product-doc-stack--actions">
            <Button variant="primary" size="lg" asChild className="w-full">
              <Link href="/portfolio">Back to portfolio</Link>
            </Button>
            <Button variant="ghost" size="md" asChild className="w-full">
              <Link href="/vaults">View other products</Link>
            </Button>
          </div>
        </div>
      </InvestFlowShell>
    );
  }

  const hasHash = txHash !== null && txHash.length > 6;
  const baseScanHref = hasHash
    ? `https://sepolia.basescan.org/tx/${txHash}`
    : "https://sepolia.basescan.org";

  const LOCK_DAYS = 60;
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
      footer={
        <p className="body-xs ct-text-faint text-center text-pretty">
          APY ranges are target projections based on stated assumptions — not a
          commitment of future returns. Subject to vault conditions and Methodology
          v1.0.{" "}
          <span className="tabular mono ct-text-muted">Vault {id}</span>
        </p>
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
                hasHash ? (
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

            <VaultDetailRow label="NAV at entry" value="1.0000 USDC / share" />

            {positionId ? (
              <VaultDetailRow label="Position ID" value={positionId} />
            ) : null}

            <VaultPanelInsetBlock>
              <div className="vault-panel-inset-block__meta">
                <span className="eyebrow ct-text-muted">Soft-lock</span>
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
          <p className="eyebrow ct-text-muted">Next steps</p>
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
            <Link href="/vaults">View other products</Link>
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
