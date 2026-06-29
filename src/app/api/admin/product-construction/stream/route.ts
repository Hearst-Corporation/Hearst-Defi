/**
 * Streamed product-construction — admin endpoint.
 *
 * Runs the five named specialists (Bitcoin · Hashprice · Mining Infra · DeFi ·
 * Data Scientist) sequentially and streams one NDJSON frame per transition, so
 * the Product Workspace stepper reveals genuine per-step progress (no cosmetic
 * timer). Admin-only, rate-limited, no-store.
 *
 * Read-only: fetches real market / Telegram / yield data and computes; it NEVER
 * sends, deploys, marks-live, or writes a custodial record. The final frame
 * carries the assembled DRAFT (effects all false, safety floor asserted inside
 * the pipeline). The construction report is persisted best-effort to the admin's
 * VaultDraft — an informational artifact, not a custodial action.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";
import { streamProductConstruction } from "@/lib/agentic/swarm/live/stream-orchestrator";
import { saveConstructionReport } from "@/lib/product-workspace/construction-report-store";
import type { ConstructionStreamFrame } from "@/lib/agentic/swarm/live/stream-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 6;
const RATE_WINDOW_MS = 60_000;
const MAX_OBJECTIVE_LEN = 220;

export async function POST(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    userId = (await requireAdmin()).userId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admin access required";
    const isAuthRequired = message.toLowerCase().includes("authentication required");
    return NextResponse.json({ error: message }, { status: isAuthRequired ? 401 : 403 });
  }

  try {
    await assertBodySize(request);
    await assertRateLimit(`admin-product-construction-stream:${userId}`, RATE_MAX, RATE_WINDOW_MS);
  } catch {
    return NextResponse.json({ error: "Too many requests — try again in a moment." }, { status: 429 });
  }

  let objective = "";
  try {
    const body = (await request.json().catch(() => null)) as { objective?: unknown } | null;
    if (body && typeof body.objective === "string") {
      objective = body.objective.trim().slice(0, MAX_OBJECTIVE_LEN);
    }
  } catch {
    /* fall through to the empty-objective guard */
  }
  if (objective.length === 0) {
    return NextResponse.json({ error: "Objective is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (frame: ConstructionStreamFrame) => {
        controller.enqueue(encoder.encode(JSON.stringify(frame) + "\n"));
        // Persist the assembled draft best-effort once it lands (off the response
        // path; never fails the stream). An informational artifact, not custodial.
        if (frame.type === "final") {
          void saveConstructionReport({ userId, draft: frame.draft }).catch(() => {
            /* best-effort persistence */
          });
        }
      };
      try {
        await streamProductConstruction(objective, emit);
      } catch (err) {
        logger.warn("admin product-construction stream failed", { userId }, err instanceof Error ? err : undefined);
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", message: "Product construction failed" }) + "\n"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
