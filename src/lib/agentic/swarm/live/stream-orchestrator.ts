import "server-only";

/**
 * Streamed product-construction orchestrator.
 *
 * Runs the FIVE named specialists SEQUENTIALLY, each a real `await`, emitting a
 * frame the moment that specialist's work finishes — so the workspace stepper
 * reveals genuine progress, never a cosmetic timer. Honest by construction: the
 * provenance/status reported per step is the REAL source state (live / degraded /
 * unavailable); a source that is stale or unconfigured is surfaced as such — no
 * fabricated number is presented as real.
 *
 *   1. Bitcoin            → fetchBtcPrice()      (oracle, then spot)
 *   2. Hashprice          → fetchHashprice()     (mempool difficulty + BTC)
 *   3. Mining Infra       → loadMachineMarket()  (Telegram prices → landed cost)
 *   4. DeFi               → runStrategyCross()   (best stable/BTC yields + band)
 *   5. Data Scientist     → runProductConstructionPipeline(withScenarios)
 *
 * The final draft reuses the SAME tested pipeline (allocation, 3 regimes, charts,
 * write-up) so there is zero duplicated math; intra-request fetch caching keeps
 * the re-read consistent with the per-step values shown above.
 */

import { fetchBtcPrice } from "@/lib/data/btc-price";
import { fetchHashprice } from "@/lib/data/hashprice";
import { loadMachineMarket } from "@/lib/telegram/read-machines";
import { COUNTRY_LABELS } from "@/lib/telegram/cost-model";
import { logger } from "@/lib/logger";

import { runStrategyCross } from "./runners-data";
import {
  runProductConstructionPipeline,
  isProductConstructionError,
} from "./pipeline";
import type { ConstructionStreamFrame } from "./stream-types";
import type { LiveProvenance } from "./types";

/** A frame sink — the route wraps this to push NDJSON into the response stream. */
export type EmitFrame = (frame: ConstructionStreamFrame) => void;

function btcProvenance(p: "oracle" | "live" | "stale"): LiveProvenance {
  return p === "oracle" ? "Oracle" : p === "stale" ? "Stale" : "Live";
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function signedPct(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r >= 0 ? "+" : "−"}${Math.abs(r)}%`;
}

/**
 * Run the full streamed construction. Never throws — a stage failure degrades to
 * an honest `unavailable`/`degraded` frame; only a total pipeline failure emits
 * an `error` frame. Returns when the stream is complete.
 */
export async function streamProductConstruction(
  objective: string,
  emit: EmitFrame,
): Promise<void> {
  const trimmed = objective.trim().slice(0, 220);
  if (trimmed.length === 0) {
    emit({ type: "error", message: "An objective is required." });
    return;
  }

  // ── 1 · Bitcoin Price Specialist ──────────────────────────────────────────
  emit({ type: "step_start", step: "bitcoin" });
  try {
    const btc = await fetchBtcPrice();
    if (btc.usd <= 0) {
      emit({
        type: "step_done",
        step: "bitcoin",
        status: "unavailable",
        provenance: null,
        headline: "BTC price unavailable — no live source responded.",
        metrics: [],
        note: "Neither the Chainlink oracle nor the spot source returned a price. No figure is invented.",
      });
    } else {
      emit({
        type: "step_done",
        step: "bitcoin",
        status: btc.stale ? "degraded" : "live",
        provenance: btcProvenance(btc.provenance),
        headline: `BTC spot ${usd(btc.usd)}`,
        metrics: [
          { label: "Spot", value: usd(btc.usd) },
          { label: "24h", value: signedPct(btc.usd_24h_change) },
          { label: "Source", value: btc.provenance === "oracle" ? "Chainlink oracle" : "Spot (CoinGecko)" },
        ],
        ...(btc.stale ? { note: "Price is older than the freshness SLO — flagged stale." } : {}),
      });
    }
  } catch (err) {
    logger.warn("[stream] bitcoin step failed", {}, err instanceof Error ? err : undefined);
    emit({ type: "step_done", step: "bitcoin", status: "error", provenance: null, headline: "Bitcoin read failed.", metrics: [] });
  }

  // ── 2 · Hashprice Specialist ──────────────────────────────────────────────
  emit({ type: "step_start", step: "hashprice" });
  try {
    const hp = await fetchHashprice();
    emit({
      type: "step_done",
      step: "hashprice",
      status: hp.stale ? "degraded" : "live",
      provenance: hp.stale ? "Stale" : "Live",
      headline: `Hashprice $${hp.usd_per_th_day.toFixed(3)} / TH / day`,
      metrics: [
        { label: "Hashprice", value: `$${hp.usd_per_th_day.toFixed(3)}/TH/day` },
        { label: "Difficulty", value: hp.difficulty.toExponential(2) },
        { label: "Block reward", value: `${hp.block_reward_btc} BTC` },
      ],
      ...(hp.stale ? { note: "mempool.space did not respond — using the last conservative reference." } : {}),
    });
  } catch (err) {
    logger.warn("[stream] hashprice step failed", {}, err instanceof Error ? err : undefined);
    emit({ type: "step_done", step: "hashprice", status: "error", provenance: null, headline: "Hashprice read failed.", metrics: [] });
  }

  // ── 3 · Mining Infrastructure Specialist ──────────────────────────────────
  emit({ type: "step_start", step: "mining_infra" });
  try {
    const mkt = await loadMachineMarket();
    if (!mkt.configured) {
      emit({
        type: "step_done",
        step: "mining_infra",
        status: "unavailable",
        provenance: null,
        headline: "No machine source configured.",
        metrics: [],
        note: "The Telegram machine-price channel is not configured — landed cost cannot be computed. No price is invented.",
      });
    } else if (mkt.rows.length === 0) {
      emit({
        type: "step_done",
        step: "mining_infra",
        status: "degraded",
        provenance: "Stale",
        headline: "Machine source reachable but no current price list parsed.",
        metrics: [{ label: "Destination", value: COUNTRY_LABELS[mkt.destination] }],
        note: mkt.error ?? "The latest channel messages did not parse into a price list.",
      });
    } else {
      let bestLanded: number | null = null;
      let bestMargin: number | null = null;
      let topModel: string | undefined;
      for (const r of mkt.rows) {
        if (bestLanded === null || r.landedUsd < bestLanded) bestLanded = r.landedUsd;
        if (r.marginUsdPerThDay !== null && (bestMargin === null || r.marginUsdPerThDay > bestMargin)) {
          bestMargin = r.marginUsdPerThDay;
          topModel = r.model;
        }
      }
      emit({
        type: "step_done",
        step: "mining_infra",
        status: mkt.hashpriceStale ? "degraded" : "live",
        provenance: mkt.hashpriceStale ? "Stale" : "Live",
        headline: `${mkt.rows.length} machines priced · best margin ${topModel ?? "—"}`,
        metrics: [
          { label: "Machines", value: String(mkt.rows.length) },
          { label: "Top by margin", value: topModel ?? "—" },
          { label: "Best margin", value: bestMargin !== null ? `$${bestMargin.toFixed(3)}/TH/day` : "—" },
          { label: "Best landed", value: bestLanded !== null ? usd(bestLanded) : "—" },
          { label: "Customs dest.", value: COUNTRY_LABELS[mkt.destination] },
          { label: "Energy", value: `$${mkt.energyUsdPerKwh.toFixed(2)}/kWh` },
        ],
        ...(mkt.listDate ? { note: `Price list dated ${mkt.listDate}.` } : {}),
      });
    }
  } catch (err) {
    logger.warn("[stream] mining_infra step failed", {}, err instanceof Error ? err : undefined);
    emit({ type: "step_done", step: "mining_infra", status: "error", provenance: null, headline: "Machine pricing failed.", metrics: [] });
  }

  // ── 4 · DeFi Specialist ───────────────────────────────────────────────────
  emit({ type: "step_start", step: "defi" });
  try {
    const strat = await runStrategyCross();
    const a = strat.artifact;
    emit({
      type: "step_done",
      step: "defi",
      status: a.provenance === "Stale" ? "degraded" : "live",
      provenance: a.provenance,
      headline: `Best stable yield ${a.usdcYieldPct.toFixed(1)}% · ${a.usdcSource}`,
      metrics: [
        { label: "USDC yield", value: `${a.usdcYieldPct.toFixed(1)}%` },
        { label: "Source", value: a.usdcSource },
        { label: "Mining net yield", value: `${a.miningYieldPct.toFixed(1)}%` },
        { label: "BTC band", value: `${signedPct(a.btcReturn.bear)} / ${signedPct(a.btcReturn.base)} / ${signedPct(a.btcReturn.bull)}` },
      ],
      ...(a.provenance === "Stale" ? { note: "Yield aggregator unconfigured — using configured reference levers." } : {}),
    });
  } catch (err) {
    logger.warn("[stream] defi step failed", {}, err instanceof Error ? err : undefined);
    emit({ type: "step_done", step: "defi", status: "error", provenance: null, headline: "DeFi yield read failed.", metrics: [] });
  }

  // ── 5 · Data Scientist (assemble the full draft) ──────────────────────────
  emit({ type: "step_start", step: "data_scientist" });
  try {
    const draft = await runProductConstructionPipeline(trimmed, { withScenarios: true });
    if (isProductConstructionError(draft)) {
      emit({ type: "step_done", step: "data_scientist", status: "error", provenance: null, headline: draft.message, metrics: [] });
      emit({ type: "error", message: draft.message });
      return;
    }
    const anyDegraded = draft.audit.some((a) => a.degraded);
    emit({
      type: "step_done",
      step: "data_scientist",
      status: anyDegraded ? "degraded" : "live",
      provenance: draft.quant.provenance,
      headline: `Headline APY ${(draft.quant.headlineRange.low * 100).toFixed(1)}–${(draft.quant.headlineRange.high * 100).toFixed(1)}%`,
      metrics: [
        { label: "Headline APY", value: `${(draft.quant.headlineRange.low * 100).toFixed(1)}–${(draft.quant.headlineRange.high * 100).toFixed(1)}%` },
        { label: "Paths", value: draft.quant.paths.toLocaleString("en-US") },
        { label: "Seed", value: String(draft.quant.seed) },
      ],
      ...(anyDegraded ? { note: "One or more upstream sources were degraded — the projection uses their flagged values." } : {}),
    });
    emit({ type: "final", draft });
  } catch (err) {
    logger.warn("[stream] data_scientist step failed", {}, err instanceof Error ? err : undefined);
    emit({ type: "step_done", step: "data_scientist", status: "error", provenance: null, headline: "Projection failed.", metrics: [] });
    emit({ type: "error", message: "Product construction failed." });
  }
}
