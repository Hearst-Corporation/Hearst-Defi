import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
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
  const currentDay = 0;
  const unlockDate = daysFromNow(LOCK_DAYS);

  const today = new Date();
  const nextDistrib = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const icsUri = buildDistributionIcsUri("Hearst Yield Vault — Distribution", nextDistrib);

  const hasOnChainProof = hasHash && positionId;
  const irContact = getIrContact();
  const lockPct = Math.round((currentDay / LOCK_DAYS) * 100);

  return (
    <div className="dark flex flex-col gap-y-5 mx-auto w-full max-w-2xl mb-8">

      {/* CONFIRMATION HERO */}
      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col items-center text-center p-8">
        <DepositSuccessIcon />
        <span className="mt-5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-bold text-[#A7FB90]">
          <span className="size-1.5 rounded-full bg-[#A7FB90]" />
          Deposit confirmed
        </span>
        <h1 className="mt-3 text-[28px] font-medium text-white leading-none tracking-tight">
          {amount !== "—" ? `${amount} deposited` : "Deposit recorded"}
        </h1>
        <p className="mt-3 max-w-md text-[13px] text-zinc-400 leading-relaxed">
          {hasOnChainProof
            ? "Your position has been recorded on-chain. Details below."
            : "Your subscription request is recorded. On-chain confirmation may still be pending."}
        </p>
      </section>

      {/* POSITION DETAILS */}
      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-end justify-between p-5 border-b border-white/5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
              Position Details
            </h2>
            <p className="text-[12px] text-zinc-500 tracking-wide">
              On-chain & settlement record
            </p>
          </div>
          <ProvenanceBadge kind={hasHash ? "manual" : "estimated"} />
        </div>

        <dl className="flex flex-col">
          {/* Transaction */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
            <dt className="text-[13px] text-zinc-400">Transaction</dt>
            <dd className="flex items-center gap-3 min-w-0">
              <span className="text-[13px] font-medium text-white tabular-nums truncate">
                {hasHash ? abbreviateAddress(txHash) : "Pending confirmation"}
              </span>
              {baseScanHref ? (
                <a
                  href={baseScanHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View transaction on Base Sepolia (opens in new tab)"
                  className="shrink-0 text-[12px] font-medium text-[#A7FB90] hover:text-white transition-colors"
                >
                  BaseScan ↗
                </a>
              ) : null}
            </dd>
          </div>

          {/* Vault contract */}
          {VAULT_CONTRACT ? (
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
              <dt className="text-[13px] text-zinc-400">Vault contract</dt>
              <dd className="flex items-center gap-3 min-w-0">
                <span className="text-[13px] font-medium text-white tabular-nums truncate">
                  {abbreviateAddress(VAULT_CONTRACT)}
                </span>
                <CopyAddressButton address={VAULT_CONTRACT} />
              </dd>
            </div>
          ) : null}

          {/* NAV at entry */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
            <dt className="text-[13px] text-zinc-400">NAV at entry</dt>
            <dd className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-white tabular-nums">
                {navDisplay}
              </span>
              <ProvenanceBadge kind={navProvenance} />
            </dd>
          </div>

          {/* Position ID */}
          {positionId ? (
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/5">
              <dt className="text-[13px] text-zinc-400">Position ID</dt>
              <dd className="text-[13px] font-medium text-white tabular-nums">
                {positionId}
              </dd>
            </div>
          ) : null}

          {/* Soft-lock progress */}
          <div className="flex flex-col gap-3 px-5 py-4 border-b border-white/5 bg-[#15191C]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
                Soft-lock
              </span>
              <span className="text-[12px] text-zinc-500 tabular-nums">
                Day {currentDay} of {LOCK_DAYS} · unlock {formatDateGb(unlockDate)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={currentDay}
              aria-valuemin={0}
              aria-valuemax={LOCK_DAYS}
              aria-label={`Soft-lock: day ${currentDay} of ${LOCK_DAYS}`}
              className="relative h-2 rounded-full border border-white/5 bg-black overflow-hidden"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#A7FB90]"
                style={{
                  width: `${lockPct}%`,
                  minWidth: currentDay > 0 ? "var(--ct-space-1)" : "0",
                }}
              />
            </div>
          </div>

          {/* Next distribution */}
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <dt className="text-[13px] text-zinc-400">Next distribution</dt>
            <dd className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-white tabular-nums">
                {formatDateGb(nextDistrib)}
              </span>
              <a
                href={icsUri}
                download="hearst-distribution.ics"
                aria-label="Add distribution date to calendar (.ics download)"
                className="shrink-0 text-[12px] font-medium text-[#A7FB90] hover:text-white transition-colors"
              >
                Add to calendar
              </a>
            </dd>
          </div>
        </dl>
      </section>

      {/* NEXT STEPS */}
      <section className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-end justify-between p-5 border-b border-white/5">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
            Next Steps
          </h2>
        </div>
        <ul className="flex flex-col">
          <li className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 text-[13px] text-zinc-300">
            <span className="size-1.5 rounded-full bg-[#A7FB90] shrink-0" />
            Track your position and distributions in Portfolio
          </li>
          <li className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 text-[13px] text-zinc-300">
            <span className="size-1.5 rounded-full bg-[#A7FB90] shrink-0" />
            Review attestations in Proof Center
          </li>
          <li className="flex items-center gap-3 px-5 py-3.5 text-[13px] text-zinc-300">
            <span className="size-1.5 rounded-full bg-[#A7FB90] shrink-0" />
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

      <p className="text-[11px] text-zinc-500 text-center">
        {email
          ? `Receipt and Methodology v1.0 PDF sent to ${email}`
          : "Receipt and Methodology v1.0 PDF sent to your registered email"}
      </p>
    </div>
  );
}
