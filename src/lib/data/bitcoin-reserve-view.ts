import "server-only";

import { cache } from "react";

import type { Provenance } from "@/components/ui/provenance-badge";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { fetchHashprice } from "@/lib/data/hashprice";
import { loadCustody } from "@/lib/data/custody";
import { loadMiningMetrics, type InvestorShareInput } from "@/lib/data/mining-metrics";
import { networkHashrateThs as deriveNetworkHashrateThs } from "@/lib/engine/hashprice-formula";
import {
  computeFleetProduction,
  computeHalvingCountdown,
  computeProductionEconomics,
  simulateFutureValue,
  type HalvingCountdown,
  type ProductionEconomics,
  type SimulateFutureValueOutput,
} from "@/lib/engine/mining-economics";
import type { MachineRow } from "@/lib/telegram/read-machines";
import { loadMachineMarket } from "@/lib/telegram/read-machines";

/**
 * bitcoin-reserve-view — the single composer for every BTC-hero figure shared
 * by the Dashboard (/portfolio) and Bitcoin Reserve (/bitcoin-reserve) pages.
 *
 * One assembly point so both pages read the SAME honest numbers instead of
 * each re-deriving hashprice/cost/reserve independently and drifting. Every
 * field carries its own provenance — this module never upgrades a derived
 * figure to "live"/"attested" and never fabricates a value when a source is
 * unavailable (falls back to null + "stale"/"estimated" as appropriate).
 */

export interface ValueWithProvenance<T> {
  value: T;
  provenance: Provenance;
}

export interface BitcoinReserveView {
  /** BTC spot price. Oracle (Chainlink) when available, else Live (CoinGecko), else Stale fallback. */
  btcPrice: ValueWithProvenance<number>;
  /** Network hashrate (TH/s) + difficulty, from mempool.space. Live, or Stale on outage. */
  networkHashrateThs: ValueWithProvenance<number>;
  difficulty: ValueWithProvenance<number>;
  /** Halving countdown, derived from the same difficulty-tuple block height. Estimated (10-min block-time assumption). */
  halving: ValueWithProvenance<HalvingCountdown>;
  /** Real custody BTC reserve balance — Attested (same feed as the USDC PoR figure), never derived. */
  btcReserve: ValueWithProvenance<number>;
  /**
   * Mining economics (cost to produce 1 BTC, margin, break-even price) —
   * Estimated: a pure derivation over live price/hashrate + a reference
   * machine cost basis, never a measurement. Null when no machine-market
   * data is available to derive a cost basis from.
   */
  economics: ValueWithProvenance<ProductionEconomics> | null;
  /**
   * Fleet production estimate (BTC/day/month/year) from MiningMetric fleet
   * telemetry — Estimated. The underlying `deployedHashrate`/`uptimePct`
   * columns are fed by hardcoded cron placeholders (see
   * market-data-hourly.ts), so this can never be Live. Null when the
   * MiningMetric table is empty (fresh DB / no cron run yet).
   */
  fleetProduction: ValueWithProvenance<{ btcPerDay: number; btcPerMonth: number; btcPerYear: number }> | null;
  /** Future Value Simulator over the current BTC reserve. Estimated (deterministic what-if, not a forecast). */
  futureValue: ValueWithProvenance<SimulateFutureValueOutput>;
}

/**
 * Assemble the Bitcoin Strategic Reserve view. Every network call is
 * best-effort (each source already degrades to a stale/fallback shape
 * internally — see fetchBtcPrice / fetchHashprice / loadCustody) so a single
 * upstream outage degrades its own field's provenance rather than throwing.
 *
 * `share` — optional investor slice (principal ÷ vault capacity) to scale the
 * fleet-production estimate down from fleet-wide to "this investor's share",
 * exactly like `loadMiningMetrics` already does for the Dashboard's mining
 * tiles. Omit for an operation-level (unscaled) view.
 */
export const loadBitcoinReserveView = cache(
  async (share?: InvestorShareInput): Promise<BitcoinReserveView> => {
    const [btc, hashprice, custody, miningMetrics, machineMarket] = await Promise.all([
      fetchBtcPrice(),
      fetchHashprice(),
      loadCustody(),
      loadMiningMetrics(share),
      loadMachineMarket(),
    ]);

    const btcPrice: ValueWithProvenance<number> = {
      value: btc.usd,
      provenance: btc.provenance,
    };

    const networkHashrateThs: ValueWithProvenance<number> = {
      value: hashprice.difficulty > 0 ? deriveNetworkHashrateThs(hashprice.difficulty) : 0,
      provenance: hashprice.stale ? "stale" : "live",
    };

    const difficulty: ValueWithProvenance<number> = {
      value: hashprice.difficulty,
      provenance: hashprice.stale ? "stale" : "live",
    };

    const halving: ValueWithProvenance<HalvingCountdown> = {
      value: computeHalvingCountdown({
        currentBlockHeight: hashprice.block_height,
        now: new Date(),
      }),
      provenance: "estimated",
    };

    const btcReserve: ValueWithProvenance<number> = {
      value: custody.totalBtcReserves,
      provenance: "attested",
    };

    // Reference cost basis: the cheapest landed machine in the current
    // market snapshot (same "basis" selection /portfolio already uses for
    // its allocated-hashrate estimate) — a real, current cost figure, not an
    // invented one. Null when no machine-market data exists at all.
    const costBasis = selectCostBasis(machineMarket.rows);
    const economics: ValueWithProvenance<ProductionEconomics> | null =
      costBasis && networkHashrateThs.value > 0 && costBasis.totalCostUsdPerThDay !== null
        ? {
            value: computeProductionEconomics({
              totalCostUsdPerThDay: costBasis.totalCostUsdPerThDay,
              networkHashrateThs: networkHashrateThs.value,
              btcPriceUsd: btcPrice.value,
            }),
            provenance: "estimated",
          }
        : null;

    const fleetProduction: ValueWithProvenance<{ btcPerDay: number; btcPerMonth: number; btcPerYear: number }> | null =
      miningMetrics && networkHashrateThs.value > 0
        ? {
            value: computeFleetProduction({
              fleetHashrateThs: fleetHashrateThsFromAllocated(miningMetrics.allocatedHashrate),
              networkHashrateThs: networkHashrateThs.value,
            }),
            provenance: "estimated",
          }
        : null;

    const futureValue: ValueWithProvenance<SimulateFutureValueOutput> = {
      value: simulateFutureValue({
        btcReserve: btcReserve.value,
        currentBtcPriceUsd: btcPrice.value,
      }),
      provenance: "estimated",
    };

    return {
      btcPrice,
      networkHashrateThs,
      difficulty,
      halving,
      btcReserve,
      economics,
      fleetProduction,
      futureValue,
    };
  },
);

/** "13.0 PH/s" → 13000 (TH/s). Parses the formatted string mining-metrics.ts already produces rather than re-deriving it, so the two stay consistent. */
function fleetHashrateThsFromAllocated(allocatedHashrate: string): number {
  const match = /^([\d.]+)\s*PH\/s$/.exec(allocatedHashrate.trim());
  if (!match) return 0;
  const ph = Number(match[1]);
  return Number.isFinite(ph) ? ph * 1_000 : 0;
}

/**
 * Cheapest landed machine, preferring Bitmain — the SAME basis-selection rule
 * /portfolio already applies for its allocated-hashrate estimate (see
 * `machineBasis` in portfolio/page.tsx). `machineMarket.rows` are already
 * fully-computed `MachineEconomics` (landedUsd, totalCostUsdPerThDay etc. —
 * see cost-model.ts::computeMachineEconomics), so no re-derivation here.
 */
function selectCostBasis(rows: readonly MachineRow[]): MachineRow | null {
  const bitmainRows = rows.filter((r) => r.manufacturer === "bitmain");
  return (
    [...bitmainRows].sort((a, b) => a.landedUsd - b.landedUsd)[0] ??
    [...rows].sort((a, b) => a.landedUsd - b.landedUsd)[0] ??
    null
  );
}
