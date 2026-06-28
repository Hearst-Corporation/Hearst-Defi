import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/catalyst/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import { CATALYST_ACCENT_BTN } from "@/lib/ui/catalyst-accent";
import type { VaultProduct } from "@/lib/data/vaults";
import {
  AUM_PENDING_LABEL,
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

  const hasAum = vault.currentAumUsdc > 0;
  const aumDisplay = hasAum ? formatUsdCompact(vault.currentAumUsdc) : AUM_PENDING_LABEL;

  return (
    <div
      aria-label={`${vault.name} — ${strategyLabel}`}
      className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_auto_minmax(220px,0.7fr)]"
    >
      {/* Main */}
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h3 className="ct-metric-value truncate">
              {vault.name}{" "}
              <span className="font-mono ct-metric-caption font-normal">{vault.ticker}</span>
            </h3>
            <span className="ct-bento-label">
              {strategyLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {demo && isLive ? (
              <span className="ct-bento-label text-[var(--ct-text-muted)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] border border-[var(--ct-border)] px-2 py-0.5 rounded">
                Simulated
              </span>
            ) : null}
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 ct-bento-label text-[var(--ct-accent)] bg-[var(--ct-status-success-soft)] border border-[var(--ct-status-success-border)] px-2 py-0.5 rounded">
                <span className="size-1.5 rounded-full bg-[var(--ct-accent)]" />
                {vaultStatusLabel(vault.status)}
              </span>
            ) : (
              <span className="ct-bento-label text-[var(--ct-text-muted)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] border border-[var(--ct-border)] px-2 py-0.5 rounded">
                {vaultStatusLabel(vault.status)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <span className="ct-bento-label">APY range</span>
            <ProvenanceBadge kind="estimated" />
          </div>
          <ApyRange
            low={vault.apyLow}
            high={vault.apyHigh}
            precision={1}
            className="text-[length:var(--ct-text-2xl)] font-medium text-[var(--ct-accent)] tabular-nums"
          />
        </div>

        <p className="ct-metric-caption leading-relaxed line-clamp-2">{vault.description}</p>
      </div>

      {/* Divider */}
      <div aria-hidden className="hidden md:block border-l border-[var(--ct-border-soft)]" />

      {/* Meta */}
      <div className="flex flex-col gap-4 p-5 border-t md:border-t-0 border-[var(--ct-border-soft)] bg-[var(--ct-bg-deep)]">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <VaultTermRow label="Min. ticket" value={formatUsdCompact(vault.minTicketUsdc)} />
          <VaultTermRow label="Lock-up" value={`${vault.softLockupDays}d`} />
          <VaultTermRow label="Risk" value={RISK_LABELS[vault.riskLevel]} />
          <VaultTermRow
            label="AUM"
            value={aumDisplay}
            muted={!hasAum}
            provenance={hasAum ? "estimated" : undefined}
          />
        </dl>

        {isLive ? (
          <Button
            href={href}
            aria-label={`View details for ${vault.name}`}
            className={cn("mt-auto w-full", CATALYST_ACCENT_BTN)}
          >
            View details
          </Button>
        ) : (
          <p className="mt-auto ct-metric-caption leading-relaxed">
            {nonLiveNote(vault.status)}
          </p>
        )}
      </div>
    </div>
  );
}

/** Honest one-liner for why a non-live product can't take subscriptions yet. */
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
      return "Not yet open for subscriptions.";
  }
}

function VaultTermRow({
  label,
  value,
  muted = false,
  provenance,
}: {
  label: string;
  value: string;
  muted?: boolean;
  /** When set, renders a compact provenance badge next to the label. */
  provenance?: "estimated" | "manual";
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <dt className="ct-bento-label">{label}</dt>
        {provenance ? (
          <ProvenanceBadge kind={provenance} variant="compact" />
        ) : null}
      </div>
      <dd className={cn("text-[length:var(--ct-text-xs)] tabular-nums", muted ? "text-[var(--ct-text-muted)] font-normal" : "text-[var(--ct-text-strong)] font-semibold")}>
        {value}
      </dd>
    </div>
  );
}
