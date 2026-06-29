/**
 * Admin Live Diagnostics — index endpoint. Runs ALL suites (dry-run) and
 * returns the envelopes. Admin-only, rate-limited, no-store. Read-only:
 * exercises real router/guard/policy functions + read-only registry/suppression
 * probes; never writes, sends, or emits an event.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";
import { runAllSuites } from "@/lib/admin/diagnostics/run-diagnostic-suite";
import {
  buildOutreachDeps,
  buildVaultHitlDeps,
} from "@/lib/admin/diagnostics/safe-dry-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: NextRequest): Promise<Response> {
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
    const [outreach, vaultHitl] = await Promise.all([
      buildOutreachDeps(),
      buildVaultHitlDeps(),
    ]);
    const suites = await runAllSuites({ outreach, vaultHitl });
    return NextResponse.json(
      { ok: suites.every((s) => s.ok), mode: "dry-run", suites },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.warn(
      "admin diagnostics index failed",
      {},
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Diagnostic failed" }, { status: 500 });
  }
}
