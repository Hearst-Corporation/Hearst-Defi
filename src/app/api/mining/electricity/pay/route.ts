import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  auditKeeperAttempt,
  clientReason,
  guardKeeperRequest,
  keeperError,
  readJsonBody,
} from "@/lib/chain/keeper-guard";
import { payElectricity } from "@/lib/chain/keeper";
import { logger } from "@/lib/logger";

/**
 * POST /api/mining/electricity/pay
 *
 * Calls `payElectricity()` on PermissionedDynaVault v2.1.
 *
 * ⚠️ THIS ROUTE MOVES FUNDS — it transfers USDC out of the vault to `elecPayee`.
 * It is the most consequential endpoint in the keeper lot, and the one in
 * sharpest tension with ADR-018's red line ("never hold a key, sign a
 * transaction, or move funds"). That line is scoped to Crews/Swarms; here the
 * trigger is an authenticated human admin, which is ADR-018 §5's human gate.
 * `docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md` (Lot 6) defers the
 * question to ADR-019, which does not exist yet. Until it does:
 *   • NO cron, NO agent, NO chat tool may reach this route;
 *   • `KEEPER_ENABLED` stays OFF by default.
 *
 * Takes no arguments: the amount and the payee are contract state
 * (`monthlyElecCost`, `elecPayee`), set by the owner — not by this caller. The
 * body must be empty; a payload here would mean the caller thinks they control
 * the amount, and we reject rather than silently ignore it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A monthly operation. 5/60s is already far more headroom than it needs. */
const RATE_MAX = 5;

/**
 * `.strict()` on an empty object: `{}` passes, anything else is a 400. This is
 * deliberate — silently discarding an `{ amountUsdc: 5000 }` that the contract
 * will never read would leave the caller believing they set the amount.
 */
const PayElectricitySchema = z.object({}).strict();

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await guardKeeperRequest(request, "keeper:electricity-pay", RATE_MAX);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return keeperError("invalid_body");

  const parsed = PayElectricitySchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "This endpoint takes no parameters — the amount and payee are contract state (monthlyElecCost / elecPayee), set by the owner.",
        reason: "invalid_body",
        issues: z.flattenError(parsed.error),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await payElectricity();

  if (result.status === "blocked") {
    logger.warn("[keeper] payElectricity blocked", {
      userId: guard.admin.userId,
      reason: result.reason,
      detail: result.detail,
    });
    return keeperError(clientReason(result.reason));
  }

  await auditKeeperAttempt({
    admin: guard.admin,
    action: "keeper.payElectricity",
    entityId: result.address,
    after: { txHash: result.txHash, chainId: result.chainId },
    request,
  });

  logger.info("[keeper] payElectricity sent — funds moved", {
    userId: guard.admin.userId,
    txHash: result.txHash,
  });

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
