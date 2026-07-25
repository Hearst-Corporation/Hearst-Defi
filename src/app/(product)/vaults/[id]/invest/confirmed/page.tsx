export const dynamic = "force-dynamic";

import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/client";
import { getVaultTarget, readNavPerShare } from "@/lib/chain/dynavault";
import { selectWired } from "@/lib/chain/wired-view";
import { getVault } from "@/lib/data/vaults";
import { getInvestor } from "@/lib/auth/session";
import { getIrContact } from "@/lib/ir-contact";
import {
  daysFromNow,
  daysSince,
  formatUsdcFromParam,
} from "@/lib/vaults/product-display";
import { InvestConfirmedView } from "@/views/investor/invest-confirmed-view";

import { loadOwnedPosition } from "./_data/confirmed-loader";

export const metadata = {
  title: "Deposit Confirmed — Series 1 Reserve Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tx?: string;
    amount?: string;
    positionId?: string;
    demo?: string;
  }>;
}


export default async function ConfirmedPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const txHash = sp.tx ?? null;
  const isSimulated = sp.demo === "1";

  const hasHash = txHash !== null && !isPlaceholderTxHash(txHash);
  const baseScanHref = hasHash ? explorerTxUrl(txHash) : null;

  const target = getVaultTarget();
  const contractTarget =
    target.mode === "not_configured"
      ? null
      : { mode: target.mode, address: target.address };

  const navWired = await readNavPerShare();
  const nav = selectWired(navWired, (data) => data.raw);

  const vaultForLock = await getVault(id);
  const LOCK_DAYS = vaultForLock?.softLockupDays ?? 60;

  const investor = await getInvestor();
  const position = await loadOwnedPosition(sp.positionId, investor?.id ?? null);
  const positionId = position ? (sp.positionId ?? null) : null;
  const amount = position
    ? formatUsdcFromParam(position.principalUsdc.toString())
    : formatUsdcFromParam(sp.amount);

  let currentDay: number | null = null;
  if (position) {
    currentDay = Math.min(LOCK_DAYS, Math.max(0, daysSince(position.subscribedAt)));
  }
  const unlockDate = daysFromNow(LOCK_DAYS);
  const lockPct = currentDay !== null ? Math.round((currentDay / LOCK_DAYS) * 100) : 0;

  const hasOnChainProof = hasHash && Boolean(positionId);
  const irContact = getIrContact();

  return (
    <InvestConfirmedView
      amount={amount}
      txHash={txHash}
      hasHash={hasHash}
      baseScanHref={baseScanHref}
      isSimulated={isSimulated}
      contractTarget={contractTarget}
      nav={nav}
      positionId={positionId}
      currentDay={currentDay}
      lockDays={LOCK_DAYS}
      unlockDate={unlockDate}
      lockPct={lockPct}
      hasOnChainProof={hasOnChainProof}
      irContact={irContact}
    />
  );
}
