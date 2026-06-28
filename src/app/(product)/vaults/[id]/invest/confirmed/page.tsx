import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { DepositSuccessIcon } from "@/components/vaults/deposit-success-icon";
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
import { prisma } from "@/lib/db";
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
  }>;
}

const VAULT_CONTRACT =
  process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS ??
  process.env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS ??
  null;

const MS_PER_DAY = 86_400_000;

export default async function ConfirmedPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const txHash = sp.tx ?? null;
  const amount = formatUsdcFromParam(sp.amount);
  const positionId = sp.positionId ?? null;

  const hasHash = txHash !== null && !isPlaceholderTxHash(txHash);
  const baseScanHref = hasHash ? explorerTxUrl(txHash) : null;

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
      // RPC failure — graceful degradation
    }
  }

  const vaultForLock = await getVault(id);
  const LOCK_DAYS = vaultForLock?.softLockupDays ?? 60;

  // Real elapsed lock days from the position's subscription timestamp — never a
  // fabricated 0%. If the position can't be resolved, we drop the progress bar
  // entirely rather than render a structurally-pinned 0% (audit I16).
  let currentDay: number | null = null;
  if (positionId) {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: { subscribedAt: true },
    });
    if (position) {
      const elapsed = Math.floor((Date.now() - position.subscribedAt.getTime()) / MS_PER_DAY);
      currentDay = Math.min(LOCK_DAYS, Math.max(0, elapsed));
    }
  }
  const unlockDate = daysFromNow(LOCK_DAYS);
  const lockPct = currentDay !== null ? Math.round((currentDay / LOCK_DAYS) * 100) : 0;

  const today = new Date();
  const nextDistrib = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const icsUri = buildDistributionIcsUri("Hearst Yield Vault — Distribution", nextDistrib);

  const hasOnChainProof = hasHash && positionId;
  const irContact = getIrContact();

  return (
    <InvestFlowShell
      step="confirmed"
      width="narrow"
      titleLead="Deposit"
      titleAccent="confirmed"
      contextLabel="Investment Flow"
      description={
        <span className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">
          Your subscription is recorded · Base Sepolia testnet
        </span>
      }
    >
      {/* CONFIRMATION HERO */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col items-center text-center p-8">
        <DepositSuccessIcon />
        <span className="mt-5 inline-flex items-center gap-1.5 ct-bento-label text-[var(--ct-accent)]">
          <span className="size-1.5 rounded-full bg-[var(--ct-accent)]" />
          Deposit confirmed
        </span>
        <h2 className="mt-3 text-[length:var(--ct-text-2xl)] font-semibold text-[var(--ct-text-strong)] leading-none tracking-tight">
          {amount !== "—" ? (
            <>
              {amount} <span className="text-[var(--ct-accent)]">deposited</span>
            </>
          ) : (
            <>
              Deposit <span className="text-[var(--ct-accent)]">recorded</span>
            </>
          )}
        </h2>
        <p className="mt-3 max-w-md text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)] leading-relaxed">
          {hasOnChainProof
            ? "Your position has been recorded on-chain. Details below."
            : "Your subscription request is recorded. On-chain confirmation may still be pending."}
        </p>
      </section>

      {/* POSITION DETAILS */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
          <div className="flex flex-col gap-1.5">
            <h2 className="ct-bento-label">Position Details</h2>
            <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)] tracking-wide">
              On-chain &amp; settlement record
            </p>
          </div>
          <ProvenanceBadge kind={hasHash ? "manual" : "estimated"} />
        </div>

        <dl className="flex flex-col">
          {/* Transaction */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--ct-border-soft)]">
            <dt className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">Transaction</dt>
            <dd className="flex items-center gap-3 min-w-0">
              <span className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-text-strong)] tabular-nums truncate">
                {hasHash ? abbreviateAddress(txHash) : "Pending confirmation"}
              </span>
              {baseScanHref ? (
                <a
                  href={baseScanHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View transaction on Base Sepolia (opens in new tab)"
                  className="shrink-0 text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-accent)] hover:text-[var(--ct-text-strong)] transition-colors"
                >
                  BaseScan ↗
                </a>
              ) : null}
            </dd>
          </div>

          {/* Vault contract */}
          {VAULT_CONTRACT ? (
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--ct-border-soft)]">
              <dt className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">Vault contract</dt>
              <dd className="flex items-center gap-3 min-w-0">
                <span className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-text-strong)] tabular-nums truncate">
                  {abbreviateAddress(VAULT_CONTRACT)}
                </span>
                <CopyAddressButton address={VAULT_CONTRACT} />
              </dd>
            </div>
          ) : null}

          {/* NAV at entry */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--ct-border-soft)]">
            <dt className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">NAV at entry</dt>
            <dd className="flex items-center gap-3">
              <span className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-text-strong)] tabular-nums">
                {navDisplay}
              </span>
              <ProvenanceBadge kind={navProvenance} />
            </dd>
          </div>

          {/* Position ID */}
          {positionId ? (
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--ct-border-soft)]">
              <dt className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">Position ID</dt>
              <dd className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-text-strong)] tabular-nums">
                {positionId}
              </dd>
            </div>
          ) : null}

          {/* Soft-lock progress — only when we have a real elapsed day count */}
          <div className="flex flex-col gap-3 px-5 py-4 border-b border-[var(--ct-border-soft)] bg-surface-inset">
            <div className="flex items-center justify-between gap-4">
              <span className="ct-bento-label text-[var(--ct-text-faint)]">
                Soft-lock
              </span>
              <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)] tabular-nums">
                {currentDay !== null
                  ? `Day ${currentDay} of ${LOCK_DAYS} · unlock ${formatDateGb(unlockDate)}`
                  : `${LOCK_DAYS}-day soft lock-up · unlock ${formatDateGb(unlockDate)}`}
              </span>
            </div>
            {currentDay !== null ? (
              <div
                role="progressbar"
                aria-valuenow={currentDay}
                aria-valuemin={0}
                aria-valuemax={LOCK_DAYS}
                aria-label={`Soft-lock: day ${currentDay} of ${LOCK_DAYS}`}
                className="relative h-2 rounded-full border border-[var(--ct-border-soft)] bg-surface-card overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--ct-accent)]"
                  style={{
                    width: `${lockPct}%`,
                    minWidth: currentDay > 0 ? "var(--ct-space-1)" : "0",
                  }}
                />
              </div>
            ) : null}
          </div>

          {/* Next distribution */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <dt className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">Next distribution</dt>
            <dd className="flex items-center gap-3">
              <span className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-text-strong)] tabular-nums">
                {formatDateGb(nextDistrib)}
              </span>
              <a
                href={icsUri}
                download="hearst-distribution.ics"
                aria-label="Add distribution date to calendar (.ics download)"
                className="shrink-0 text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-accent)] hover:text-[var(--ct-text-strong)] transition-colors"
              >
                Add to calendar
              </a>
            </dd>
          </div>
        </dl>
      </section>

      {/* NEXT STEPS */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
          <h2 className="ct-bento-label">Next Steps</h2>
        </div>
        <ul className="flex flex-col">
          <li className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-sm)] text-[var(--ct-text-body)]">
            <span className="size-1.5 rounded-full bg-[var(--ct-accent)] shrink-0" />
            Track your position and distributions in Portfolio
          </li>
          <li className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-sm)] text-[var(--ct-text-body)]">
            <span className="size-1.5 rounded-full bg-[var(--ct-accent)] shrink-0" />
            Review attestations in Proof Center
          </li>
          <li className="flex items-center gap-3 px-5 py-3.5 text-[length:var(--ct-text-sm)] text-[var(--ct-text-body)]">
            <span className="size-1.5 rounded-full bg-[var(--ct-accent)] shrink-0" />
            Contact IR if you need settlement support
          </li>
        </ul>
      </section>

      {irContact ? (
        <OpsContactCard
          name={irContact.name}
          title={irContact.title}
          email={irContact.email}
          calendlyHref={irContact.calendlyHref}
        />
      ) : null}

      {/* ACTIONS */}
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" asChild className="w-full">
          <Link href={positionId ? `/portfolio/${positionId}` : "/portfolio"}>
            Go to portfolio
          </Link>
        </Button>
        <Button variant="ghost" size="md" asChild className="w-full">
          <Link href={INVEST_SELECT_PATH}>View other products</Link>
        </Button>
      </div>

      <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)] text-center">
        A receipt and the Methodology v1.0 PDF will be emailed to your registered address.
      </p>
    </InvestFlowShell>
  );
}
