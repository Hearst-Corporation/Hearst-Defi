import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import {
  CHAIN_ID,
  getVaultMode,
  readElecStatus,
  readMiningMetrics,
  readStrategies,
  readVaultCore,
} from "@/lib/chain/dynavault";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import { jsonWired, safeRead } from "@/app/api/_shared/wired-json";

/**
 * GET /api/dashboard — the vault cockpit aggregate, read from the chain.
 *
 * ── Partial degradation, not all-or-nothing ──────────────────────────────────
 * The four blocks are INDEPENDENT `Wired<T>` envelopes. `core` can be `wired`
 * while `strategies` is `unavailable` — which is exactly what happens today in
 * legacy mode, where HearstYieldVault knows `totalAssets()` but has never heard
 * of a strategy. A single failing read must never blank the other three, and
 * must never be papered over with a fallback value.
 *
 * ── Legacy is the adapter's job, not this route's ────────────────────────────
 * There is no `if (mode === "legacy")` here on purpose. `src/lib/chain/dynavault.ts`
 * already answers `not_supported_by_legacy` for everything the deployed contract
 * cannot do. Re-deciding that here would create a second source of truth that
 * drifts. The route composes and forwards; it does not interpret.
 *
 * ── Zero fabricated data ─────────────────────────────────────────────────────
 * Every block is either read from a named contract at a named address at a named
 * instant, or explicitly `unavailable` WITH ITS REASON. An RPC outage
 * (`rpc_error`) stays distinguishable from an absence of data (`not_deployed`,
 * `not_supported_by_legacy`). No `0`, no `null` standing in for a number, no
 * `Live` badge over a hole.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 * `requireAuth` (any authenticated session), NOT `requireInvestor`: the latter
 * calls `redirect()`, which throws NEXT_REDIRECT — correct for a page, wrong for
 * a JSON route, where it would surface as an opaque 500 or a 307 to a login
 * page that no fetch caller can act on. Read-only vault telemetry is not
 * admin-reserved, but it is not public either: fail-closed 401 before any chain
 * access. Admins pass through (admin ⊇ investor), same as the product surfaces.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only, but rate-limited: every call fans out to four `eth_call`s against a
 * third-party RPC. Without a cap an authenticated client turns this route into a
 * free amplifier against our own provider quota.
 */
const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;

export async function GET(): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    await assertRateLimit(`dashboard:${userId}`, RATE_MAX, RATE_WINDOW_MS);
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  try {
    const [core, strategies, mining, electricity] = await Promise.all([
      safeRead("dashboard.core", readVaultCore),
      safeRead("dashboard.strategies", readStrategies),
      safeRead("dashboard.mining", readMiningMetrics),
      safeRead("dashboard.electricity", readElecStatus),
    ]);

    return NextResponse.json(
      {
        /** "v2" | "legacy" | "not_configured" — which contract answered. */
        mode: getVaultMode(),
        chainId: CHAIN_ID,
        core: jsonWired(core),
        strategies: jsonWired(strategies),
        mining: jsonWired(mining),
        electricity: jsonWired(electricity),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.error(
      "dashboard: aggregate read failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
