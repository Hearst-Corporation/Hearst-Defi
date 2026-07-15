import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/require-auth";
import {
  CHAIN_ID,
  getVaultMode,
  readElecStatus,
  readMiningMetrics,
  readStrategies,
  type StrategyInfo,
} from "@/lib/chain/dynavault";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  jsonWired,
  safeRead,
  unavailable,
  type WiredLike,
} from "@/app/api/_shared/wired-json";

/**
 * GET /api/rwa-vault — status of pocket B1 (RWA Mining).
 *
 * Three blocks, three independent `Wired<T>` envelopes:
 *   • `pocket`      — the RWA adapter's entry in the vault + its balance
 *   • `mining`      — reported hashrate / BTC earned (vault-level)
 *   • `electricity` — monthly cost / payee / paid-to-date (vault-level)
 *
 * ── Identifying the pocket without inventing it ──────────────────────────────
 * The vault exposes `strategies(index)`, not `strategies("rwa")`. Nothing
 * on-chain says WHICH index is RWA Mining. Hardcoding index 2 because the
 * cartography lists three adapters (USDC / LBTC / RWA) would be a guess that
 * renders as a fact — and would silently report the WRONG pocket's balance the
 * day the owner reorders the array.
 *
 * So the adapter's ADDRESS comes from `RWA_MINING_ADAPTER_ADDRESS` and the entry
 * is matched by address against the on-chain list. Unset → `rwa_adapter_not_configured`.
 * Malformed → `rwa_adapter_misconfigured`. Set but absent from the vault →
 * `rwa_adapter_not_in_vault`. Three distinct, honest, actionable states; none of
 * them a balance.
 *
 * A plain server var (no `NEXT_PUBLIC_`): this route is server-only, so the
 * value never needs to reach the client bundle — which also side-steps the
 * Turbopack literal-inlining trap documented in dynavault's header.
 *
 * ── Legacy ──────────────────────────────────────────────────────────────────
 * No special-casing here. The old HearstYieldVault has no strategies, no mining
 * and no electricity: the adapter returns `not_supported_by_legacy` for all
 * three and this route forwards it verbatim.
 *
 * ── Auth ────────────────────────────────────────────────────────────────────
 * `requireAuth` — same rationale as `/api/dashboard`. Mining and electricity are
 * investor-facing proof surfaces, not admin-reserved; but fail-closed 401 lands
 * before any chain access. `requireInvestor` is unusable here (it `redirect()`s).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;

/** Reasons this route owns. The adapter's vocabulary covers the chain side. */
const RWA_REASONS = {
  /** `RWA_MINING_ADAPTER_ADDRESS` is unset: we do not know which pocket B1 is. */
  ADAPTER_NOT_CONFIGURED: "rwa_adapter_not_configured",
  /** It is set but not a well-formed EVM address — a typo, not a missing pocket. */
  ADAPTER_MISCONFIGURED: "rwa_adapter_misconfigured",
  /** Well-formed, but no strategy in the vault carries that adapter address. */
  ADAPTER_NOT_IN_VAULT: "rwa_adapter_not_in_vault",
  /**
   * The pocket's asset balance is NOT readable from the vault.
   *
   * This is a limit of the contract, not of this route. PermissionedDynaVault
   * v2.1 exposes `strategies(uint256) -> (adapter, allocation, active, isIdle)`
   * — a target allocation in bps, and nothing else. There is no per-strategy
   * asset amount anywhere in the v2.1 view surface.
   *
   * Reading the real balance would mean calling the ADAPTER contract itself
   * (out of the vault's scope, and absent from the spec). Until that interface
   * exists, this stays honestly unavailable rather than derived from the target
   * allocation — a target is what the vault AIMS for, never what it HOLDS, and
   * presenting one as the other is precisely the fabricated-data failure this
   * codebase forbids.
   */
  ASSETS_NOT_EXPOSED: "not_exposed_by_contract",
} as const;

const RwaEnvSchema = z.object({
  RWA_MINING_ADAPTER_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 40-hex EVM address")
    .optional(),
});

type AdapterConfig =
  | { status: "configured"; address: string }
  | { status: "missing" }
  | { status: "invalid" };

/**
 * Parsed locally rather than added to `src/lib/env.ts`: that module throws at
 * boot on a bad value, and a typo in an OPTIONAL pocket address must degrade
 * this one route to an honest `unavailable`, not take the whole app down.
 */
function resolveRwaAdapter(): AdapterConfig {
  const parsed = RwaEnvSchema.safeParse(process.env);
  if (!parsed.success) return { status: "invalid" };

  const address = parsed.data.RWA_MINING_ADAPTER_ADDRESS;
  if (address === undefined) return { status: "missing" };

  return { status: "configured", address: address.toLowerCase() };
}

/** The RWA pocket, once located and priced. */
type RwaPocket = {
  /** Position in the on-chain `strategies` array — resolved, never assumed. */
  index: number;
  /** Forwarded verbatim; bigints are stringified at the JSON boundary. */
  strategy: StrategyInfo;
  /**
   * Assets held by the adapter — its OWN envelope, always `unavailable` today.
   *
   * Nested rather than collapsed into the parent: the pocket IS resolvable
   * (we know its index, adapter and target allocation) while its balance is
   * not. Failing the whole pocket would hide readable truth behind an
   * unreadable field. See RWA_REASONS.ASSETS_NOT_EXPOSED.
   */
  assets: WiredLike<string>;
};

type StrategyHit = { index: number; strategy: StrategyInfo };

function findByAdapter(
  strategies: readonly StrategyInfo[],
  adapterAddress: string,
): StrategyHit | null {
  for (const [index, strategy] of strategies.entries()) {
    if (strategy.adapter.toLowerCase() === adapterAddress) {
      return { index, strategy };
    }
  }
  return null;
}

async function readPocket(
  adapter: AdapterConfig,
): Promise<WiredLike<RwaPocket>> {
  if (adapter.status === "missing") {
    return unavailable<RwaPocket>(RWA_REASONS.ADAPTER_NOT_CONFIGURED);
  }
  if (adapter.status === "invalid") {
    return unavailable<RwaPocket>(RWA_REASONS.ADAPTER_MISCONFIGURED);
  }

  const strategies = await safeRead("rwa.strategies", readStrategies);
  if (strategies.status === "unavailable") {
    // Forward the chain's own reason (not_supported_by_legacy, rpc_error, …)
    // rather than re-labelling it as an RWA problem.
    return strategies;
  }

  const hit = findByAdapter(strategies.data, adapter.address);
  if (hit === null) {
    return unavailable<RwaPocket>(RWA_REASONS.ADAPTER_NOT_IN_VAULT);
  }

  // No chain read here on purpose: there is nothing to read. The vault does not
  // expose a per-strategy balance (see RWA_REASONS.ASSETS_NOT_EXPOSED), so we
  // state that plainly instead of round-tripping to the RPC for a value that
  // cannot exist, or worse, passing the target allocation off as a holding.
  return {
    ...strategies,
    data: {
      index: hit.index,
      strategy: hit.strategy,
      assets: unavailable<string>(
        RWA_REASONS.ASSETS_NOT_EXPOSED,
        "PermissionedDynaVault v2.1 exposes a target allocation per strategy, not a held balance.",
      ),
    },
  };
}

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
    await assertRateLimit(`rwa-vault:${userId}`, RATE_MAX, RATE_WINDOW_MS);
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  try {
    const [pocket, mining, electricity] = await Promise.all([
      readPocket(resolveRwaAdapter()),
      safeRead("rwa.mining", readMiningMetrics),
      safeRead("rwa.electricity", readElecStatus),
    ]);

    return NextResponse.json(
      {
        mode: getVaultMode(),
        chainId: CHAIN_ID,
        pocket: jsonWired(pocket),
        mining: jsonWired(mining),
        electricity: jsonWired(electricity),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.error(
      "rwa-vault: read failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
