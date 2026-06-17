import { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { openai, LLM_MODEL } from "@/lib/llm/openai";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  runProductWorkspaceBrief,
  persistGeneratedBrief,
  type BriefStreamClient,
  PRODUCT_WORKSPACE_BRIEF_LIMITS,
} from "@/lib/product-workspace/brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_MAX = 10;
const RATE_WINDOW_MS = 60_000;

/**
 * Live framing-brief generator for the Product Workspace.
 *
 * The near-empty workspace page mounts a client component that POSTs here with
 * the objective; this route streams the brief token-by-token (SSE) so it writes
 * itself into the page, then persists the final text to the per-admin draft so
 * a refresh re-renders it without re-billing the model.
 *
 * Admin-gated (requireAdmin) + rate-limited. The streamed text is already
 * compliance-guarded inside runProductWorkspaceBrief (forbidden words + APY
 * range), so a non-compliant brief is blocked before it reaches the page.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let userId: string;
  try {
    const auth = await requireAdmin();
    userId = auth.userId;
  } catch {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await assertRateLimit(
      `product-workspace-brief:${userId}`,
      RATE_MAX,
      RATE_WINDOW_MS,
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Too many requests — try again in a moment." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  let objective = "";
  try {
    const body = (await req.json().catch(() => null)) as
      | { objective?: unknown }
      | null;
    if (body && typeof body.objective === "string") {
      objective = body.objective.trim().slice(0, PRODUCT_WORKSPACE_BRIEF_LIMITS.MAX_OBJECTIVE_LEN);
    }
  } catch {
    /* fall through to empty-objective guard */
  }
  if (objective.length === 0) {
    return new Response(JSON.stringify({ error: "Objective is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { stream, final } = runProductWorkspaceBrief(
    openai as unknown as BriefStreamClient,
    LLM_MODEL,
    objective,
    { signal: req.signal },
  );

  // Persist the brief once the turn completes — off the response path.
  void final
    .then((brief) => persistGeneratedBrief({ userId, objective, brief }))
    .catch((err) => {
      logger.warn(
        "product-workspace brief persist failed",
        { userId },
        err instanceof Error ? err : undefined,
      );
    });

  // Plain text/plain token stream (same contract the client reader expects).
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
