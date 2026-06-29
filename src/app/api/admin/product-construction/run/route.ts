/**
 * Product-construction pipeline — admin endpoint.
 *
 * Runs the six live-read swarms (telegram pricing → market live → strategy cross
 * → Monte-Carlo → charts → write-up) for an objective and returns the numeric,
 * charted, written DRAFT. Admin-only, rate-limited, no-store.
 *
 * Read-only: fetches real market/Telegram data and computes; it NEVER sends,
 * deploys, marks-live, or writes a custodial record. The returned draft's
 * `effects` are all false and the safety floor is asserted inside the pipeline.
 * The LLM write-up records the standard billing `LlmRun` telemetry only.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";
import {
  runProductConstructionPipeline,
  isProductConstructionError,
} from "@/lib/agentic/swarm/live/pipeline";
import {
  QUANT_PRESETS,
  type QuantAssumptionsOverrides,
  type QuantPresetId,
} from "@/lib/agentic/swarm/live/quant-assumptions";
import { saveConstructionReport } from "@/lib/product-workspace/construction-report-store";

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
      `admin-product-construction:${userId}`,
      RATE_MAX,
      RATE_WINDOW_MS,
    );
  } catch {
    return NextResponse.json(
      { error: "Too many requests — try again in a moment." },
      { status: 429 },
    );
  }

  let objective = "";
  let deterministicWriteupOnly = false;
  let withScenarios = false;
  let assumptions: QuantAssumptionsOverrides | undefined;
  try {
    const body = (await request.json().catch(() => null)) as {
      objective?: unknown;
      deterministicWriteupOnly?: unknown;
      withScenarios?: unknown;
      preset?: unknown;
      assumptions?: unknown;
    } | null;
    if (body && typeof body.objective === "string") {
      objective = body.objective.trim().slice(0, MAX_OBJECTIVE_LEN);
    }
    deterministicWriteupOnly = body?.deterministicWriteupOnly === true;
    withScenarios = body?.withScenarios === true;
    // Calibration: a named preset (conservative/base/aggressive) as a base, with
    // explicit per-field overrides layered on top. Both are CLAMPED inside the
    // pipeline (resolveQuantAssumptions), so an out-of-range value can never push
    // the simulation to a nonsense regime — the body is untrusted but bounded.
    const presetOverride =
      typeof body?.preset === "string" && body.preset in QUANT_PRESETS
        ? QUANT_PRESETS[body.preset as QuantPresetId]
        : undefined;
    const explicit =
      body?.assumptions && typeof body.assumptions === "object"
        ? (body.assumptions as QuantAssumptionsOverrides)
        : undefined;
    if (presetOverride || explicit) {
      assumptions = { ...presetOverride, ...explicit };
    }
  } catch {
    /* fall through to the empty-objective guard */
  }
  if (objective.length === 0) {
    return NextResponse.json(
      { error: "Objective is required" },
      { status: 400 },
    );
  }

  try {
    const result = await runProductConstructionPipeline(objective, {
      deterministicWriteupOnly,
      withScenarios,
      ...(assumptions ? { assumptions } : {}),
    });
    if (isProductConstructionError(result)) {
      return NextResponse.json(
        { error: result.message, reasonCode: result.reasonCode, kind: result.kind },
        { status: result.kind === "unsafe" ? 422 : 400 },
      );
    }
    // Persist the report into the admin's existing VaultDraft (best-effort, off
    // the response path). An informational artifact — not a custodial action.
    void saveConstructionReport({ userId, draft: result }).catch(() => {
      /* persistence is best-effort; never fail the response over it */
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.warn(
      "admin product-construction failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json(
      { error: "Product construction failed" },
      { status: 500 },
    );
  }
}
