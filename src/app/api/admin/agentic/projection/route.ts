import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertRateLimit, assertBodySize } from "@/lib/rate-limit";
import {
  validateProjectionInput,
  buildProjectionArtifact,
  assertProjectionArtifactSafe,
} from "@/lib/agentic/product-projection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;

/**
 * POST /api/admin/agentic/projection
 *
 * Admin-gated, READ-ONLY: builds a deterministic projection artifact from
 * allowlisted inputs. No DB write, no external tool, no real execution, no
 * prompt/user text. APY is only a range; no number is invented; no return is
 * promised. Output is guard-checked before return. Served `no-store`.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    const auth = await requireAdmin();
    userId = auth.userId;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Admin access required";
    const isAuthRequired = message
      .toLowerCase()
      .includes("authentication required");
    return NextResponse.json(
      { error: message },
      { status: isAuthRequired ? 401 : 403 },
    );
  }

  try {
    await assertBodySize(request);
    await assertRateLimit(`agentic-projection:${userId}`, RATE_MAX, RATE_WINDOW_MS);
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateProjectionInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const artifact = buildProjectionArtifact(parsed.value);
    const violations = assertProjectionArtifactSafe(artifact);
    if (violations.length > 0) {
      // Defence in depth: the builder is meant to be compliant. If a guard ever
      // trips, refuse to emit the artifact rather than surface unguarded content.
      logger.error("agentic projection guard tripped", {
        kinds: violations.map((v) => v.kind),
      });
      return NextResponse.json(
        { error: "Projection failed output guards", sideEffects: false as const },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { artifact, sideEffects: false as const, businessSideEffects: false as const },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.warn(
      "agentic projection build failed",
      { productType: parsed.value.productType },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json(
      { error: "Projection unavailable", sideEffects: false as const },
      { status: 500 },
    );
  }
}
