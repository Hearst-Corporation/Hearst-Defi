import "server-only";

import { fetchHashprice } from "@/lib/data/hashprice";
import { fetchBtcPrice } from "@/lib/data/btc-price";
import { fetchDefiLlama } from "@/lib/data/defillama";
import { getProjectionAssumptionsConfig } from "./assumptions-config";

/**
 * source-truth-summary.ts — server-only aggregator that resolves the PROVENANCE
 * of every input/output feeding the projection, into a flat list of truth
 * statuses for /admin/projection badges.
 *
 * Honest by construction: a value is LIVE only when its loader reports live;
 * fallback/stale → FALLBACK; assumptions → CONFIGURED; risk baselines →
 * UNAUDITED; vol index → MOCK (no live feed). Never throws — degrades each row
 * to FALLBACK rather than failing the page.
 */

export type SourceTruthStatus =
  | "LIVE"
  | "FALLBACK"
  | "CONFIGURED"
  | "MOCK"
  | "DEMO"
  | "UNAUDITED"
  | "PARTIAL"
  | "MIXED";

export interface SourceTruthRow {
  /** Input or output label. */
  label: string;
  status: SourceTruthStatus;
  /** Optional value for display. */
  detail?: string;
  /** Reason when fallback/stale. */
  reason?: string;
  kind: "input" | "output";
}

export interface SourceTruthSummary {
  rows: SourceTruthRow[];
  counts: Record<SourceTruthStatus, number>;
  /** Overall = MIXED whenever statuses differ (they always do here). */
  overall: SourceTruthStatus;
  /** Always GO ADMIN ONLY until every blocker clears. */
  verdict: "GO ADMIN ONLY";
}

export async function loadSourceTruthSummary(): Promise<SourceTruthSummary> {
  const rows: SourceTruthRow[] = [];

  // ── Live market inputs (provenance per loader) ─────────────────────────────
  try {
    const btc = await fetchBtcPrice();
    const live = btc.usd > 0 && !btc.stale;
    rows.push({
      kind: "input",
      label: "BTC price",
      status: live ? "LIVE" : "FALLBACK",
      detail: btc.usd > 0 ? `$${Math.round(btc.usd).toLocaleString()}` : "—",
      reason: live ? undefined : "stale or unavailable",
    });
  } catch {
    rows.push({ kind: "input", label: "BTC price", status: "FALLBACK", reason: "fetch failed" });
  }

  try {
    const hp = await fetchHashprice();
    rows.push({
      kind: "input",
      label: "Hashprice",
      status: hp.stale ? "FALLBACK" : "LIVE",
      detail: `$${hp.usd_per_th_day}/TH/j`,
      reason: hp.stale ? "stale or fallback" : undefined,
    });
  } catch {
    rows.push({ kind: "input", label: "Hashprice", status: "FALLBACK", reason: "fetch failed" });
  }

  try {
    const defi = await fetchDefiLlama();
    const live = defi.source === "live" && !defi.stale;
    rows.push({
      kind: "input",
      label: "Stable yield (USDC)",
      status: live ? "LIVE" : "FALLBACK",
      detail: `${defi.apyMedianPct}%`,
      reason: live ? undefined : defi.source !== "live" ? "defillama unavailable" : "stale",
    });
  } catch {
    rows.push({ kind: "input", label: "Stable yield (USDC)", status: "FALLBACK", reason: "fetch failed" });
  }

  // ── Configured / unaudited assumptions ─────────────────────────────────────
  const cfg = getProjectionAssumptionsConfig();
  rows.push({
    kind: "input",
    label: "Company assumptions",
    status: "CONFIGURED",
    detail: `markup ${cfg.company.markupPct}% · share ${cfg.company.revenueSharePct}%`,
  });
  rows.push({ kind: "input", label: "Risk references", status: "CONFIGURED" });
  rows.push({ kind: "input", label: "Smart-contract risk", status: "UNAUDITED", reason: "pré-audit Spearbit" });
  rows.push({ kind: "input", label: "Counterparty risk", status: "UNAUDITED", reason: "pré-audit Spearbit" });
  rows.push({ kind: "input", label: "Mining cost assumptions", status: "CONFIGURED" });
  rows.push({ kind: "input", label: "Vol index", status: "MOCK", reason: "pas de feed vol 30j live" });

  // ── Outputs ────────────────────────────────────────────────────────────────
  rows.push({ kind: "output", label: "APY range", status: "MIXED", reason: "live inputs + configured assumptions" });
  rows.push({ kind: "output", label: "p5/p50/p95", status: "PARTIAL", reason: "déterministe, inputs partiels" });
  rows.push({ kind: "output", label: "Risk score", status: "CONFIGURED" });

  // Tally.
  const counts: Record<SourceTruthStatus, number> = {
    LIVE: 0, FALLBACK: 0, CONFIGURED: 0, MOCK: 0, DEMO: 0, UNAUDITED: 0, PARTIAL: 0, MIXED: 0,
  };
  for (const r of rows) {
    if (r.status in counts) counts[r.status] += 1;
  }

  return { rows, counts, overall: "MIXED", verdict: "GO ADMIN ONLY" };
}
