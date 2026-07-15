import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  CHAIN_ID,
  getVaultMode,
  readStrategies,
  readVaultCore,
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
 * ⚠️ THE DRIFT IS NOT COMPUTABLE TODAY — and that is a contract limit, not a gap
 * in this route. Read this before "fixing" the unavailable fields below.
 *
 * Drift needs the CURRENT weight of each strategy, i.e. its held balance over
 * totalAssets. PermissionedDynaVault v2.1 exposes
 * `strategies(uint256) -> (adapter, allocation, active, isIdle)`: a TARGET
 * allocation in bps, and nothing else. No per-strategy balance exists anywhere
 * in its view surface, so the numerator of `currentBps` has no source.
 *
 * What this route therefore serves: the target allocations (genuinely on-chain,
 * wired) and totalAssets (wired), with `assets` / `currentBps` / `driftBps` /
 * `exceedsThreshold` honestly `unavailable`.
 *
 * The tempting shortcut is to report drift = 0 by reading the target as if it
 * were the current weight. That would render a vault as perfectly balanced at
 * all times — the exact opposite of the truth it is asked for, and precisely the
 * fabricated-data failure this codebase forbids.
 *
 * To make drift real, the vault (or each adapter) must expose a held balance.
 * That is a question for the contract engineer — see docs/DYNAVAULT_V2_WIRING.md.
 *
 * GET /api/rebalancing/status — per-strategy drift against target allocation.
 *
 *   drift(bps) = | currentBps − targetBps |
 *   currentBps = strategyAssets × 10 000 ÷ totalAssets
 *   targetBps  = strategies(i).allocationBps   (the contract's own target)
 *
 * ── Every step of the arithmetic is falsifiable ──────────────────────────────
 * `currentBps` needs a numerator (the adapter's assets) AND a denominator
 * (`core.totalAssets`). If either is missing, THERE IS NO DRIFT — and this route
 * says so with a reason instead of computing against a zero it invented. The
 * chain of custody is preserved: an unreadable numerator propagates its own
 * reason into `currentBps`, which propagates into `driftBps`, which propagates
 * into `exceedsThreshold`. `core` is returned alongside so the denominator that
 * produced every percentage is auditable rather than implied.
 *
 * Named degradations:
 *   • `vault_empty`               totalAssets = 0 → the ratio is undefined, not 0%.
 *   • `out_of_range`             the bps ratio exceeds Number.MAX_SAFE_INTEGER;
 *                                 refuse rather than return a lossy float.
 *   • `threshold_not_configured` no threshold set → we do not know what "drifted
 *                                 too far" means, so we do not answer it.
 *   • `threshold_invalid`        threshold set but malformed → same, but the
 *                                 operator needs to know it is a typo.
 *
 * ── The threshold is configuration, never a literal ─────────────────────────
 * A hardcoded default would make this route assert a rebalancing policy it has
 * no authority over — and ADR-006 forbids auto-executed rebalances precisely
 * because that decision is a human's. Absent config ⇒ `exceedsThreshold` is
 * `unavailable`, and `thresholdBps` is `null`. The drift itself still reports:
 * the measurement does not depend on the policy.
 *
 * Read-only: this route computes a signal, it never acts on one.
 *
 * ── Legacy ──────────────────────────────────────────────────────────────────
 * HearstYieldVault has no strategies. The adapter returns
 * `not_supported_by_legacy` for `readStrategies`, so `strategies` forwards that
 * envelope and the drift list is empty-because-unavailable, not empty-because-zero.
 *
 * ── Auth ────────────────────────────────────────────────────────────────────
 * `requireAdmin` — stricter than `/api/dashboard` and `/api/rwa-vault` on
 * purpose. Live drift against target allocation is operational intent: it is the
 * input to a rebalance, it reveals the desk's position versus its policy, and
 * it is only actionable by an operator. Investors get NAV and proof; they have
 * no use for the trigger. 401 when unauthenticated, 403 when authenticated but
 * not admin — both before any chain access.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;

/** Basis points denominator. 100% = 10 000 bps. */
const BPS_DENOMINATOR = 10_000n;

/** Above this, `Number(bigint)` starts lying. Refuse instead. */
const MAX_SAFE_BPS = BigInt(Number.MAX_SAFE_INTEGER);

const REBALANCING_REASONS = {
  VAULT_EMPTY: "vault_empty",
  OUT_OF_RANGE: "out_of_range",
  THRESHOLD_NOT_CONFIGURED: "threshold_not_configured",
  THRESHOLD_INVALID: "threshold_invalid",
} as const;

/**
 * A strategy's held balance is not exposed by the vault — see the header note.
 * Shared verbatim with /api/rwa-vault so one motive means one thing across the
 * API surface, and the UI can label it once.
 */
const ASSETS_NOT_EXPOSED = "not_exposed_by_contract";

const ThresholdEnvSchema = z.object({
  REBALANCE_DRIFT_THRESHOLD_BPS: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .optional(),
});

type ThresholdConfig =
  | { status: "configured"; value: number }
  | { status: "missing" }
  | { status: "invalid" };

/**
 * Parsed locally rather than declared in `src/lib/env.ts`: that module throws at
 * boot, and a malformed OPTIONAL threshold must degrade this single route to an
 * honest `unavailable` — not refuse to start the app.
 */
function resolveThreshold(): ThresholdConfig {
  const parsed = ThresholdEnvSchema.safeParse(process.env);
  if (!parsed.success) return { status: "invalid" };

  const value = parsed.data.REBALANCE_DRIFT_THRESHOLD_BPS;
  return value === undefined
    ? { status: "missing" }
    : { status: "configured", value };
}

type EnrichedStrategy = {
  index: number;
  /** Forwarded verbatim — bigints stringified at the JSON boundary. */
  strategy: StrategyInfo;
  /** Assets held by this adapter, in asset units (USDC, 6 decimals). */
  assets: WiredLike<bigint>;
  /** Share of `totalAssets`, in bps. Unavailable without both operands. */
  currentBps: WiredLike<number>;
  /** |current − target|, in bps. */
  driftBps: WiredLike<number>;
  /** Only answerable once a threshold is configured AND the drift is known. */
  exceedsThreshold: WiredLike<boolean>;
};

/**
 * `totalAssets` is the drift denominator. When `core` could not be read we do
 * not substitute anything — we carry ITS reason forward, so a legacy vault, an
 * RPC outage and an empty vault stay three different answers.
 */
function computeCurrentBps(
  assets: WiredLike<bigint>,
  totalAssets: WiredLike<bigint>,
): WiredLike<number> {
  if (assets.status === "unavailable") return assets;
  if (totalAssets.status === "unavailable") return totalAssets;

  if (totalAssets.data === 0n) {
    // A share of nothing is undefined, not 0%.
    return unavailable<number>(REBALANCING_REASONS.VAULT_EMPTY);
  }

  const bps = (assets.data * BPS_DENOMINATOR) / totalAssets.data;
  if (bps > MAX_SAFE_BPS) {
    return unavailable<number>(REBALANCING_REASONS.OUT_OF_RANGE);
  }

  // Spread preserves source / address / chainId / readAt of the assets read.
  return { ...assets, data: Number(bps) };
}

function computeDriftBps(
  currentBps: WiredLike<number>,
  targetBps: number,
): WiredLike<number> {
  if (currentBps.status === "unavailable") return currentBps;
  return { ...currentBps, data: Math.abs(currentBps.data - targetBps) };
}

function computeExceedsThreshold(
  driftBps: WiredLike<number>,
  threshold: ThresholdConfig,
): WiredLike<boolean> {
  if (threshold.status === "invalid") {
    return unavailable<boolean>(REBALANCING_REASONS.THRESHOLD_INVALID);
  }
  if (threshold.status === "missing") {
    return unavailable<boolean>(REBALANCING_REASONS.THRESHOLD_NOT_CONFIGURED);
  }
  if (driftBps.status === "unavailable") return driftBps;

  return { ...driftBps, data: driftBps.data >= threshold.value };
}

export async function GET(): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAdmin());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admin access required";
    const isAuthRequired = message
      .toLowerCase()
      .includes("authentication required");
    return NextResponse.json(
      { error: message },
      { status: isAuthRequired ? 401 : 403 },
    );
  }

  try {
    await assertRateLimit(
      `rebalancing-status:${userId}`,
      RATE_MAX,
      RATE_WINDOW_MS,
    );
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  try {
    const threshold = resolveThreshold();
    if (threshold.status === "invalid") {
      // Surfaced to the client as `threshold_invalid`, but an operator needs the
      // log line to know a var is typo'd rather than merely unset.
      logger.warn(
        "rebalancing: REBALANCE_DRIFT_THRESHOLD_BPS is set but malformed (expected an integer 1..10000)",
        { userId },
      );
    }

    const [core, strategies] = await Promise.all([
      safeRead("rebalancing.core", readVaultCore),
      safeRead("rebalancing.strategies", readStrategies),
    ]);

    // Narrow `core` down to the single field the drift maths needs, keeping the
    // envelope so an unreadable denominator carries its own reason downstream.
    const totalAssets: WiredLike<bigint> =
      core.status === "unavailable"
        ? core
        : { ...core, data: core.data.totalAssets };

    let strategiesPayload: WiredLike<EnrichedStrategy[]>;
    if (strategies.status === "unavailable") {
      // Enumeration failed → there is no list to drift-check. Forward as-is;
      // an empty array here would read as "no strategies", which is a lie.
      strategiesPayload = strategies;
    } else {
      const enriched = strategies.data.map(
        (strategy, index): EnrichedStrategy => {
          // No chain read: there is nothing to read. See ASSETS_NOT_EXPOSED.
          // Everything downstream cascades to `unavailable` on its own, because
          // computeCurrentBps / computeDriftBps / computeExceedsThreshold all
          // forward an unavailable operand rather than substituting a default.
          const assets = unavailable<bigint>(
            ASSETS_NOT_EXPOSED,
            "PermissionedDynaVault v2.1 exposes a target allocation per strategy, not a held balance.",
          );
          const currentBps = computeCurrentBps(assets, totalAssets);
          const driftBps = computeDriftBps(
            currentBps,
            Number(strategy.allocationBps),
          );

          return {
            index,
            strategy,
            assets,
            currentBps,
            driftBps,
            exceedsThreshold: computeExceedsThreshold(driftBps, threshold),
          };
        },
      );
      strategiesPayload = { ...strategies, data: enriched };
    }

    return NextResponse.json(
      {
        mode: getVaultMode(),
        chainId: CHAIN_ID,
        /** null when unset OR malformed — `exceedsThreshold` carries which. */
        thresholdBps:
          threshold.status === "configured" ? threshold.value : null,
        /** The drift denominator, exposed so every percentage is auditable. */
        core: jsonWired(core),
        strategies: jsonWired(strategiesPayload),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.error(
      "rebalancing: status read failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
