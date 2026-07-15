import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import {
  CHAIN_ID,
  getVaultTarget,
  readProductDurationMonths,
  readVaultCore,
  readVendingCurve,
  type Wired,
} from "@/lib/chain/dynavault";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  buildDynavaultFactsheet,
  type ChainRead,
  type DynavaultFactsheet,
  type FactsheetChainReads,
} from "@/lib/products/dynavault-factsheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/product/factsheet
 *
 * The parameters of PermissionedDynaVault v2.1 — allocation bands, electricity
 * cost, term, halving month, redemption cooldown, curtailment thresholds.
 *
 * ── What is honest about this response ───────────────────────────────────────
 * The v2.1 contract is NOT deployed. Every parameter therefore comes from a
 * named, sourced product constant and is stamped `provenance: "manual"` — never
 * "live". `contract.deployed` says so out loud, and `contract.mode` reports what
 * this app is actually pointed at ("v2" | "legacy" | "not_configured") straight
 * from the chain adapter, so a reader can tell a not-yet-deployed product from a
 * misconfigured one.
 *
 * Parameters the spec does NOT give (the vending curve, the TVL cap) are
 * returned `unavailable` with a reason. Nothing is fabricated to fill a hole.
 *
 * ── The cutover (now wired) ─────────────────────────────────────────────────
 * `buildDynavaultFactsheet` prefers the chain over the constant, and this route
 * now supplies it: it reads `productDurationMonths()`, the `vendingCurveBps`
 * window and `tvlCap()` THROUGH the adapter — the single passage point to the
 * vault — and maps each `Wired<T>` onto the factsheet's structural `ChainRead`.
 * In legacy / not-configured mode every one of those reads comes back
 * `unavailable`, so the factsheet serves its manual constants AND stamps the
 * chain-unavailable reason; nothing flips to `live` until v2 answers. The route
 * still declares NO ABI of its own — the adapter owns that.
 *
 * Auth: any authenticated session (investor or admin). Not public — the
 * factsheet describes a private-placement product.
 */

type FactsheetResponse = DynavaultFactsheet | { error: string };

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * How many vending-curve months to read when the duration is known. The curve
 * is per-month; the factsheet carries it as a dense `number[]` indexed by month.
 */
const VENDING_CURVE_MAX_MONTHS = 24;

/**
 * Map a `Wired<T>` from the adapter onto the factsheet's structural
 * `ChainRead<U>`. The two shapes agree on `status`; only `.data` is projected,
 * and a failed read carries its reason so the factsheet can state it rather than
 * silently serve the constant.
 */
function toChainRead<T, U>(
  read: Wired<T>,
  project: (data: T) => U,
): ChainRead<U> {
  if (read.status === "wired") {
    return { status: "wired", data: project(read.data) };
  }
  return { status: "unavailable", reason: read.reason };
}

/**
 * Read the chain-backed factsheet parameters THROUGH the adapter. In legacy /
 * not-configured mode every read returns `unavailable`, which is exactly what
 * the factsheet needs to keep serving manual constants while flagging why the
 * chain value is absent. Never throws — the adapter is contractually
 * non-throwing, and every failure comes back as an `unavailable` ChainRead.
 */
async function loadChainReads(): Promise<FactsheetChainReads> {
  const [core, duration] = await Promise.all([
    readVaultCore(),
    readProductDurationMonths(),
  ]);

  const productDurationMonths = toChainRead(duration, (d) => Number(d.months));

  // `tvlCap` is null on the legacy contract — treat that as unavailable, never
  // as a zero cap. Carried as a decimal string (no bigint survives JSON).
  const tvlCapUsdc: ChainRead<string> =
    core.status === "wired"
      ? core.data.tvlCap === null
        ? { status: "unavailable", reason: "not_exposed_by_contract" }
        : { status: "wired", data: core.data.tvlCap.toString() }
      : { status: "unavailable", reason: core.reason };

  // The vending curve is only meaningful across a KNOWN term. If the duration is
  // unavailable we do not guess a length — the curve rides the same reason.
  let vendingCurveBps: ChainRead<readonly number[]>;
  if (duration.status !== "wired") {
    vendingCurveBps = { status: "unavailable", reason: duration.reason };
  } else {
    const months = Math.min(Number(duration.data.months), VENDING_CURVE_MAX_MONTHS);
    if (!Number.isFinite(months) || months <= 0) {
      vendingCurveBps = { status: "unavailable", reason: "invalid_input" };
    } else {
      const points = await Promise.all(
        Array.from({ length: months }, (_unused, month) => readVendingCurve(month)),
      );
      const failed = points.find((point) => point.status !== "wired");
      vendingCurveBps =
        failed !== undefined && failed.status === "unavailable"
          ? { status: "unavailable", reason: failed.reason }
          : {
              status: "wired",
              data: points.map((point) =>
                point.status === "wired" ? Number(point.data.bps) : 0,
              ),
            };
    }
  }

  return { productDurationMonths, vendingCurveBps, tvlCapUsdc };
}

export async function GET(): Promise<NextResponse<FactsheetResponse>> {
  // Fail-closed: no session, no read. The gate runs before anything else.
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await assertRateLimit(
      `product-factsheet:${userId}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
    );
  } catch {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const target = getVaultTarget();

    // Chain reads THROUGH the adapter. In legacy / not-configured mode these all
    // come back unavailable, so the factsheet serves its manual constants and
    // stamps the reason — nothing is fabricated to fill a hole.
    const chain = await loadChainReads();

    const factsheet = buildDynavaultFactsheet({
      now: new Date(),
      deployment: {
        mode: target.mode,
        chainId: CHAIN_ID,
        address: target.address,
      },
      chain,
    });

    return NextResponse.json(factsheet);
  } catch (err) {
    // Log server-side, answer generically — never surface `err.message`.
    logger.error("product/factsheet: build failed", { userId }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
