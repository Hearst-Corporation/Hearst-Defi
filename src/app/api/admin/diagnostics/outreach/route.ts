/**
 * Outreach diagnostic suite — admin-only, rate-limited, dry-run, no-store.
 * Exercises real forbidden-words + autonomy policy guards, plus ONE read-only
 * isSuppressed() DB probe (injected). Never calls Resend or emits an Inngest event.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";
import { runSuite } from "@/lib/admin/diagnostics/run-diagnostic-suite";
import { buildOutreachDeps } from "@/lib/admin/diagnostics/safe-dry-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    userId = (await requireAdmin()).userId;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Admin access required";
    const isAuthRequired = message.toLowerCase().includes("authentication required");
    return NextResponse.json(
      { error: message },
      { status: isAuthRequired ? 401 : 403 },
    );
  }

  try {
    await assertBodySize(request);
    await assertRateLimit(`admin-diagnostics:${userId}`, RATE_MAX, RATE_WINDOW_MS);
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  try {
    const outreach = await buildOutreachDeps();
    const result = await runSuite("outreach", { outreach });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.warn(
      "outreach diagnostic failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Diagnostic failed" }, { status: 500 });
  }
}
