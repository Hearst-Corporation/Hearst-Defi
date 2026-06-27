export const dynamic = "force-dynamic";

import { Badge } from "@/components/catalyst/badge";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { MachineTable } from "@/components/admin/source/machine-table";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadMachineMarket } from "@/lib/telegram/read-machines";

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

const STATUS_BADGE: Record<BrickStatus, { color: "lime" | "amber" | "zinc"; label: string }> = {
  wired: { color: "lime", label: "Câblé" },
  todo: { color: "amber", label: "À câbler" },
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

export default async function SourcePage() {
  await requireAdmin();

  const market = await loadMachineMarket();
  const profitable = market.rows.filter(
    (r) => r.marginUsdPerThDay !== null && r.marginUsdPerThDay >= 0,
  ).length;

  return (
    <>
      <AdminPageHeader
        titleLead="Sources de"
        titleAccent="données"
        contextLabel="Strategy"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ct-space-4)]">
        {BRICKS.map((brick) => {
          const badge = STATUS_BADGE[brick.status];
          return (
            <Card
              key={brick.id}
              contentClassName="flex h-full flex-col gap-[var(--ct-space-2)]"
            >
              <div className="flex items-start justify-between gap-[var(--ct-space-3)]">
                <h3 className="body-sm font-semibold ct-text-strong">{brick.title}</h3>
                <Badge color={badge.color}>{badge.label}</Badge>
              </div>
              <p className="body-xs ct-text-muted">{brick.detail}</p>
            </Card>
          );
        })}
      </div>

      <Card contentClassName="flex flex-col gap-[var(--ct-space-4)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--ct-space-3)]">
          <div className="flex flex-col gap-[var(--ct-space-1)]">
            <h2 className="body-md font-semibold ct-text-strong">
              Prix machines — {market.channel}
            </h2>
            <p className="body-xs ct-text-muted">
              Liste {market.listDate ?? "n/a"} · {market.rows.length} machines ·{" "}
              {profitable} rentables · Énergie {market.energyUsdPerKwh * 100} ¢/kWh ·
              Prix ex-works (port/douane/install non inclus)
            </p>
          </div>
          <div className="text-right">
            <div className="body-xs ct-text-muted">Revenu (hashprice live)</div>
            <div className="body-sm font-semibold text-[var(--ct-accent)] tabular-nums">
              ${market.hashpriceUsdPerThDay.toFixed(5)}/TH/jour
              {market.hashpriceStale ? " (stale)" : ""}
            </div>
            <div className="body-xs ct-text-muted tabular-nums">
              BTC ${market.btcPriceUsd.toLocaleString()}
            </div>
          </div>
        </div>

        {!market.configured ? (
          <p className="body-xs ct-text-muted">
            Telegram non configuré. Renseignez TELEGRAM_API_ID / TELEGRAM_API_HASH
            / TELEGRAM_SESSION dans .env.local (login via{" "}
            <code>node scripts/telegram-login.mjs</code>).
          </p>
        ) : market.error ? (
          <p className="body-xs text-[var(--ct-status-danger,#ff6b6b)]">
            Lecture Telegram impossible : {market.error}
          </p>
        ) : market.rows.length === 0 ? (
          <p className="body-xs ct-text-muted">
            Aucune liste de prix exploitable dans les derniers messages.
          </p>
        ) : (
          <MachineTable rows={market.rows} />
        )}
      </Card>
    </>
  );
}
