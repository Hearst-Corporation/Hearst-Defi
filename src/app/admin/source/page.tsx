export const dynamic = "force-dynamic";

import {
  AdminPageShell,
  AdminSectionCard,
  AdminTableSurface,
} from "@/components/admin/admin-page-shell";
import { DestinationFilter } from "@/components/admin/source/destination-filter";
import { MachineTable } from "@/components/admin/source/machine-table";
import { Badge } from "@/components/catalyst/badge";
import { Card } from "@/components/catalyst/card";
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
 * Frame is admin canon; the body renders entirely on DS primitives (Card / Badge
 * / SegmentedControl / Table) — no local visual system.
 */

type BrickStatus = "wired" | "todo" | "tbd";

// Brick wiring status → DS Badge colour. "Câblé" = accent/success, the rest are
// quiet zinc — never a hand-rolled tinted span.
const STATUS_BADGE: Record<BrickStatus, { color: "green" | "zinc"; label: string }> = {
  wired: { color: "green", label: "Câblé" },
  todo: { color: "zinc", label: "À câbler" },
  tbd: { color: "zinc", label: "À définir" },
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
          AdminSectionCard, NOT a frame per panel (no double-frame). The bricks
          inside are DS Cards (flat material = dense module surface). */}
      <AdminSectionCard
        title="Pipeline de données"
        ariaLabel="Pipeline de données"
      >
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
          {BRICKS.map((brick) => {
            const badge = STATUS_BADGE[brick.status];
            return (
              <Card
                key={brick.id}
                material="flat"
                hoverOverlay={false}
                contentClassName="flex h-full flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="ct-panel-title">{brick.title}</h3>
                  <Badge color={badge.color} className="shrink-0">
                    {badge.label}
                  </Badge>
                </div>
                <p className="ct-metric-caption">{brick.detail}</p>
              </Card>
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
        ariaLabel="Prix machines"
      >
        <div className="flex flex-col gap-5 p-5">
          {/* Hashprice (revenue) metric — DS stat block. Full-width; stacks
              cleanly below the header on every slot (large/medium/chat-open). */}
          <Card
            material="flat"
            hoverOverlay={false}
            density="compact"
            contentClassName="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"
          >
            <div className="flex flex-col gap-1">
              <span className="ct-bento-label">Revenu (hashprice live)</span>
              <span className="ct-metric-value tabular-nums text-[var(--ct-accent)]">
                ${market.hashpriceUsdPerThDay.toFixed(5)}/TH/jour
                {market.hashpriceStale ? " (stale)" : ""}
              </span>
            </div>
            <span className="ct-metric-caption tabular-nums">
              BTC ${market.btcPriceUsd.toLocaleString()}
            </span>
          </Card>

          <DestinationFilter destination={destination} />

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
            <AdminTableSurface>
              <MachineTable rows={market.rows} />
            </AdminTableSurface>
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
              <Card
                key={v.id}
                material="flat"
                hoverOverlay={false}
                contentClassName="flex flex-col gap-1"
              >
                <div className="ct-panel-title">{v.label}</div>
                <div className="ct-metric-value mt-1 tabular-nums text-[var(--ct-accent)]">
                  {v.apyLow}% — {v.apyHigh}%
                </div>
                <div className="ct-metric-caption mt-2">
                  mining {v.allocation.miningPct}% · BTC {v.allocation.btcPct}% ·
                  USDC {v.allocation.usdcPct}%
                </div>
                <div className="ct-metric-caption">
                  drag emprunt −{v.borrowDragPct}%
                </div>
              </Card>
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
