/**
 * GET /api/mining/metrics
 *
 * Live mining metrics from the pool (Antpool).
 *
 * ── This route returns no numbers today, and that is correct ────────────────
 * The original brief called for a "stub until credentials are configured". No
 * stub was written. Verified against the repo: there is no Antpool integration
 * of any kind — no client, no credentials, no env var, no cache table, no
 * mention anywhere in `src/`, `.env.example`, `src/lib/env.ts`, `prisma/` or
 * `docs/`. A stub would therefore have to invent every figure it returned, and
 * an invented figure served from a route named "live mining metrics" is the
 * exact failure this codebase treats as the worst one available. So the route
 * ships honest: it says the provider is not configured, and says nothing else.
 *
 * The moment a real client lands, it lands inside `readPoolMetrics()` and this
 * route stops changing — the `"live"` variant is already declared there.
 *
 * ── Deliberately not backed by MiningMetric / market-data-hourly ────────────
 * The obvious "fallback" would be the `MiningMetric` table. It is off-limits:
 * the `market-data-hourly` cron that fills it writes hardcoded constants
 * (`uptimePct: 98.5`, `deployedHashrate: 182_000`) and has been dead since
 * 2026-07-07. Serving those here would relabel a constant as a live pool read —
 * a lie with a timestamp on it. Fixing that cron is a separate chantier.
 *
 * ── Shape ────────────────────────────────────────────────────────────────────
 * The unavailable envelope mirrors the `Wired<T>` vocabulary (`status` +
 * `reason`) so the UI treats it uniformly, but it carries NO address / chainId /
 * source: this is an HTTP provider, not a chain read, and claiming chain
 * provenance for it would be false.
 *
 * `reason` is `provider_not_configured` — outside `WiredChip`'s known set, so the
 * chip degrades to its explicit "Motif inconnu" branch and surfaces the raw
 * reason. That is the intended, honest degradation: an unrecognised reason is
 * shown, never silently rendered as "no data".
 *
 * HTTP 200: the endpoint worked. The provider is simply absent, which is a fact
 * about the world, not a server fault.
 */
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { readPoolMetrics } from "@/lib/mining/pool-provider";
import { guardMiningRead } from "@/lib/mining/read-guard";
import { jsonSafe } from "@/lib/mining/wire-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const guard = await guardMiningRead("mining-metrics-pool");
  if (!guard.ok) return guard.response;

  try {
    const { read, missingVars } = await readPoolMetrics();

    // Which credentials are missing is an operator concern, not a client one:
    // it goes to the log, never into the response body.
    if (missingVars.length > 0) {
      logger.info("mining/metrics: pool provider not configured", {
        provider: "antpool",
        missingVars: missingVars.join(","),
      });
    }

    return NextResponse.json(
      { provider: "antpool", metrics: jsonSafe(read) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.error(
      "mining/metrics: pool read failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
