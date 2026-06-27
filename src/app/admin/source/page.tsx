export const dynamic = "force-dynamic";

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { MachineTable } from "@/components/admin/source/machine-table";
import { BentoPanel, BentoHeader } from "@/components/ui/bento";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadMachineMarket } from "@/lib/telegram/read-machines";
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        accent
          ? "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]"
          : "border-white/10 bg-white/5 text-zinc-400",
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

  const market = await loadMachineMarket(undefined, destination);
  const profitable = market.rows.filter(
    (r) => r.marginUsdPerThDay !== null && r.marginUsdPerThDay >= 0,
  ).length;

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Sources de"
          titleAccent="données"
          contextLabel="Strategy"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {BRICKS.map((brick) => {
            const chip = STATUS_CHIP[brick.status];
            return (
              <BentoPanel key={brick.id}>
                <div className="flex h-full flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[13px] font-semibold text-white">
                      {brick.title}
                    </h3>
                    <StatusChip accent={chip.accent}>{chip.label}</StatusChip>
                  </div>
                  <p className="text-[12px] text-zinc-500">{brick.detail}</p>
                </div>
              </BentoPanel>
            );
          })}
        </div>

        <BentoPanel>
          <BentoHeader
            title={`Prix machines — ${market.channel}`}
            subtitle={
              <>
                Liste {market.listDate ?? "n/a"} · {market.rows.length} machines
                · {profitable} rentables · Énergie{" "}
                {market.energyUsdPerKwh * 100} ¢/kWh · Landed = ex-works + port $
                {FREIGHT_USD_PER_UNIT} + douane {CUSTOMS_DUTY_PCT[destination]}% (
                {COUNTRY_LABELS[destination]})
              </>
            }
            trailing={
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Revenu (hashprice live)
                </div>
                <div className="text-[13px] font-semibold tabular-nums text-[#A7FB90]">
                  ${market.hashpriceUsdPerThDay.toFixed(5)}/TH/jour
                  {market.hashpriceStale ? " (stale)" : ""}
                </div>
                <div className="text-[12px] tabular-nums text-zinc-500">
                  BTC ${market.btcPriceUsd.toLocaleString()}
                </div>
              </div>
            }
          />

          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                Destination
              </span>
              {COUNTRY_ORDER.map((c) => (
                <Link
                  key={c}
                  href={
                    c === DEFAULT_DESTINATION
                      ? "/admin/source"
                      : `/admin/source?dest=${c}`
                  }
                  className={cn(
                    "rounded-lg border px-3 py-1 text-[12px] transition-colors",
                    destination === c
                      ? "border-[#A7FB90]/40 bg-[#A7FB90]/10 text-[#A7FB90]"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {COUNTRY_LABELS[c]} · {CUSTOMS_DUTY_PCT[c]}%
                </Link>
              ))}
            </div>

            {!market.configured ? (
              <p className="text-[12px] text-zinc-500">
                Telegram non configuré. Renseignez TELEGRAM_API_ID /
                TELEGRAM_API_HASH / TELEGRAM_SESSION dans .env.local (login via{" "}
                <code className="font-mono text-zinc-300">
                  node scripts/telegram-login.mjs
                </code>
                ).
              </p>
            ) : market.error ? (
              <p className="text-[12px] text-rose-400">
                Lecture Telegram impossible : {market.error}
              </p>
            ) : market.rows.length === 0 ? (
              <p className="text-[12px] text-zinc-500">
                Aucune liste de prix exploitable dans les derniers messages.
              </p>
            ) : (
              <MachineTable rows={market.rows} />
            )}
          </div>
        </BentoPanel>
      </div>
    </div>
  );
}
