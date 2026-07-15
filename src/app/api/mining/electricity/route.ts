/**
 * GET /api/mining/electricity
 *
 * The SPV's electricity position as the contract sees it — `elecStatus()` on
 * PermissionedDynaVault v2.1: monthly cost, payee, total paid to date, last
 * payment timestamp, and the contract's own `isPaidThisMonth` flag.
 *
 * ── Two blocks, two provenances, never merged ────────────────────────────────
 * The response deliberately keeps them apart:
 *
 *   `electricity` — the raw `Wired<T>` envelope from the adapter. Chain-read,
 *                   carries its own address / chainId / readAt.
 *   `cooldown`    — DERIVED. The 30-day remainder computed here, server-side,
 *                   from `lastElecPaymentTime`. Its own envelope
 *                   (`status: "derived"`) exists precisely so it can never be
 *                   mistaken for something the contract said. The contract said
 *                   a timestamp; the countdown is our arithmetic on top of it.
 *
 * Folding the countdown into the chain block would launder a computed value into
 * a chain-attested one. Hence the split.
 *
 * ── The cooldown never outlives its source ───────────────────────────────────
 * If the chain read is unavailable, the cooldown is unavailable too, and it
 * repeats the read's own reason. There is no "last known" countdown: a countdown
 * derived from a value we could not read would be fabricated, and a stale one
 * ticking down during an RPC outage is worse than none — it looks alive.
 *
 * ── Modes ────────────────────────────────────────────────────────────────────
 * legacy → `not_supported_by_legacy` (the deployed ERC-4626 vault knows nothing
 * about electricity), nothing deployed → `not_deployed`, RPC down → `rpc_error`.
 * HTTP 200 in all cases: the endpoint worked, the data is what it is.
 */
import { NextResponse } from "next/server";

import { readElecStatus } from "@/lib/chain/dynavault";
import { logger } from "@/lib/logger";
import { deriveElecCooldown, type ElecCooldown } from "@/lib/mining/elec-cooldown";
import { guardMiningRead } from "@/lib/mining/read-guard";
import { jsonSafe, toBigInt } from "@/lib/mining/wire-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The derived block's envelope. `status: "derived"` is its own word — not
 * `"wired"`, not `"live"` — so no consumer can read it as chain-attested.
 */
type ElecCooldownRead =
  | { status: "derived"; data: ElecCooldown }
  | { status: "unavailable"; reason: string; detail?: string };

export async function GET(): Promise<Response> {
  const guard = await guardMiningRead("mining-electricity");
  if (!guard.ok) return guard.response;

  try {
    const electricity = await readElecStatus();

    let cooldown: ElecCooldownRead;

    if (electricity.status !== "wired") {
      // Mirror the chain read's reason verbatim: whatever stopped us reading the
      // timestamp is exactly what stops us deriving from it.
      cooldown =
        electricity.detail === undefined
          ? { status: "unavailable", reason: electricity.reason }
          : {
              status: "unavailable",
              reason: electricity.reason,
              detail: electricity.detail,
            };
    } else {
      // The adapter owns decoding; we only assert the field is a whole timestamp.
      // A shape change surfaces here as `decode_error` instead of silently
      // producing a NaN countdown.
      const lastPaymentTimeSec = toBigInt(electricity.data.lastElecPaymentTime);

      if (lastPaymentTimeSec === null) {
        cooldown = {
          status: "unavailable",
          reason: "decode_error",
          detail: "lastElecPaymentTime n'est pas un timestamp entier.",
        };
      } else {
        const nowSec = BigInt(Math.floor(Date.now() / 1000));
        cooldown = {
          status: "derived",
          data: deriveElecCooldown(lastPaymentTimeSec, nowSec),
        };
      }
    }

    // `jsonSafe` on both: the cost / totalPaid fields are uint256 → bigint, and
    // JSON.stringify throws on those.
    return NextResponse.json(
      { electricity: jsonSafe(electricity), cooldown: jsonSafe(cooldown) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.error(
      "mining/electricity: on-chain read failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
