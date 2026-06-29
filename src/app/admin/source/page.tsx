export const dynamic = "force-dynamic";

import Link from "next/link";

import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { MachineTable } from "@/components/admin/source/machine-table";
import { BentoPanel } from "@/components/catalyst/bento";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadMachineMarket } from "@/lib/telegram/read-machines";
import { loadVaultApy } from "@/lib/telegram/read-vault-apy";
import {
  COUNTRY_LABELS,
  CUSTOMS_DUTY_PCT,
  FREIGHT_USD_PER_UNIT,
  DEFAULT_DESTINATION,
  type DestinationCountry,
} from "@/lib/telegram/cost-model";

/**
 * Strategy · Source — the data-ingestion control surface.
 *
 * Every input that feeds the Scenario Engine is sourced, dated and given a
 * provenance badge HERE, before it reaches the pure engine (`src/lib/engine/*`
 * never fetches). Built one brick at a time:
 *
 *   1. BTC price              — Chainlink / Coingecko
 *   2. Hashprice / difficulty — mempool.space → deriveHashpriceUsdPerThDay()
 *   3. Stable yields          — multi-source USDC / USDT → blended rate
 *   4. Machine prices         — Telegram channels → daily average → amortized $/TH/day
 *
 * For now this only frames the four sections; each gets wired in turn.
 */

type BrickStatus = "wired" | "todo" | "tbd";

const STATUS_CHIP: Record<BrickStatus, { accent: boolean; label: string }> = {
  wired: { accent: true, label: "Câblé" },
  todo: { accent: false, label: "À câbler" },
  tbd: { accent: false, label: "À définir" },
};

const BRICKS: ReadonlyArray<{
  id: string;
  title: string;
  detail: string;
  status: BrickStatus;
}> = [
  {
    id: "btc-price",
    title: "BTC price",
    detail: "Chainlink + Coingecko fallback.",
    status: "todo",
  },
  {
    id: "hashprice",
    title: "Hashprice / difficulty",
    detail: "mempool.space → hashprice $/TH/jour (formule pure existante).",
    status: "todo",
  },
  {
    id: "stable-yields",
    title: "Stable yields (USDC / USDT)",
    detail: "Sources multiples → blended (méthode à arrêter avec Adrien).",
    status: "tbd",
  },
  {
    id: "machine-prices",
    title: "Prix machines (Telegram)",
    detail:
      "Canaux Telegram → moyenne journalière → amortissement (air 3 ans / hydro 5 ans) → $/TH/jour.",
    status: "wired",
  },
];

const COUNTRY_ORDER: DestinationCountry[] = [
  "china",
  "uae",
  "france",
  "usa",
  "russia",
];

/** Tinted bento chip — brick wiring status. */
function StatusChip({
  accent,
  children,
}: {
  accent: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "ct-bento-label inline-flex items-center rounded-full border px-2.5 py-0.5",
        accent
          ? "border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
          : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

function resolveDestination(raw: string | undefined): DestinationCountry {
  return raw && raw in CUSTOMS_DUTY_PCT
    ? (raw as DestinationCountry)
    : DEFAULT_DESTINATION;
}

export default async function SourcePage({
  searchParams,
}: {
  searchParams: Promise<{ dest?: string }>;
}) {
  await requireAdmin();

  const { dest } = await searchParams;
  const destination = resolveDestination(dest);

  const [market, apy] = await Promise.all([
    loadMachineMarket(undefined, destination),
    loadVaultApy(destination),
  ]);
  const profitable = market.rows.filter(
    (r) => r.marginUsdPerThDay !== null && r.marginUsdPerThDay >= 0,
  ).length;

  return (
    <AdminPageShell
      titleLead="Sources de"
      titleAccent="données"
      contextLabel="Strategy"
    >
      {/* Canon frame around the GROUP of ingestion bricks — a single
          AdminSectionCard, NOT a frame per panel (no double-frame). */}
      <AdminSectionCard
        title="Pipeline de données"
        ariaLabel="Pipeline de données"
      >
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
          {BRICKS.map((brick) => {
            const chip = STATUS_CHIP[brick.status];
            return (
              <BentoPanel key={brick.id}>
                <div className="flex h-full flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="ct-panel-title">{brick.title}</h3>
                    <StatusChip accent={chip.accent}>{chip.label}</StatusChip>
                  </div>
                  <p className="ct-metric-caption">{brick.detail}</p>
                </div>
              </BentoPanel>
            );
          })}
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title={`Prix machines — ${market.channel}`}
        subtitle={
          <>
            Liste {market.listDate ?? "n/a"} · {market.rows.length} machines ·{" "}
            {profitable} rentables · Énergie {market.energyUsdPerKwh * 100} ¢/kWh
            · Landed = ex-works + port ${FREIGHT_USD_PER_UNIT} + douane{" "}
            {CUSTOMS_DUTY_PCT[destination]}% ({COUNTRY_LABELS[destination]})
          </>
        }
        headerTrailing={
          <div className="text-right">
            <div className="ct-bento-label">Revenu (hashprice live)</div>
            <div className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
              ${market.hashpriceUsdPerThDay.toFixed(5)}/TH/jour
              {market.hashpriceStale ? " (stale)" : ""}
            </div>
            <div className="ct-metric-caption tabular-nums">
              BTC ${market.btcPriceUsd.toLocaleString()}
            </div>
          </div>
        }
        ariaLabel="Prix machines"
      >
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ct-bento-label">Destination</span>
            {COUNTRY_ORDER.map((c) => (
              <Link
                key={c}
                href={
                  c === DEFAULT_DESTINATION
                    ? "/admin/source"
                    : `/admin/source?dest=${c}`
                }
                className={cn(
                  "ct-metric-caption rounded-lg border px-3 py-1 transition-colors",
                  destination === c
                    ? "border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
                    : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)] hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] hover:text-[var(--ct-text-strong)]",
                )}
              >
                {COUNTRY_LABELS[c]} · {CUSTOMS_DUTY_PCT[c]}%
              </Link>
            ))}
          </div>

          {!market.configured ? (
            <p className="ct-metric-caption">
              Telegram non configuré. Renseignez TELEGRAM_API_ID /
              TELEGRAM_API_HASH / TELEGRAM_SESSION dans .env.local (login via{" "}
              <code className="font-mono text-[var(--ct-text-secondary)]">
                node scripts/telegram-login.mjs
              </code>
              ).
            </p>
          ) : market.error ? (
            <p className="ct-metric-caption text-[var(--ct-status-danger)]">
              Lecture Telegram impossible : {market.error}
            </p>
          ) : market.rows.length === 0 ? (
            <p className="ct-metric-caption">
              Aucune liste de prix exploitable dans les derniers messages.
            </p>
          ) : (
            <MachineTable rows={market.rows} />
          )}
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title="APY range par vault"
        subtitle={
          <>
            Mining {apy.miningYieldPct}% · USDC {apy.usdcYieldPct}% (
            {apy.usdcSource}) · BTC scénario {apy.btcReturn.bear}/
            {apy.btcReturn.base}/+{apy.btcReturn.bull}% · allocation dérivée
            risk-adjusted
          </>
        }
        ariaLabel="APY range par vault"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {apy.vaults.map((v) => (
              <div
                key={v.id}
                className="rounded-2xl border border-[var(--ct-border)] bg-surface-inset p-4"
              >
                <div className="ct-panel-title">{v.label}</div>
                <div className="stat-value mt-1 tabular-nums">
                  {v.apyLow}% — {v.apyHigh}%
                </div>
                <div className="ct-metric-caption mt-2">
                  mining {v.allocation.miningPct}% · BTC {v.allocation.btcPct}% ·
                  USDC {v.allocation.usdcPct}%
                </div>
                <div className="ct-metric-caption">
                  drag emprunt −{v.borrowDragPct}%
                </div>
              </div>
            ))}
          </div>
          <ul className="ct-metric-caption flex flex-col gap-1">
            {apy.assumptions.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
          <p className="ct-metric-caption italic">{apy.disclaimer}</p>
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
