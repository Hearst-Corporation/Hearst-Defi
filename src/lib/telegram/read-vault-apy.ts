import "server-only";

import { loadMachineMarket } from "./read-machines";
import { computeMachineStrategy } from "./strategy-model";
import { composeVaultApy } from "./vault-apy";
import { parseMachinePriceMessage } from "./parse-machine-price";
import { getTelegramClient, isTelegramConfigured } from "./client";
import { fetchHashprice } from "@/lib/data/hashprice";
import { fetchDefiLlama } from "@/lib/data/defillama";
import { getProjectionAssumptionsConfig } from "@/lib/projection/assumptions-config";
import type { DestinationCountry } from "./cost-model";

/**
 * Server-only loader: composes the live vault APY ranges from the three buckets.
 *
 * - Mining yield: best LP mining yield among the parsed machines (the fleet
 *   would be built from the chosen models; we surface the top achievable yield).
 * - USDC yield: best live pool from DeFiLlama.
 * - BTC: a scenario band (bear/base/bull) — the most uncertain input — taken from
 *   defaults here; the admin can later make it an input.
 *
 * Never throws: degrades to conservative defaults with stale flags.
 */

export interface VaultApyView {
  id: string;
  label: string;
  apyLow: number;
  apyHigh: number;
  allocation: { miningPct: number; btcPct: number; usdcPct: number };
  borrowDragPct: number;
}

export interface VaultApySnapshot {
  configured: boolean;
  miningYieldPct: number;
  usdcYieldPct: number;
  usdcSource: string;
  btcReturn: { bear: number; base: number; bull: number };
  vaults: VaultApyView[];
  assumptions: string[];
  disclaimer: string;
  /** Provenance of the company levers (status CONFIGURED, not live/validated). */
  companyAssumptions: {
    source: string;
    status: string;
    notes: string[];
    markupPct: number;
    revenueSharePct: number;
    borrowAprPct: number;
    feePct: number;
  };
}

export async function loadVaultApy(
  destination: DestinationCountry = "uae",
): Promise<VaultApySnapshot> {
  // Company levers now come from an EXPLICIT, traceable layer (status CONFIGURED,
  // NOT live/validated) via the CENTRALIZED config service (single seam for a
  // future DB/admin source) — see src/lib/projection/assumptions-config.ts.
  const company = getProjectionAssumptionsConfig().company;
  const MARKUP_PCT = company.markupPct;
  const COMPANY_SHARE_PCT = company.revenueSharePct;
  const BTC_RETURN = {
    bear: company.btcScenarios.bearPct,
    base: company.btcScenarios.basePct,
    bull: company.btcScenarios.bullPct,
  };
  const BORROW_APR_PCT = company.borrowAprPct;
  const FEES_PCT = company.feePct;
  const VAULT_BOUNDS = company.vaultBounds;

  const [market, defi] = await Promise.all([
    loadMachineMarket(undefined, destination),
    fetchDefiLlama(),
  ]);

  const usdcYieldPct = round2(defi.apyMedianPct);
  const usdcSource = defi.topYields[0]?.project ?? "fallback";

  // Best achievable LP mining yield across the parsed fleet (machines that price
  // through end-to-end, i.e. have efficiency). Uses the live hashprice.
  let miningYieldPct = 0;
  if (market.configured && market.rows.length > 0) {
    const hashprice = market.hashpriceUsdPerThDay;
    let best = 0;
    // Re-derive from the same samples for strategy yield (markup + share).
    const samples = await reparseSamples(market.channel);
    for (const s of samples) {
      const r = computeMachineStrategy(s, {
        markupPct: MARKUP_PCT,
        companySharePct: COMPANY_SHARE_PCT,
        destination,
        hashpriceUsdPerThDay: hashprice,
      });
      if (r.lpMiningYieldPct !== null && r.lpMiningYieldPct > best) {
        best = r.lpMiningYieldPct;
      }
    }
    miningYieldPct = round2(best);
  }

  const vaults: VaultApyView[] = Object.entries(VAULT_BOUNDS).map(
    ([id, cfg]) => {
      const r = composeVaultApy({
        miningYieldPct,
        usdcYieldPct,
        btcReturn: BTC_RETURN,
        borrowAprPct: BORROW_APR_PCT,
        avgLtv: cfg.avgLtv,
        feesPct: FEES_PCT,
        bounds: cfg.bounds,
      });
      return {
        id,
        label: cfg.label,
        apyLow: r.apyLow,
        apyHigh: r.apyHigh,
        allocation: r.allocation,
        borrowDragPct: r.borrowDragPct,
      };
    },
  );

  // Reuse one composition's assumptions/disclaimer for the page footer.
  const ref = composeVaultApy({
    miningYieldPct,
    usdcYieldPct,
    btcReturn: BTC_RETURN,
    borrowAprPct: BORROW_APR_PCT,
    avgLtv: 0.5,
    feesPct: FEES_PCT,
  });

  return {
    configured: market.configured,
    miningYieldPct,
    usdcYieldPct,
    usdcSource,
    btcReturn: BTC_RETURN,
    vaults,
    assumptions: ref.assumptions,
    disclaimer: ref.disclaimer,
    companyAssumptions: {
      source: company.metadata.source,
      status: company.metadata.status,
      notes: company.metadata.notes,
      markupPct: company.markupPct,
      revenueSharePct: company.revenueSharePct,
      borrowAprPct: company.borrowAprPct,
      feePct: company.feePct,
    },
  };
}

/** Re-read the channel's best message to get the raw samples for strategy calc. */
async function reparseSamples(channel: string) {
  if (!isTelegramConfigured()) return [];
  try {
    const client = await getTelegramClient();
    const messages = await client.getMessages(channel, { limit: 8 });
    let best: ReturnType<typeof parseMachinePriceMessage>["samples"] = [];
    for (const msg of messages) {
      if (!msg.message) continue;
      const p = parseMachinePriceMessage(msg.message);
      if (p.samples.length > best.length) best = p.samples;
    }
    return best;
  } catch {
    return [];
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
