import Link from "next/link";
import { Check } from "lucide-react";

import { OpsContactCard } from "@/components/onboarding/OpsContactCard";
import { abbreviateAddress } from "@/lib/onchain";
import type { Address } from "viem";
import type { Wired } from "@/lib/chain/dynavault";
import type { WiredSource } from "@/lib/chain/vault-mode";
import { formatNavPerShare } from "@/lib/chain/wired-view";
import { INVEST_SELECT_PATH } from "@/lib/vaults/invest-routes";
import { formatDateGb } from "@/lib/vaults/product-display";
import { Button, ProvenanceBadge } from "@/ui";

import { InvestFlowShell } from "./invest-flow-shell";
import { CopyAddressButton } from "@/app/(product)/vaults/[id]/invest/confirmed/copy-address-button";

export function InvestConfirmedView({
  amount,
  txHash,
  hasHash,
  baseScanHref,
  isSimulated,
  contractTarget,
  nav,
  positionId,
  currentDay,
  lockDays,
  unlockDate,
  lockPct,
  hasOnChainProof,
  irContact,
}: {
  amount: string;
  txHash: string | null;
  hasHash: boolean;
  baseScanHref: string | null;
  isSimulated: boolean;
  contractTarget: { mode: WiredSource; address: Address } | null;
  nav: Wired<bigint>;
  positionId: string | null;
  currentDay: number | null;
  lockDays: number;
  unlockDate: Date;
  lockPct: number;
  hasOnChainProof: boolean;
  irContact: {
    name: string;
    title: string;
    email: string;
    calendlyHref: string;
  } | null;
}) {
  return (
    <InvestFlowShell
      step="confirmed"
      width="narrow"
      titleLead="Deposit"
      titleAccent="confirmed"
      contextLabel="Subscription"
      description={
        isSimulated
          ? "Your subscription is recorded · simulated deposit (demo, off-chain)"
          : "Your subscription is recorded · Base Sepolia testnet"
      }
    >
      <section className="flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-surface-card p-8 text-center shadow-sm">
        <div
          aria-hidden="true"
          className="inline-flex size-14 items-center justify-center rounded-full bg-success/15 text-success"
        >
          <Check className="size-6" strokeWidth={3} />
        </div>
        <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">
          <span className="size-1.5 rounded-full bg-accent" />
          Deposit confirmed
        </span>
        <h2 className="mt-3 text-2xl font-semibold leading-none tracking-tight text-foreground">
          {amount !== "—" ? (
            <>
              {amount} <span className="text-accent-ink">deposited</span>
            </>
          ) : (
            <>
              Deposit <span className="text-accent-ink">recorded</span>
            </>
          )}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          {isSimulated
            ? "Simulated deposit — recorded off-chain for this demo account. No on-chain settlement took place."
            : hasOnChainProof
              ? "Your position has been recorded on-chain. Details below."
              : "Your subscription request is recorded. On-chain confirmation may still be pending."}
        </p>
      </section>

      <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-sm">
        <div className="flex items-end justify-between border-b border-border-subtle p-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
              Position Details
            </h2>
            <p className="text-xs tracking-wide text-faint">
              {isSimulated ? "Off-chain demo record" : "On-chain & settlement record"}
            </p>
          </div>
          <ProvenanceBadge
            source={isSimulated ? "stale" : hasHash ? "manual" : "estimated"}
          />
        </div>

        <dl className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border-subtle px-5 py-4">
            <dt className="text-sm text-muted">Transaction</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="truncate text-sm font-medium tabular-nums text-foreground">
                {hasHash
                  ? abbreviateAddress(txHash!)
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
                  className="shrink-0 text-xs font-medium text-accent-ink transition-colors hover:text-foreground"
                >
                  BaseScan ↗
                </a>
              ) : null}
            </dd>
          </div>

          {contractTarget ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border-subtle px-5 py-4">
              <dt className="text-sm text-muted">Vault contract</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-3">
                <span
                  className="truncate text-sm font-medium tabular-nums text-info"
                  title={contractTarget.address}
                >
                  {abbreviateAddress(contractTarget.address)}
                </span>
                <span className="rounded-md border border-border px-2 py-0.5 text-xs text-subtle">
                  {contractTarget.mode}
                </span>
                <CopyAddressButton address={contractTarget.address} />
              </dd>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
            <dt className="text-sm text-muted">NAV at entry</dt>
            <dd className="text-sm font-medium tabular-nums text-foreground">
              {nav.status === "wired"
                ? formatNavPerShare(nav.data)
                : "—"}
            </dd>
          </div>

          {positionId ? (
            <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
              <dt className="text-sm text-muted">Position ID</dt>
              <dd className="text-sm font-medium tabular-nums text-foreground">
                {positionId}
              </dd>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 bg-surface-inset px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                Soft-lock · contractual
              </span>
              <span className="text-xs tabular-nums text-faint">
                {currentDay !== null
                  ? `Day ${currentDay} of ${lockDays} · unlock ${formatDateGb(unlockDate)}`
                  : `${lockDays}-day soft lock-up · unlock ${formatDateGb(unlockDate)}`}
              </span>
            </div>
            {currentDay !== null ? (
              <div
                role="progressbar"
                aria-valuenow={currentDay}
                aria-valuemin={0}
                aria-valuemax={lockDays}
                aria-label={`Soft-lock: day ${currentDay} of ${lockDays}`}
                className="relative h-2 overflow-hidden rounded-full border border-border-subtle bg-surface-card"
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  style={{
                    width: `${lockPct}%`,
                    minWidth: currentDay > 0 ? "4px" : "0",
                  }}
                />
              </div>
            ) : null}
            <p className="text-xs leading-snug text-faint">
              Applied contractually — not enforced on-chain.
            </p>
          </div>
        </dl>
      </section>

      <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-sm">
        <div className="border-b border-border-subtle p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
            Next Steps
          </h2>
        </div>
        <ul className="flex flex-col">
          {[
            "Track your position and accrued BTC in Portfolio",
            "Review attestations in Proof Center",
            "Contact IR if you need settlement support",
          ].map((item, i, arr) => (
            <li
              key={item}
              className={`flex items-center gap-3 px-5 py-3.5 text-sm text-foreground ${
                i < arr.length - 1 ? "border-b border-border-subtle" : ""
              }`}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-accent" />
              {item}
            </li>
          ))}
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

      <div className="flex flex-col gap-3">
        <Link href={positionId ? `/portfolio/${positionId}` : "/portfolio"}>
          <Button className="w-full" size="lg">
            Go to portfolio
          </Button>
        </Link>
        {positionId ? (
          <Link href={`/portfolio/${positionId}`}>
            <Button variant="secondary" className="w-full">
              View this position
            </Button>
          </Link>
        ) : null}
        <Link href={INVEST_SELECT_PATH}>
          <Button variant="ghost" className="w-full">
            Back to the vault
          </Button>
        </Link>
      </div>

      <p className="text-center text-xs text-faint">
        A receipt and the Methodology v3.0 PDF will be emailed to your registered address.
      </p>
    </InvestFlowShell>
  );
}
