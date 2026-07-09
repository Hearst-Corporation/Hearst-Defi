import "server-only";

import { getTelegramClient, isTelegramConfigured } from "./client";
import { parseMachinePriceMessage } from "./parse-machine-price";
import {
  computeMachineEconomics,
  feesForDestination,
  ENERGY_COST_USD_PER_KWH,
  DEFAULT_DESTINATION,
  type MachineEconomics,
  type DestinationCountry,
} from "./cost-model";
import { fetchHashprice } from "@/lib/data/hashprice";
import { prisma } from "@/lib/db";

/**
 * Server-only loader: reads the latest machine price list from a Telegram
 * channel, parses + prices it, and joins the live hashprice (revenue $/TH/day)
 * so the /admin/source table can show per-machine margins.
 *
 * Every successful Telegram read is persisted to `TelegramMachineMarketSnapshot`/
 * `Row` (Prisma). NEVER throws: when Telegram is unconfigured or the read fails,
 * falls back to the latest DB-cached snapshot for that channel+destination
 * (`configured: true` + an explanatory `error`) instead of degrading to an empty
 * state — only returns `configured: false` / empty rows when there is no cache
 * to fall back to. (Mirrors the codebase convention of degrading to a
 * provenance-flagged state rather than crashing — see hashprice.ts fallback.)
 */

export interface MachineRow extends MachineEconomics {
  /** Revenue − total cost, in $/TH/day. Null when efficiency unknown. */
  marginUsdPerThDay: number | null;
}

export interface MachineMarketSnapshot {
  configured: boolean;
  channel: string;
  /** Destination country used for customs duty in the landed cost. */
  destination: DestinationCountry;
  /** Date string from the parsed list header (yyyy-mm-dd) or null. */
  listDate: string | null;
  /** Live hashprice (revenue) in $/TH/day. */
  hashpriceUsdPerThDay: number;
  btcPriceUsd: number;
  /** True if the hashprice came from the conservative fallback. */
  hashpriceStale: boolean;
  energyUsdPerKwh: number;
  rows: MachineRow[];
  /** Set when ingestion failed despite being configured. */
  error?: string;
}

const DEFAULT_CHANNEL = "@LetineSidonia";
const MESSAGES_TO_SCAN = 8;

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v);
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
}

async function readLatestPersistedMachineMarket(
  channel: string,
  destination: DestinationCountry,
): Promise<MachineMarketSnapshot | null> {
  const snap = await prisma.telegramMachineMarketSnapshot.findFirst({
    where: { channel, destination },
    orderBy: { takenAt: "desc" },
    include: { rows: { orderBy: { landedUsd: "asc" } } },
  });
  if (!snap) return null;

  const rows: MachineRow[] = snap.rows.map((r) => ({
    model: r.model,
    manufacturer: r.manufacturer as MachineRow["manufacturer"],
    cooling: r.cooling as MachineRow["cooling"],
    region: r.region as MachineRow["region"],
    thPerUnit: toNumber(r.thPerUnit),
    efficiencyJTh: r.efficiencyJTh === null ? null : toNumber(r.efficiencyJTh),
    efficiencySource: r.efficiencySource as MachineRow["efficiencySource"],
    exWorksUsd: toNumber(r.exWorksUsd),
    feesUsd: toNumber(r.feesUsd),
    landedUsd: toNumber(r.landedUsd),
    amortMonths: r.amortMonths,
    capexUsdPerThDay: toNumber(r.capexUsdPerThDay),
    energyUsdPerThDay:
      r.energyUsdPerThDay === null ? null : toNumber(r.energyUsdPerThDay),
    totalCostUsdPerThDay:
      r.totalCostUsdPerThDay === null ? null : toNumber(r.totalCostUsdPerThDay),
    marginUsdPerThDay:
      r.marginUsdPerThDay === null ? null : toNumber(r.marginUsdPerThDay),
  }));

  return {
    configured: snap.configured,
    channel: snap.channel,
    destination: snap.destination as DestinationCountry,
    listDate: snap.listDate,
    hashpriceUsdPerThDay: toNumber(snap.hashpriceUsdPerThDay),
    btcPriceUsd: toNumber(snap.btcPriceUsd),
    hashpriceStale: snap.hashpriceStale,
    energyUsdPerKwh: toNumber(snap.energyUsdPerKwh),
    rows,
    error: snap.error ?? undefined,
  };
}

async function persistMachineMarketSnapshot(input: {
  channel: string;
  destination: DestinationCountry;
  listDate: string | null;
  hashpriceUsdPerThDay: number;
  btcPriceUsd: number;
  hashpriceStale: boolean;
  energyUsdPerKwh: number;
  configured: boolean;
  rows: MachineRow[];
  error?: string;
  source?: string;
}): Promise<void> {
  await prisma.telegramMachineMarketSnapshot.create({
    data: {
      channel: input.channel,
      destination: input.destination,
      listDate: input.listDate,
      hashpriceUsdPerThDay: input.hashpriceUsdPerThDay,
      btcPriceUsd: input.btcPriceUsd,
      hashpriceStale: input.hashpriceStale,
      energyUsdPerKwh: input.energyUsdPerKwh,
      configured: input.configured,
      error: input.error ?? null,
      source: input.source ?? "telegram",
      rows: {
        create: input.rows.map((r) => ({
          model: r.model,
          manufacturer: r.manufacturer,
          cooling: r.cooling,
          region: r.region,
          thPerUnit: r.thPerUnit,
          efficiencyJTh: r.efficiencyJTh,
          efficiencySource: r.efficiencySource,
          exWorksUsd: r.exWorksUsd,
          feesUsd: r.feesUsd,
          landedUsd: r.landedUsd,
          amortMonths: r.amortMonths,
          capexUsdPerThDay: r.capexUsdPerThDay,
          energyUsdPerThDay: r.energyUsdPerThDay,
          totalCostUsdPerThDay: r.totalCostUsdPerThDay,
          marginUsdPerThDay: r.marginUsdPerThDay,
        })),
      },
    },
  });
}

export async function loadMachineMarket(
  channel: string = DEFAULT_CHANNEL,
  destination: DestinationCountry = DEFAULT_DESTINATION,
): Promise<MachineMarketSnapshot> {
  const hp = await fetchHashprice();
  const fees = feesForDestination(destination);
  const base: Omit<MachineMarketSnapshot, "configured" | "rows" | "listDate"> = {
    channel,
    destination,
    hashpriceUsdPerThDay: hp.usd_per_th_day,
    btcPriceUsd: hp.btc_price_usd,
    hashpriceStale: hp.stale,
    energyUsdPerKwh: ENERGY_COST_USD_PER_KWH,
  };

  if (!isTelegramConfigured()) {
    const cached = await readLatestPersistedMachineMarket(channel, destination);
    if (cached) {
      return {
        ...cached,
        configured: true,
        error:
          "Telegram is not configured on this runtime. Serving latest DB-cached machine snapshot.",
      };
    }
    return { ...base, configured: false, listDate: null, rows: [] };
  }

  try {
    const client = await getTelegramClient();
    const messages = await client.getMessages(channel, { limit: MESSAGES_TO_SCAN });

    // Pick the newest message that actually parses into samples.
    let listDate: string | null = null;
    let bestCount = -1;
    let bestSamples: ReturnType<typeof parseMachinePriceMessage>["samples"] = [];
    for (const msg of messages) {
      const text = msg.message;
      if (!text) continue;
      const parsed = parseMachinePriceMessage(text);
      if (parsed.samples.length > bestCount) {
        bestCount = parsed.samples.length;
        bestSamples = parsed.samples;
        listDate = parsed.listDate;
      }
    }

    const rows: MachineRow[] = bestSamples.map((sample) => {
      const econ = computeMachineEconomics(sample, fees);
      const marginUsdPerThDay =
        econ.totalCostUsdPerThDay === null
          ? null
          : round6(hp.usd_per_th_day - econ.totalCostUsdPerThDay);
      return { ...econ, marginUsdPerThDay };
    });

    await persistMachineMarketSnapshot({
      channel,
      destination,
      listDate,
      hashpriceUsdPerThDay: hp.usd_per_th_day,
      btcPriceUsd: hp.btc_price_usd,
      hashpriceStale: hp.stale,
      energyUsdPerKwh: ENERGY_COST_USD_PER_KWH,
      configured: true,
      rows,
      source: "telegram_live",
    });

    return { ...base, configured: true, listDate, rows };
  } catch (err) {
    const cached = await readLatestPersistedMachineMarket(channel, destination);
    if (cached) {
      return {
        ...cached,
        configured: true,
        error: `Telegram read failed; serving latest DB-cached snapshot. ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
    return {
      ...base,
      configured: true,
      listDate: null,
      rows: [],
      error: err instanceof Error ? err.message : "Telegram read failed",
    };
  }
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
