import Link from "next/link";

import { ApyRange } from "@/components/ui/apy-range";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { VaultProduct } from "@/lib/data/vaults";
import {
  RISK_LABELS,
  STRATEGY_LABELS,
  vaultStatusLabel,
} from "@/lib/constants/vault";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { investProductPath } from "@/lib/vaults/invest-routes";

interface ProductSelectCardProps {
  vault: VaultProduct;
  /** Demo sandbox path — forces provenance to "simulated" and flags live cards. */
  demo?: boolean;
}

export function ProductSelectCard({ vault, demo = false }: ProductSelectCardProps) {
  const isLive = vault.status === "live";
  const href = investProductPath(vault.ticker);
  const strategyLabel = STRATEGY_LABELS[vault.strategy] ?? vault.strategy;

  const aumDisplay =
    vault.currentAumUsdc > 0 ? formatUsdCompact(vault.currentAumUsdc) : "Pending";

  return (
    <div
      aria-label={`${vault.name} — ${strategyLabel}`}
      className="rounded-2xl border border-white/10 bg-surface-card shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_auto_minmax(220px,0.7fr)]"
    >
      {/* Main */}
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h3 className="text-[15px] font-medium text-white truncate">
              {vault.name}{" "}
              <span className="font-mono text-[13px] text-zinc-500 font-normal">{vault.ticker}</span>
            </h3>
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
              {strategyLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {demo && isLive ? (
              <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                Simulated
              </span>
            ) : null}
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-[#A7FB90] bg-[#A7FB90]/10 border border-[#A7FB90]/20 px-2 py-0.5 rounded">
                <span className="size-1.5 rounded-full bg-[#A7FB90]" />
                {vaultStatusLabel(vault.status)}
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                {vaultStatusLabel(vault.status)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">APY range</span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <ApyRange
            low={vault.apyLow}
            high={vault.apyHigh}
            precision={1}
            className="text-[22px] font-medium text-[#A7FB90] tabular-nums"
          />
        </div>

        <p className="text-[13px] text-zinc-400 leading-relaxed line-clamp-2">{vault.description}</p>
      </div>

      {/* Divider */}
      <div aria-hidden className="hidden md:block border-l border-white/5" />

      {/* Meta */}
      <div className="flex flex-col gap-4 p-5 border-t md:border-t-0 border-white/5 bg-[#0a0a0a]">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <VaultTermRow label="Min. ticket" value={formatUsdCompact(vault.minTicketUsdc)} />
          <VaultTermRow label="Lock-up" value={`${vault.softLockupDays}d`} />
          <VaultTermRow label="Risk" value={RISK_LABELS[vault.riskLevel]} />
          <VaultTermRow label="AUM" value={aumDisplay} muted={vault.currentAumUsdc === 0} />
        </dl>

        {isLive ? (
          <Link
            href={href}
            aria-label={`View details for ${vault.name}`}
            className="mt-auto inline-flex items-center justify-center w-full rounded-lg bg-[#A7FB90] px-4 py-2.5 text-[13px] font-bold text-zinc-900 hover:bg-[#A7FB90]/90 transition-colors"
          >
            View details
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function VaultTermRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">{label}</dt>
      <dd className={cn("text-[13px] tabular-nums", muted ? "text-zinc-500 font-normal" : "text-white font-semibold")}>
        {value}
      </dd>
    </div>
  );
}
