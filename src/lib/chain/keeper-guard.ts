import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isKeeperEnabled, type KeeperBlockedReason } from "@/lib/chain/keeper";
import { logger } from "@/lib/logger";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";

/**
 * The HTTP preamble shared by the three keeper routes. Three routes that each
 * move money must not each re-implement fail-closed auth — one gate, one place
 * to audit, one place to get it wrong.
 *
 * Order is non-negotiable and fail-closed:
 *   1. `requireAdmin()`  — BEFORE any chain/DB/env access. 401/403.
 *   2. body size         — before `req.json()`, so an oversized payload cannot
 *                          exhaust memory.
 *   3. rate limit        — 429.
 *   4. kill-switch       — 503. AFTER auth on purpose: whether the keeper is
 *                          armed is not something an anonymous caller may probe.
 * The Zod body parse and the chain call happen in the route, after this returns.
 */

/** Reasons a client may legitimately be told. Closed set — no free-form strings. */
export type KeeperErrorReason =
  | KeeperBlockedReason
  /** Key missing OR malformed — collapsed so the response never describes the
   *  shape of the secret. The precise cause goes to the server log. */
  | "keeper_key_unavailable"
  | "invalid_body"
  | "swap_reverted"
  | "rebalance_failed";

export interface KeeperAdmin {
  userId: string;
  walletAddress?: string;
}

export type KeeperGuardResult =
  | { ok: true; admin: KeeperAdmin }
  | { ok: false; response: NextResponse };

/**
 * `AdminAudit.actorWallet` is non-null; an admin may have no wallet on file, so
 * fall back to the user id — same convention as `admin/proofs/actions.ts`.
 */
function actorWalletOf(admin: KeeperAdmin): string {
  return admin.walletAddress ?? admin.userId;
}

/**
 * Map a keeper block to an HTTP status.
 *
 * The repo's core rule — an outage must be DISCERNIBLE from an absence of data —
 * is what drives this table. A 503 means "the system cannot serve this right
 * now"; a 422 means "the chain was reached and it refused".
 */
function statusForReason(reason: KeeperErrorReason): number {
  switch (reason) {
    case "keeper_disabled":
    case "not_deployed":
    case "keeper_key_unavailable":
    case "key_missing":
    case "key_malformed":
    case "rpc_error":
      return 503;
    case "revert":
    case "swap_reverted":
      return 422;
    case "rebalance_failed":
      return 502;
    case "invalid_body":
      return 400;
  }
}

/** Client-safe, human-readable line per reason. No revert strings, no internals. */
const REASON_MESSAGES: Record<KeeperErrorReason, string> = {
  keeper_disabled:
    "The keeper is disabled. Set KEEPER_ENABLED=1 to arm it.",
  keeper_key_unavailable:
    "The keeper signing key is not available on this deployment.",
  key_missing: "The keeper signing key is not available on this deployment.",
  key_malformed: "The keeper signing key is not available on this deployment.",
  not_deployed:
    "PermissionedDynaVault is not deployed on this network. Nothing was attempted on-chain.",
  rpc_error:
    "The chain could not be reached. Nothing was confirmed — this is a read/transport failure, not an absence of data.",
  revert: "The contract rejected the call. No state was changed.",
  swap_reverted:
    "The swap transaction was mined but reverted. The rebalance step was not attempted.",
  rebalance_failed:
    "The swap landed but the rebalance step did not complete. The vault is mid-sequence and needs manual review.",
  invalid_body: "Invalid request body.",
};

/** Collapse the two key failures into one client-facing reason. */
export function clientReason(reason: KeeperBlockedReason): KeeperErrorReason {
  return reason === "key_missing" || reason === "key_malformed"
    ? "keeper_key_unavailable"
    : reason;
}

/**
 * Build an error response. `detail` is intentionally NOT a parameter: revert
 * strings and RPC internals stay in the server log.
 */
export function keeperError(
  reason: KeeperErrorReason,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    { error: REASON_MESSAGES[reason], reason, ...extra },
    { status: statusForReason(reason), headers: { "Cache-Control": "no-store" } },
  );
}

export async function guardKeeperRequest(
  request: NextRequest,
  rateKeyPrefix: string,
  rateMax: number,
  rateWindowMs = 60_000,
): Promise<KeeperGuardResult> {
  // 1. Fail-closed auth, before anything else touches env, chain or DB.
  let admin: KeeperAdmin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    // requireAdmin's messages are known-safe, but we still answer with our own
    // fixed strings rather than echoing an exception to the client.
    const raw = err instanceof Error ? err.message : "";
    const unauthenticated = raw.toLowerCase().includes("authentication required");
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: unauthenticated
            ? "Authentication required."
            : "Admin access required.",
        },
        {
          status: unauthenticated ? 401 : 403,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    };
  }

  // 2 + 3. Size then rate. Both throw; neither message reaches the client.
  try {
    await assertBodySize(request);
    await assertRateLimit(
      `${rateKeyPrefix}:${admin.userId}`,
      rateMax,
      rateWindowMs,
    );
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests — try again in a moment." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  // 4. Kill-switch. Default OFF.
  if (!isKeeperEnabled()) {
    logger.warn("[keeper] blocked: KEEPER_ENABLED is not set", {
      userId: admin.userId,
      route: rateKeyPrefix,
    });
    return { ok: false, response: keeperError("keeper_disabled") };
  }

  return { ok: true, admin };
}

/**
 * Read a JSON body without letting a malformed payload become a 500.
 * An empty body is `{}` so a no-argument POST (`payElectricity`) does not need a
 * dummy payload — the Zod schema still gets to reject unknown keys.
 */
export async function readJsonBody(
  request: NextRequest,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const raw = await request.text();
    if (raw.trim().length === 0) return { ok: true, value: {} };
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * Audit an attempt that got past every gate — i.e. one that actually reached (or
 * tried to reach) the chain, whatever the outcome. Gate rejections are logged
 * but not audited: they change no state, and an audit row per 429/503 would let
 * a noisy admin bury the rows that matter.
 *
 * Never throws: an audit-write failure must not turn a landed transaction into a
 * 500 that tells the operator their tx failed when it did not.
 */
export async function auditKeeperAttempt(params: {
  admin: KeeperAdmin;
  action: string;
  entityId: string;
  after: Record<string, unknown>;
  request: NextRequest;
}): Promise<void> {
  try {
    const ip = params.request.headers.get("x-forwarded-for") ?? undefined;
    const userAgent = params.request.headers.get("user-agent") ?? undefined;
    await recordAdminAudit({
      actorWallet: actorWalletOf(params.admin),
      action: params.action,
      entityType: "DynaVaultKeeper",
      entityId: params.entityId,
      after: params.after,
      ...(ip !== undefined ? { ip } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
  } catch (err) {
    logger.error(
      "[keeper] audit write failed — the on-chain action still happened",
      { action: params.action, entityId: params.entityId },
      err instanceof Error ? err : undefined,
    );
  }
}
