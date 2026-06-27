import { notFound } from "next/navigation";
import Link from "next/link";

import { getVault, type VaultProduct } from "@/lib/data/vaults";
import { ApyRange } from "@/components/ui/apy-range";
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
      <Link
        href={investHref}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#A7FB90] px-5 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-zinc-900 shadow-sm transition-colors hover:bg-[#A7FB90]/90"
      >
        Continue to deposit
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      href={INVEST_SELECT_PATH}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-[13px] font-bold uppercase tracking-[0.1em] text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
    >
      Browse other products
    </Link>
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
      {/* KEY TERMS + NEXT ACTION (bento panel) */}
      <section
        role="region"
        aria-label="Key terms and next action"
        className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col"
      >
        {/* Identity header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-white/5">
          <span className="text-[12px] font-bold tracking-[0.2em] uppercase text-zinc-400 tabular-nums">
            {vault.ticker}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-bold",
              isLive ? "text-[#A7FB90]" : "text-zinc-400",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                isLive ? "bg-[#A7FB90]" : "bg-zinc-500",
              )}
            />
            {vaultStatusLabel(vault.status)}
          </span>
        </div>

        {/* Metrics strip */}
        <dl className="grid grid-cols-1 md:grid-cols-3 border-b border-white/5 bg-[#15191C]">
          <div className="flex flex-col gap-2 p-5 md:px-6 border-b md:border-b-0 md:border-r border-white/5">
            <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Target APY range
            </dt>
            <dd>
              <ApyRange
                low={vault.apyLow}
                high={vault.apyHigh}
                precision={1}
                className="text-[22px] font-medium text-[#A7FB90] leading-none tracking-tight tabular-nums"
              />
            </dd>
          </div>
          <div className="flex flex-col gap-2 p-5 md:px-6 border-b md:border-b-0 md:border-r border-white/5">
            <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Min subscription
            </dt>
            <dd className="text-[22px] font-medium text-white leading-none tracking-tight tabular-nums">
              {formatMinTicketUsdc(vault.minTicketUsdc)}
            </dd>
          </div>
          <div className="flex flex-col gap-2 p-5 md:px-6">
            <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              Soft lock-up
            </dt>
            <dd className="text-[22px] font-medium text-white leading-none tracking-tight tabular-nums">
              {vault.softLockupDays} days
            </dd>
          </div>
        </dl>

        {/* CTA block */}
        <div className="flex flex-col gap-3 p-5 md:p-6">
          {!isLive ? (
            <p className="text-[12px] text-zinc-500 tracking-wide">
              {nonLiveNote(vault.status)}
            </p>
          ) : null}
          <InvestCta isLive={isLive} investHref={investHref} />
          <p className="text-[12px] text-zinc-500 tracking-wide">
            {ctaSupportLine(isLive)}
          </p>
        </div>
      </section>

      <TermSheetPreview vault={vault} />
    </InvestFlowShell>
  );
}
