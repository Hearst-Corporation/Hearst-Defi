/**
 * Chat Action Lab — read-only endpoint. Runs the preloaded chat-action scenario
 * matrix through the REAL deterministic router (pure functions) and returns a
 * legible report. Admin-only, rate-limited, no-store.
 *
 * Hard safety: NO LLM call, NO POST to /api/cockpit-chat, NO CockpitMessage /
 * LlmRun persistence, NO write, NO send, NO deploy. The runtime IS exercised
 * (the live classifiers decide routing), but nothing here mutates state.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";
import { runChatActionLab } from "@/lib/admin/diagnostics/chat-action-lab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

async function handle(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    userId = (await requireAdmin()).userId;
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
    await assertRateLimit(
      `admin-chat-action-lab:${userId}`,
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
    const report = runChatActionLab();
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.warn(
      "admin chat-action-lab failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json(
      { error: "Chat Action Lab failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  return handle(request);
}

// POST kept for parity with the suite endpoints (the client uses POST). It is
// idempotent and equally read-only — there is no body to act on.
export async function POST(request: NextRequest): Promise<Response> {
  return handle(request);
}
