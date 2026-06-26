import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertRateLimit, assertBodySize } from "@/lib/rate-limit";
import {
  simulateSwarm,
  isSwarmSimulationError,
  evaluateActionReadiness,
  type ActionReadinessEvaluation,
  type SwarmSimulationResult,
} from "@/lib/agentic/swarm";
import {
  recordAgenticSimulationTrace,
  type RecordSimulationResult,
  type SimulationReadinessOutcome,
} from "@/lib/agentic/observability/simulation-trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIM_RATE_MAX = 60;
const SIM_RATE_WINDOW_MS = 60_000;

/** Parsed, allowlisted simulation input. Unknown fields are dropped, not trusted. */
type SimulateInput = {
  swarmId: string;
  actionId?: string;
  context?: { hasHumanConfirmationToken?: boolean };
  observability?: { record?: boolean };
};

type ParseResult =
  | { ok: true; value: SimulateInput }
  | { ok: false; error: string };

/**
 * Fail-safe body parsing. Only `swarmId` (required), `actionId` (optional), and
 * `context.hasHumanConfirmationToken` (optional bool) are read — every other
 * field is ignored. No prompt/user text is accepted or echoed.
 */
function parseBody(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.swarmId !== "string" || obj.swarmId.trim().length === 0) {
    return { ok: false, error: "swarmId is required and must be a string" };
  }
  if (obj.swarmId.length > 200) {
    return { ok: false, error: "swarmId is too long" };
  }

  let actionId: string | undefined;
  if (obj.actionId !== undefined) {
    if (typeof obj.actionId !== "string") {
      return { ok: false, error: "actionId must be a string" };
    }
    if (obj.actionId.length > 200) {
      return { ok: false, error: "actionId is too long" };
    }
    actionId = obj.actionId;
  }

  let context: SimulateInput["context"];
  if (obj.context !== undefined) {
    if (typeof obj.context !== "object" || obj.context === null) {
      return { ok: false, error: "context must be an object" };
    }
    const token = (obj.context as Record<string, unknown>)
      .hasHumanConfirmationToken;
    if (token !== undefined && typeof token !== "boolean") {
      return {
        ok: false,
        error: "context.hasHumanConfirmationToken must be a boolean",
      };
    }
    context = { hasHumanConfirmationToken: token === true };
  }

  let observability: SimulateInput["observability"];
  if (obj.observability !== undefined) {
    if (typeof obj.observability !== "object" || obj.observability === null) {
      return { ok: false, error: "observability must be an object" };
    }
    const record = (obj.observability as Record<string, unknown>).record;
    if (record !== undefined && typeof record !== "boolean") {
      return { ok: false, error: "observability.record must be a boolean" };
    }
    observability = { record: record === true };
  }

  return {
    ok: true,
    value: {
      swarmId: obj.swarmId,
      ...(actionId ? { actionId } : {}),
      ...(context ? { context } : {}),
      ...(observability ? { observability } : {}),
    },
  };
}

/**
 * POST /api/admin/agentic/simulate
 *
 * Admin-gated, SIMULATION-ONLY. Validates the swarm id, runs the deterministic
 * pure `simulateSwarm` (and `evaluateActionReadiness` when an actionId is
 * supplied), and returns the rollup with `sideEffects: false`. It performs NO
 * DB write, NO external tool call, NO real execution, and generates NO real HITL
 * token — `confirmed_write` stays gated unless the caller passes an explicit
 * simulation token, and `forbidden_autonomous` stays blocked even with one.
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
    await assertRateLimit(
      `agentic-simulate:${userId}`,
      SIM_RATE_MAX,
      SIM_RATE_WINDOW_MS,
    );
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

  const parsed = parseBody(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = simulateSwarm(parsed.value.swarmId);
    if (isSwarmSimulationError(result)) {
      const status = result.kind === "unknown_swarm" ? 404 : 400;
      return NextResponse.json(
        {
          error: result.message,
          kind: result.kind,
          reasonCode: result.reasonCode,
          sideEffects: false as const,
        },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }

    const simulation: SwarmSimulationResult = result;
    let readiness: ActionReadinessEvaluation | null = null;
    if (parsed.value.actionId) {
      // Swarm-aware: the swarm scope (mode + forbiddenActions + allowedActionIds)
      // is threaded in so the boundary is enforcing, not decorative.
      readiness = evaluateActionReadiness(
        parsed.value.actionId,
        parsed.value.context ?? {},
        simulation.swarm,
      );
    }

    // OPT-IN, metadata-only observability. The business simulation has no side
    // effects; recording a trace is a technical side effect gated behind an
    // explicit `observability.record === true`. No payload/prompt/user text is
    // passed — only counts + machine codes derived from the result.
    const recordRequested = parsed.value.observability?.record === true;
    let recordResult: RecordSimulationResult = { recorded: false };
    if (recordRequested) {
      recordResult = await recordAgenticSimulationTrace({
        swarmId: simulation.swarm.id,
        swarmMode: simulation.executionMode,
        ...(parsed.value.actionId ? { actionId: parsed.value.actionId } : {}),
        ...(readiness
          ? {
              readinessOutcome:
                readiness.decision as SimulationReadinessOutcome,
            }
          : {}),
        blockedCount: simulation.blockedActions.length,
        gateCount: simulation.requiredGates.length,
        confirmationCount: simulation.requiredConfirmations.length,
        auditReasonCodes: simulation.audit.map((e) => e.reasonCode),
      });
    }

    return NextResponse.json(
      {
        swarm: {
          id: simulation.swarm.id,
          label: simulation.swarm.label,
          mode: simulation.executionMode,
        },
        steps: simulation.steps,
        blockedActions: simulation.blockedActions,
        requiredGates: simulation.requiredGates,
        requiredConfirmations: simulation.requiredConfirmations,
        safetyNotes: simulation.safetyNotes,
        audit: simulation.audit,
        readiness,
        // Business simulation guarantee is unchanged.
        sideEffects: false as const,
        businessSideEffects: false as const,
        observability: {
          requested: recordRequested,
          recorded: recordResult.recorded,
          ...(recordResult.reason ? { reason: recordResult.reason } : {}),
          ...(recordResult.storage ? { storage: recordResult.storage } : {}),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logger.warn(
      "agentic simulate route failed",
      { swarmId: parsed.value.swarmId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json(
      { error: "Simulation failed", sideEffects: false as const },
      { status: 500 },
    );
  }
}
