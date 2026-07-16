import Link from "next/link";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { WiredChip } from "@/components/catalyst/wired-chip";
import { WiredValue } from "@/components/catalyst/wired-value";
import { InvestFlowShell } from "@/components/vaults/invest-flow-shell";
import { DepositSuccessIcon } from "@/components/vaults/deposit-success-icon";
import { OpsContactCard } from "@/components/onboarding/OpsContactCard";
import { getIrContact } from "@/lib/ir-contact";
import {
  daysFromNow,
  formatDateGb,
  formatUsdcFromParam,
} from "@/lib/vaults/product-display";
import { CopyAddressButton } from "./copy-address-button";
import { abbreviateAddress } from "@/lib/onchain";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/client";
import { getVaultTarget, readNavPerShare } from "@/lib/chain/dynavault";
import {
  formatNavPerShare,
  selectWired,
  toWiredLike,
} from "@/lib/chain/wired-view";
import { getVault } from "@/lib/data/vaults";
import { getInvestor } from "@/lib/auth/session";
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
    /** "1" when the deposit was the demo-account OFF-CHAIN simulation. */
    demo?: string;
  }>;
}

const MS_PER_DAY = 86_400_000;

export default async function ConfirmedPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const txHash = sp.tx ?? null;
  const isSimulated = sp.demo === "1";

  const hasHash = txHash !== null && !isPlaceholderTxHash(txHash);
  const baseScanHref = hasHash ? explorerTxUrl(txHash) : null;

  // The vault contract now comes from the adapter (the single passage point),
  // not from a local env read — so this row shows the SAME contract every other
  // v2-wired surface talks to, and says which one it is.
  const target = getVaultTarget();
  const contractTarget = target.mode === "not_configured" ? null : target;

  // NAV through the adapter. Previously this page defaulted to a hard-coded
  // "1.0000 USDC / share" and showed it with an "estimated" badge whenever the
  // read failed — a fabricated number wearing a provenance badge. Now a failed
  // read renders an em-dash plus its reason: an RPC outage stays distinguishable
  // from an unconfigured contract, and neither invents a price.
  //
  // `readNavPerShare()` returns the raw value ALONGSIDE the decimals it assumed
  // (`assetDecimals` / `shareDecimals`), so the assumption that produced the
  // number is inspectable rather than implicit. Only `.raw` is rendered here.
  const nav = selectWired(await readNavPerShare(), (data) => data.raw);

  const vaultForLock = await getVault(id);
  const LOCK_DAYS = vaultForLock?.softLockupDays ?? 60;

  // Resolve the position ONLY if it belongs to the signed-in investor — the
  // positionId arrives via the URL and is otherwise untrusted (a foreign or
  // bogus id must not surface another investor's details). When owned, the DB
  // row is also the source of truth for the displayed amount: the `amount`
  // query param is user-editable and only ever a fallback.
  //
  // A DB read can fail transiently (pool exhaustion, connection drop) — this
  // must degrade to the SAME honest "position not resolved" fallback the page
  // already renders for a missing/foreign positionId, not an unhandled
  // rejection that blows the whole confirmation page to a generic 500.
  const investor = await getInvestor();
  const position =
    sp.positionId && investor
      ? await prisma.position
          .findFirst({
            where: { id: sp.positionId, investorId: investor.id },
            select: { subscribedAt: true, principalUsdc: true },
          })
          .catch(() => null)
      : null;
  const positionId = position ? (sp.positionId ?? null) : null;
  const amount = position
    ? formatUsdcFromParam(position.principalUsdc.toString())
    : formatUsdcFromParam(sp.amount);

  // Real elapsed lock days from the position's subscription timestamp — never a
  // fabricated 0%. If the position can't be resolved, we drop the progress bar
  // entirely rather than render a structurally-pinned 0% (audit I16). The
  // soft-lock is CONTRACTUAL (v2 has no on-chain lock-up).
  let currentDay: number | null = null;
  if (position) {
    const elapsed = Math.floor((new Date().getTime() - position.subscribedAt.getTime()) / MS_PER_DAY);
    currentDay = Math.min(LOCK_DAYS, Math.max(0, elapsed));
  }
  const unlockDate = daysFromNow(LOCK_DAYS);
  const lockPct = currentDay !== null ? Math.round((currentDay / LOCK_DAYS) * 100) : 0;

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
          {isSimulated
            ? "Your subscription is recorded · simulated deposit (demo, off-chain)"
            : "Your subscription is recorded · Base Sepolia testnet"}
        </span>
      }
    >
      {/* CONFIRMATION HERO */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col items-center text-center p-8">
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
          {isSimulated
            ? "Simulated deposit — recorded off-chain for this demo account. No on-chain settlement took place."
            : hasOnChainProof
              ? "Your position has been recorded on-chain. Details below."
              : "Your subscription request is recorded. On-chain confirmation may still be pending."}
        </p>
      </section>

      {/* POSITION DETAILS */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
        <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
          <div className="flex flex-col gap-1.5">
            <h2 className="ct-bento-label">Position Details</h2>
            <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)] tracking-wide">
              {isSimulated ? "Off-chain demo record" : "On-chain & settlement record"}
            </p>
          </div>
          <ProvenanceBadge
            kind={isSimulated ? "simulated" : hasHash ? "manual" : "estimated"}
          />
        </div>

        <dl className="flex flex-col">
          {/* Transaction */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 border-b border-[var(--ct-border-soft)]">
            <dt className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">Transaction</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-text-strong)] tabular-nums truncate">
                {hasHash
                  ? abbreviateAddress(txHash)
                  : isSimulated
                    ? "Simulated — no on-chain transaction"
                    : "Pending confirmation"}
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

          {/* Vault contract — resolved by the adapter, tagged with its mode */}
          {contractTarget ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 border-b border-[var(--ct-border-soft)]">
              <dt className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">Vault contract</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-3">
                <span
                  className="text-[length:var(--ct-text-sm)] font-medium text-info tabular-nums truncate"
                  title={contractTarget.address}
                >
                  {abbreviateAddress(contractTarget.address)}
                </span>
                <WiredChip state="wired" source={contractTarget.mode} />
                <CopyAddressButton address={contractTarget.address} />
              </dd>
            </div>
          ) : null}

          {/* NAV at entry — through the adapter, in blue. No fabricated fallback. */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--ct-border-soft)]">
            <dt className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">NAV at entry</dt>
            <dd className="flex items-center gap-3">
              <WiredValue
                wired={toWiredLike(nav)}
                label="NAV at entry"
                render={(raw) => (
                  <span className="text-[length:var(--ct-text-sm)] font-medium tabular-nums">
                    {formatNavPerShare(raw)}
                  </span>
                )}
              />
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

          {/* Soft-lock progress — CONTRACTUAL, not on-chain. Only when we have a
              real elapsed day count. */}
          <div className="flex flex-col gap-3 px-5 py-4 bg-surface-inset">
            <div className="flex items-center justify-between gap-4">
              <span className="ct-bento-label text-[var(--ct-text-faint)]">
                Soft-lock · contractual
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
            <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)] leading-snug">
              Applied contractually — not enforced on-chain.
            </p>
          </div>
        </dl>
      </section>

      {/* NEXT STEPS */}
      <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
        <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
          <h2 className="ct-bento-label">Next Steps</h2>
        </div>
        <ul className="flex flex-col">
          <li className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--ct-border-soft)] text-[length:var(--ct-text-sm)] text-[var(--ct-text-body)]">
            <span className="size-1.5 rounded-full bg-[var(--ct-accent)] shrink-0" />
            Track your position and accrued BTC in Portfolio
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
          <Link href="/portfolio">Go to portfolio</Link>
        </Button>
        {positionId ? (
          <Button variant="ghost" size="md" asChild className="w-full">
            <Link href={`/portfolio/${positionId}`}>View this position</Link>
          </Button>
        ) : null}
        <Button variant="ghost" size="md" asChild className="w-full">
          <Link href={INVEST_SELECT_PATH}>View other products</Link>
        </Button>
      </div>

      <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)] text-center">
        A receipt and the Methodology v3.0 PDF will be emailed to your registered address.
      </p>
    </InvestFlowShell>
  );
}
