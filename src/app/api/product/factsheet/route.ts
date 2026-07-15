import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { CHAIN_ID, getVaultTarget } from "@/lib/chain/dynavault";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  buildDynavaultFactsheet,
  type DynavaultFactsheet,
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
 * ── The cutover ─────────────────────────────────────────────────────────────
 * `buildDynavaultFactsheet` already prefers the chain over the constant: once
 * the v2.1 read helpers in `@/lib/chain/dynavault` are frozen, pass their
 * `Wired<T>` results as `chain: { productDurationMonths, vendingCurveBps, … }`
 * and those fields flip to `provenance: "live"` with no other change here. This
 * route deliberately does not perform chain reads itself: the adapter is THE
 * single passage point to the vault, and nothing else may declare its ABI.
 *
 * Auth: any authenticated session (investor or admin). Not public — the
 * factsheet describes a private-placement product.
 */

type FactsheetResponse = DynavaultFactsheet | { error: string };

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

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

    const factsheet = buildDynavaultFactsheet({
      now: new Date(),
      deployment: {
        mode: target.mode,
        chainId: CHAIN_ID,
        address: target.address,
      },
      // No `chain` reads yet: the v2.1 contract does not exist. Supplying a
      // fabricated read here would be the one thing this route must never do.
    });

    return NextResponse.json(factsheet);
  } catch (err) {
    // Log server-side, answer generically — never surface `err.message`.
    logger.error("product/factsheet: build failed", { userId }, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
