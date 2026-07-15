import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  auditKeeperAttempt,
  clientReason,
  guardKeeperRequest,
  keeperError,
  readJsonBody,
} from "@/lib/chain/keeper-guard";
import { reportMiningMetrics } from "@/lib/chain/keeper";
import { logger } from "@/lib/logger";

/**
 * POST /api/mining/metrics/report
 *
 * Reports the mining oracle values on-chain:
 * `reportMiningMetrics(uint256 hashrateTh, uint256 btcEarnedSats)`.
 *
 * Human-gated by construction (`requireAdmin()`), kill-switched
 * (`KEEPER_ENABLED`, default OFF), rate-limited and audited. See the governance
 * note at the top of `src/lib/chain/keeper.ts` — this route must NOT be wired to
 * a cron, an agent, or a chat tool without ADR-019 first.
 *
 * This one only writes an attestation; it moves no funds. It is still gated the
 * same way: it feeds numbers investors see.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 10;

/**
 * 1e9 TH/s = 1000 EH/s — comfortably above the entire Bitcoin network's hashrate.
 * A value past this is a unit error or a fat-finger, not a reading.
 */
const MAX_HASHRATE_TH = 1_000_000_000;

/**
 * 21e6 BTC in satoshis. No cumulative BTC figure can ever exceed total supply.
 * 2.1e15 < Number.MAX_SAFE_INTEGER (9.007e15), so this bound is exactly
 * representable as a double — every accepted value round-trips through
 * `BigInt()` without precision loss.
 */
const MAX_BTC_EARNED_SATS = 2_100_000_000_000_000;

const ReportSchema = z
  .object({
    hashrateTh: z
      .number()
      .int("hashrateTh must be a whole number of TH/s")
      .min(0, "hashrateTh cannot be negative")
      .max(MAX_HASHRATE_TH, "hashrateTh exceeds the plausible network maximum"),
    btcEarnedSats: z
      .number()
      .int("btcEarnedSats must be a whole number of satoshis")
      .min(0, "btcEarnedSats cannot be negative")
      .max(MAX_BTC_EARNED_SATS, "btcEarnedSats exceeds the total BTC supply"),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await guardKeeperRequest(request, "keeper:mining-metrics", RATE_MAX);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return keeperError("invalid_body");

  const parsed = ReportSchema.safeParse(body.value);
  if (!parsed.success) {
    // Every message in this schema is one of our own strings (above), never an
    // internal. `flattenError` in full: an unknown key lands in `formErrors`, not
    // `fieldErrors`, so returning only the latter would answer a rejected stray
    // key with an empty `issues: {}`.
    return NextResponse.json(
      {
        error: "Invalid request body.",
        reason: "invalid_body",
        issues: z.flattenError(parsed.error),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await reportMiningMetrics(parsed.data);

  if (result.status === "blocked") {
    // `detail` is logged, never returned.
    logger.warn("[keeper] reportMiningMetrics blocked", {
      userId: guard.admin.userId,
      reason: result.reason,
      detail: result.detail,
    });
    return keeperError(clientReason(result.reason));
  }

  await auditKeeperAttempt({
    admin: guard.admin,
    action: "keeper.reportMiningMetrics",
    entityId: result.address,
    after: {
      txHash: result.txHash,
      chainId: result.chainId,
      hashrateTh: parsed.data.hashrateTh,
      btcEarnedSats: parsed.data.btcEarnedSats,
    },
    request,
  });

  logger.info("[keeper] reportMiningMetrics sent", {
    userId: guard.admin.userId,
    txHash: result.txHash,
  });

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
