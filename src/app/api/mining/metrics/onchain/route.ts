/**
 * GET /api/mining/metrics/onchain
 *
 * The last mining metrics the keeper REPORTED ON-CHAIN — `miningMetrics()` on
 * PermissionedDynaVault v2.1 (hashrate TH/s, cumulative BTC earned in sats, last
 * report timestamp).
 *
 * ── What this is NOT ─────────────────────────────────────────────────────────
 * These are *attested* figures: whatever the keeper last pushed to the contract,
 * nothing more. They are not a live pool feed (that is `/api/mining/metrics`,
 * which is honestly unavailable today), and `lastReportedAt` is what tells a
 * consumer how stale they are. A number here can be weeks old and still be
 * perfectly "on-chain".
 *
 * ── Modes ────────────────────────────────────────────────────────────────────
 * Every state comes back inside the adapter's `Wired<T>` envelope, unflattened:
 *   • v2 configured    → `wired`, with address + chainId + readAt
 *   • legacy vault     → `unavailable` / `not_supported_by_legacy` (the deployed
 *     HearstYieldVault is a plain ERC-4626 — it has no mining surface at all)
 *   • nothing deployed → `unavailable` / `not_deployed`
 *   • RPC down         → `unavailable` / `rpc_error`
 * An outage and an absence stay distinguishable. That is the point of the
 * envelope, so it is passed through rather than unwrapped.
 *
 * HTTP 200 carries an `unavailable` body on purpose: the route did its job. A
 * 5xx would mean *this endpoint* broke, which is a different fact and one the
 * caller must be able to tell apart.
 */
import { NextResponse } from "next/server";

import { readMiningMetrics } from "@/lib/chain/dynavault";
import { logger } from "@/lib/logger";
import { guardMiningRead } from "@/lib/mining/read-guard";
import { jsonSafe } from "@/lib/mining/wire-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const guard = await guardMiningRead("mining-metrics-onchain");
  if (!guard.ok) return guard.response;

  try {
    // The adapter is contractually non-throwing (failures come back as
    // `unavailable`), so this resolves to a value in every normal case.
    const metrics = await readMiningMetrics();

    // `jsonSafe` and not a bare `metrics`: the uint256 fields decode to bigint,
    // which JSON.stringify throws on. Without this the route would 500 the
    // moment the chain actually answers.
    return NextResponse.json(
      { metrics: jsonSafe(metrics) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // Belt and braces: if the adapter ever does throw, that is a bug in the
    // adapter, not something to leak to the client.
    logger.error(
      "mining/metrics/onchain: on-chain read failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
