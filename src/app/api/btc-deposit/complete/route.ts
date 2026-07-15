import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  guardKeeperRequest,
  keeperError,
  readJsonBody,
} from "@/lib/chain/keeper-guard";
import { logger } from "@/lib/logger";

/**
 * POST /api/btc-deposit/complete — GATED, VALIDATED, and honestly UNAVAILABLE.
 *
 * ── The gap (spec §5 ↔ contract §2) ─────────────────────────────────────────
 * `docs/VAULT_SPEC_V2.1.md` §5 lists this keeper endpoint ("Compléter un dépôt
 * BTC"), but §2 — the contract's actual owner/keeper surface — specifies NO
 * BTC-deposit flow at all: no `initiate`, no `complete`, no state machine, and
 * not even a documented request body. On top of that the contract is not
 * deployed (the app runs in `legacy` / not-configured mode).
 *
 * The surface is therefore present, fail-closed and validated, and returns an
 * honest `not_supported` (501). It presumes NOTHING about the payload: the body
 * schema is a STRICT empty object, because inventing a deposit id (or an amount,
 * or a txid) would be inventing a slice of an interface the spec never defined.
 * The day §2 grows a real BTC-deposit function, tighten this schema and replace
 * the `notSupported(...)` return with a `guardKeeperRequest`-gated keeper call —
 * a one-liner, same shape as `/api/rebalancing/execute`.
 *
 * Invents NO contract function; touches neither `keeper.ts` nor `dynavault.ts`.
 *
 * ⚠️ THIS ROUTE MOVES NO FUNDS. It signs nothing and touches no chain.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Human-approved, occasional keeper surface. Not a hot path. */
const KEEPER_RATE_MAX = 5;

/**
 * Nothing is presumed about the payload — the BTC-deposit flow is unspecified
 * (spec §2 defines no body). A strict empty object accepts a no-body POST and
 * rejects ANY key, so no caller can believe a field they sent was honoured.
 */
const BtcDepositCompleteSchema = z.object({}).strict();

/**
 * 501 Not Implemented — the HTTP surface exists, the contract flow does not.
 * Built here rather than via `keeperError` (whose reason union is closed and
 * owned by `keeper-guard.ts`). No chain detail, no exception text.
 */
function notSupported(reason: string, detail: string): NextResponse {
  return NextResponse.json(
    { error: "The BTC deposit flow is not available on this deployment.", reason, detail },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  // Fail-closed preamble (requireAdmin → body size → rate-limit → kill-switch),
  // identical to the shipped keeper routes.
  const guard = await guardKeeperRequest(
    request,
    "keeper:btc-deposit-complete",
    KEEPER_RATE_MAX,
  );
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return keeperError("invalid_body");

  const parsed = BtcDepositCompleteSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body.",
        reason: "invalid_body",
        issues: z.flattenError(parsed.error),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Past every gate with a well-formed (empty) body — and there is STILL nothing
  // to call. No BTC-deposit flow exists in the contract surface (see header).
  logger.info("[keeper] btc-deposit/complete reached but unsupported", {
    userId: guard.admin.userId,
  });

  return notSupported(
    "not_supported",
    "PermissionedDynaVault v2.1 §2 specifies no BTC-deposit flow, and the contract is not deployed. Nothing was attempted on-chain.",
  );
}
