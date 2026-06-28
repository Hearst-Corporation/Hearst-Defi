import { ApyRange } from "@/components/ui/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { VaultProduct } from "@/lib/data/vaults";
import { formatUsdFull } from "@/lib/vaults/product-display";

interface DepositSummaryProps {
  vault: VaultProduct;
  amount: number;
}

export function DepositSummary({ vault, amount }: DepositSummaryProps) {
  const midApy = (vault.apyLow + vault.apyHigh) / 2;
  const yearlyYield = amount > 0 ? (amount * midApy) / 100 : null;
  const yieldAtClose =
    yearlyYield !== null ? yearlyYield * (vault.softLockupDays / 365) : null;
  const totalAtClose =
    yieldAtClose !== null ? amount + yieldAtClose : null;

  const yieldShare =
    totalAtClose !== null && totalAtClose > 0
      ? Math.min(100, (yieldAtClose! / totalAtClose) * 100)
      : 0;
  const principalShare = 100 - yieldShare;

  const mgmtFee = vault.fees.mgmtBps / 100;
  const perfFee = vault.fees.perfBps / 100;
  const hurdleFee = vault.fees.hurdleBps > 0 ? vault.fees.hurdleBps / 100 : null;

  const hasAmount = amount > 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-end justify-between p-5 border-b border-white/5">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
            Deposit Summary
          </h2>
          <p className="text-[12px] text-zinc-500 tracking-wide">
            Projected allocation outcome
          </p>
        </div>
        <ProvenanceBadge kind="estimated" />
      </div>

      {/* Headline projected total */}
      <div className="flex items-end justify-between gap-4 p-5 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500 max-w-[55%]">
          {hasAmount
            ? "Projected at soft close (gross)"
            : "Allocation preview — enter amount"}
        </span>
        <span
          className={cn(
            "text-[28px] font-medium leading-none tracking-tight tabular-nums transition-all duration-150",
            hasAmount ? "text-[#A7FB90]" : "text-zinc-600",
          )}
        >
          {totalAtClose !== null ? `${formatUsdFull(totalAtClose)} USDC` : "—"}
        </span>
      </div>

      {/* Principal / Yield split bar + legend */}
      <div className="flex flex-col gap-4 p-5 border-b border-white/5">
        <div
          className="relative h-2 flex overflow-hidden rounded-full border border-white/5 bg-surface-inset"
          role="img"
          aria-label={
            hasAmount
              ? `Principal ${formatUsdFull(amount)}, projected gross yield ${formatUsdFull(yieldAtClose ?? 0)} at soft close`
              : "Enter an amount to see the principal and yield split"
          }
        >
          <span
            className="h-full bg-[#A7FB90] transition-all duration-150 ease-out"
            style={{ width: `${hasAmount ? principalShare : 100}%` }}
          />
          {hasAmount && yieldShare > 0 ? (
            <span
              className="h-full bg-[#A7FB90]/40 transition-all duration-150 ease-out"
              style={{ width: `${yieldShare}%` }}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 transition-opacity duration-150">
            <span className="size-2.5 rounded-full border-2 border-[#15191C] bg-[#A7FB90]" />
            <span className="text-[13px] text-zinc-400">Principal</span>
            <span className="text-[13px] font-medium text-white tabular-nums">
              {hasAmount ? `${formatUsdFull(amount)} USDC` : "—"}
            </span>
          </div>
          <div
            className={cn(
              "grid grid-cols-[auto_1fr_auto] items-center gap-3 transition-opacity duration-150",
              !hasAmount && "opacity-40",
            )}
          >
            <span className="size-2.5 rounded-full border-2 border-[#15191C] bg-[#A7FB90]/40" />
            <span className="text-[13px] text-zinc-400">
              Est. gross yield · {vault.softLockupDays}d
            </span>
            <span className="text-[13px] font-medium text-white tabular-nums">
              {yieldAtClose !== null ? `~${formatUsdFull(yieldAtClose)}` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 border-b border-white/5 bg-surface-inset">
        <div className="flex flex-col gap-2 p-5 border-b sm:border-r border-white/5">
          <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
            Target APY
          </dt>
          <dd>
            <ApyRange
              low={vault.apyLow}
              high={vault.apyHigh}
              precision={1}
              className="text-[18px] font-medium text-white leading-none tracking-tight tabular-nums"
            />
          </dd>
        </div>
        <div className="flex flex-col gap-2 p-5 border-b border-white/5">
          <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
            Est. gross yield (p.a.)
          </dt>
          <dd className="text-[18px] font-medium text-white leading-none tracking-tight tabular-nums">
            {yearlyYield !== null ? `~${formatUsdFull(yearlyYield)}` : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-2 p-5 sm:border-r border-white/5">
          <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
            Lock-up
          </dt>
          <dd className="text-[18px] font-medium text-white leading-none tracking-tight tabular-nums">
            {vault.softLockupDays}d soft
          </dd>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
            Fees
          </dt>
          <dd className="text-[18px] font-medium text-white leading-none tracking-tight tabular-nums">
            {mgmtFee.toFixed(2)}% · {perfFee.toFixed(0)}%
            {hurdleFee ? ` · ${hurdleFee.toFixed(1)}%` : ""}
          </dd>
        </div>
      </dl>

      {/* Disclaimer */}
      <p className="p-5 text-[11px] leading-relaxed text-zinc-500">
        Figures shown are gross (before fees). Net yield after management and
        performance fees will be lower. Uses APY range midpoint — not a
        commitment of future returns. Methodology v1.0.
      </p>
    </section>
  );
}
