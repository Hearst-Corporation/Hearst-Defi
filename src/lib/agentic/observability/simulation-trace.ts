import "server-only";

// Agentic Simulation Observability — trace contract + safe recorder.
//
// A simulation trace is METADATA-ONLY. It records WHICH swarm/action was
// simulated and the SHAPE of the outcome (counts + machine reason codes) — it
// NEVER stores a prompt, a user message, the raw request body/context, tokens,
// cookies, headers, or a stack trace. Recording is OPT-IN at the call site and
// best-effort: a store failure never affects the simulation result.

import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";
import {
  appendSimulationTrace,
  type SimulationTraceStorage,
} from "./simulation-store";

export type SimulationSwarmMode = "simulation" | "dry_run" | "gated";

export type SimulationReadinessOutcome =
  | "allow"
  | "gated"
  | "requires_human_confirmation"
  | "blocked";

/**
 * Metadata-only audit trace of one agentic simulation. Every field is either a
 * stable id/code or a count — there is no free text and no request payload.
 */
export type AgenticSimulationTrace = {
  id: string;
  createdAt: string;
  kind: "agentic_simulation";
  swarmId: string;
  swarmMode: SimulationSwarmMode;
  actionId?: string;
  readinessOutcome?: SimulationReadinessOutcome;
  blockedCount: number;
  gateCount: number;
  confirmationCount: number;
  auditReasonCodes: string[];
  /** The business simulation has no side effects. */
  sideEffects: false;
  /** This trace carries only metadata. */
  metadataOnly: true;
};

/** Input for building a trace — already metadata, derived from the simulation. */
export type SimulationTraceInput = {
  swarmId: string;
  swarmMode: SimulationSwarmMode;
  actionId?: string;
  readinessOutcome?: SimulationReadinessOutcome;
  blockedCount: number;
  gateCount: number;
  confirmationCount: number;
  auditReasonCodes: string[];
};

/**
 * Build a trace from metadata input + a stamp. Pure — deterministic given the
 * same input and stamp (id/createdAt are injected, not read here). It also
 * defends in depth: only the allowlisted metadata fields are copied, so a caller
 * cannot smuggle prompt/user text into the trace.
 */
export function buildSimulationTrace(
  input: SimulationTraceInput,
  stamp: { id: string; createdAt: string },
): AgenticSimulationTrace {
  return {
    id: stamp.id,
    createdAt: stamp.createdAt,
    kind: "agentic_simulation",
    swarmId: input.swarmId,
    swarmMode: input.swarmMode,
    ...(input.actionId ? { actionId: input.actionId } : {}),
    ...(input.readinessOutcome
      ? { readinessOutcome: input.readinessOutcome }
      : {}),
    blockedCount: input.blockedCount,
    gateCount: input.gateCount,
    confirmationCount: input.confirmationCount,
    auditReasonCodes: [...input.auditReasonCodes],
    sideEffects: false,
    metadataOnly: true,
  };
}

export type RecordSimulationResult = {
  recorded: boolean;
  reason?: string;
  storage?: SimulationTraceStorage;
};

/** Kill-switch: set AGENTIC_SIMULATION_OBSERVABILITY=0 to disable recording. */
function observabilityEnabled(): boolean {
  return process.env.AGENTIC_SIMULATION_OBSERVABILITY !== "0";
}

/**
 * Record a simulation trace. Best-effort and OPT-IN — callers only invoke this
 * when the request explicitly asks to record. Never throws:
 *  - disabled by env  → { recorded: false, reason: "disabled" }
 *  - store error      → { recorded: false, reason: "store_error" }
 *  - otherwise        → { recorded: true, storage }
 *
 * The id (uuid) + createdAt are stamped here (server-only I/O module). No
 * prompt/user text/payload is accepted — `input` is already metadata-only.
 */
export async function recordAgenticSimulationTrace(
  input: SimulationTraceInput,
): Promise<RecordSimulationResult> {
  if (!observabilityEnabled()) {
    return { recorded: false, reason: "disabled" };
  }
  try {
    const trace = buildSimulationTrace(input, {
      id: `sim:${randomUUID()}`,
      createdAt: new Date().toISOString(),
    });
    const storage = await appendSimulationTrace(trace);
    return { recorded: true, storage };
  } catch (err) {
    logger.warn(
      "agentic-simulation-observability: record failed (non-blocking)",
      { swarmId: input.swarmId },
      err instanceof Error ? err : undefined,
    );
    return { recorded: false, reason: "store_error" };
  }
}
