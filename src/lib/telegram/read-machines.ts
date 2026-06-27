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

/**
 * Server-only loader: reads the latest machine price list from a Telegram
 * channel, parses + prices it, and joins the live hashprice (revenue $/TH/day)
 * so the /admin/source table can show per-machine margins.
 *
 * NEVER throws. When Telegram is unconfigured or unreachable, returns a result
 * with `configured: false` / empty rows so the page renders a "set up" state.
 * (Mirrors the codebase convention of degrading to a provenance-flagged state
 * rather than crashing — see hashprice.ts fallback.)
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

    return { ...base, configured: true, listDate, rows };
  } catch (err) {
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
