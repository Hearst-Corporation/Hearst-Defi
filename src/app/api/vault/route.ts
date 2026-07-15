import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import {
  getVaultMode,
  readVaultCore,
  UNAVAILABLE_REASONS,
  type VaultMode,
} from "@/lib/chain/dynavault";
import {
  derivedFrom,
  REASON_NOT_EXPOSED_BY_CONTRACT,
  serializeWired,
  unavailableJson,
  type JsonSafe,
  type WiredJson,
  type WiredOk,
} from "@/lib/chain/wired-json";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vault -- vault-level state: totalAssets, totalShares, tvlCap and the
 * derived utilization (totalAssets / tvlCap).
 *
 * ## Auth: `requireAuth()`, and why not `requireInvestor()`
 *
 * The brief asked investor-or-admin, not public: the vault's TVL, cap and
 * utilization are product state, and an anonymous caller has no business
 * reading them. But `requireInvestor()` is page-shaped, not API-shaped -- it
 * calls `redirect()`, which in a Route Handler throws NEXT_REDIRECT and answers
 * 307 to /login instead of 401. A JSON client would parse an HTML login page as
 * a vault. It is used nowhere under src/app/api/** for exactly that reason.
 *
 * `requireAuth()` is the Route-Handler analogue and is SEMANTICALLY IDENTICAL
 * here: `UserRole` is the closed union "admin" | "investor" (see
 * lib/auth/session.ts `normaliseRole`), so any valid session is one or the
 * other, which is precisely `requireInvestor`'s allow-list (admin includes
 * investor). Fail-closed: no session -> 401 before any chain read.
 *
 * ## ONE read, not two -- there is no `readTvlCap()`
 *
 * `tvlCap` is a FIELD of `VaultCore` (see dynavault.ts), so `readVaultCore()`
 * already returns totalAssets + totalShares + navPerShare + asset + tvlCap +
 * paused in a single batch. A separate cap read would be a second RPC round
 * trip for a value we already hold, at a DIFFERENT instant -- i.e. a torn read:
 * utilization would divide a totalAssets from t0 by a cap from t1 and stamp the
 * result with one of the two. One read means one coherent envelope, and every
 * field below legitimately reuses its `readAt` / `address` / `source`.
 *
 * ## `tvlCap: null` means NOT EXPOSED -- never zero
 *
 * dynavault.ts is explicit: legacy HearstYieldVault has no cap at all, so
 * `VaultCore.tvlCap` is `null` there. `null` is "this contract does not expose
 * it", NOT "the cap is 0". Treating it as 0 would make utilization divide by
 * zero (Infinity/NaN) or render an uncapped vault as 100% full. So a null cap
 * yields an `unavailable` envelope with the motive that actually applies:
 * `not_supported_by_legacy` in legacy mode (the adapter's own vocabulary, which
 * the UI already labels), `not_exposed_by_contract` otherwise.
 *
 * A cap that is genuinely `0n` on-chain is a DIFFERENT case: the read succeeded,
 * so `tvlCap` ships wired as "0" (that is the truth), while utilization reports
 * `tvl_cap_zero` -- undefined, not 0%.
 *
 * ## Shape
 *
 * The three fields carry INDEPENDENT `Wired` envelopes rather than one envelope
 * over a flat object, because their availability genuinely differs: in legacy
 * mode `totalAssets`/`totalShares` are readable while `tvlCap` is not.
 * Collapsing them would force the whole response to the worst case and hide
 * readable data behind an unavailable one.
 */

/** Basis points denominator. Utilization is reported in bps -- integer, no float drift. */
const BPS_DENOMINATOR = 10_000n;

const READS_PER_MINUTE = 60;
const RATE_WINDOW_MS = 60_000;

/**
 * tvlCap is 0 -> utilization is UNDEFINED (division by zero), not 0% and not
 * 100%. An uncapped or not-yet-configured vault must not render as "empty".
 */
const REASON_TVL_CAP_ZERO = "tvl_cap_zero";

type VaultCoreRead = Awaited<ReturnType<typeof readVaultCore>>;

/**
 * Payload shape derived from the adapter's own return type rather than importing
 * a named type: the route stays correct if the adapter grows a field, and the
 * generic `jsonSafe` pass-through means we never have to enumerate them.
 */
type VaultCoreData = Extract<VaultCoreRead, { status: "wired" }>["data"];

export interface VaultApiResponse {
  /** What the app is pointed at right now: "v2" | "legacy" | "not_configured". */
  mode: VaultMode;
  core: WiredJson<JsonSafe<VaultCoreData>>;
  /** uint256 as a decimal string, in asset units (USDC, 6 decimals). */
  tvlCap: WiredJson<string>;
  utilization: WiredJson<{ bps: number }>;
}

/**
 * The cap is absent from the contract itself. Pick the motive that is actually
 * true rather than a generic one: an operator reading "not_supported_by_legacy"
 * knows to deploy v2, whereas "not_exposed_by_contract" on a v2 target means the
 * ABI and the deployment disagree. Neither is an outage -- that stays
 * `rpc_error`, and only `rpc_error`.
 */
function capNotExposed<J>(core: WiredOk<VaultCoreData>): WiredJson<J> {
  return core.source === "legacy"
    ? unavailableJson<J>(
        UNAVAILABLE_REASONS.NOT_SUPPORTED_BY_LEGACY,
        "The legacy HearstYieldVault has no tvlCap: the cap is unknown, not unlimited and not zero.",
      )
    : unavailableJson<J>(
        REASON_NOT_EXPOSED_BY_CONTRACT,
        "This vault does not expose tvlCap.",
      );
}

/**
 * Utilization in basis points.
 *
 * NOT clamped to 10_000 on purpose: a vault over its cap is a real, reportable
 * condition and clamping would hide it behind a tidy 100%. Callers must have
 * established `tvlCap > 0n` -- this divides.
 */
function utilizationBps(totalAssets: bigint, tvlCap: bigint): number {
  return Number((totalAssets * BPS_DENOMINATOR) / tvlCap);
}

/** `tvlCap` on the wire: derived from the core read, envelope reused. */
function serializeTvlCap(core: VaultCoreRead): WiredJson<string> {
  // Propagate the UPSTREAM motive rather than a generic one: "rpc_error" and
  // "not_deployed" must stay distinguishable downstream.
  if (core.status === "unavailable") {
    return unavailableJson<string>(core.reason, core.detail);
  }

  const cap = core.data.tvlCap;
  if (cap === null) return capNotExposed<string>(core);

  // A real 0 IS the answer here -- only utilization is undefined by it.
  return derivedFrom(core, cap.toString());
}

function deriveUtilization(core: VaultCoreRead): WiredJson<{ bps: number }> {
  if (core.status === "unavailable") {
    return unavailableJson<{ bps: number }>(core.reason, core.detail);
  }

  const { totalAssets, tvlCap } = core.data;
  if (tvlCap === null) return capNotExposed<{ bps: number }>(core);
  if (tvlCap <= 0n) {
    return unavailableJson<{ bps: number }>(
      REASON_TVL_CAP_ZERO,
      "tvlCap is 0: utilization is undefined, not 0%.",
    );
  }

  // Both inputs come from the SAME read, so the envelope's readAt is exact --
  // no "stalest of N" reconciliation to get wrong.
  return derivedFrom(core, { bps: utilizationBps(totalAssets, tvlCap) });
}

export async function GET(): Promise<
  NextResponse<VaultApiResponse | { error: string }>
> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  // `assertRateLimit` throws on limit; caught here so it answers 429 rather
  // than falling into the catch-all below and masquerading as a 500.
  try {
    await assertRateLimit(`vault:get:${userId}`, READS_PER_MINUTE, RATE_WINDOW_MS);
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // The adapter converts RPC failures into `unavailable` envelopes, so a
    // throw here is a BUG, not an outage -- hence the 500 below.
    const core = await readVaultCore();

    return NextResponse.json({
      mode: getVaultMode(),
      core: serializeWired(core),
      tvlCap: serializeTvlCap(core),
      utilization: deriveUtilization(core),
    });
  } catch (err) {
    logger.error(
      "vault read failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
