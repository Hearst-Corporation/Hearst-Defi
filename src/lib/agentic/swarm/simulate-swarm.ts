/**
 * Swarm simulation engine — pure and deterministic.
 *
 * `simulateSwarm(id)` composes the constituent crews via the EXISTING
 * `simulateCrewFlow` and aggregates their non-executable rollups. It performs:
 *   - NO DB write, NO external network, NO tool call, NO send/deploy.
 *   - NO wall-clock read (`new Date()` is deliberately avoided) → same input
 *     always yields identical output.
 *
 * Any unknown swarm or unknown constituent crew returns a typed
 * SwarmSimulationError — there is no execution fallback.
 */

import {
  simulateCrewFlow,
  isCrewSimulationError,
} from "../crew-simulation";
import { getSwarmDefinition, SWARM_IDS } from "./registry";
import type {
  AgenticAuditEvent,
  SwarmDefinition,
  SwarmSimulationError,
  SwarmSimulationResult,
  SwarmStepResult,
} from "./types";

function uniqueStable(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function crewModeToBlocked(mode: SwarmStepResult["mode"]): boolean {
  return mode === "forbidden" || mode === "confirmed_write_blocked";
}

/**
 * Simulate a swarm. Returns a deterministic SwarmSimulationResult, or a typed
 * SwarmSimulationError (unknown swarm / unknown crew) — never an execution.
 */
export function simulateSwarm(
  swarmId: string,
): SwarmSimulationResult | SwarmSimulationError {
  const swarm: SwarmDefinition | undefined = getSwarmDefinition(swarmId);
  if (!swarm) {
    return {
      kind: "unknown_swarm",
      swarmId,
      reasonCode: "swarm_not_registered",
      message: `No swarm registered for id "${swarmId}". No fallback execution will occur.`,
    } satisfies SwarmSimulationError;
  }

  const steps: SwarmStepResult[] = [];
  const audit: AgenticAuditEvent[] = [];
  const allBlocked: string[] = [...swarm.forbiddenActions];
  const allGates: string[] = [];

  for (const crewId of swarm.crewIds) {
    const crew = simulateCrewFlow(crewId);

    if (isCrewSimulationError(crew)) {
      // Fail-safe: a swarm referencing an unknown crew does not partially run.
      return {
        kind: "unknown_crew",
        swarmId,
        crewId,
        reasonCode: "crew_unavailable",
        message: `Swarm "${swarmId}" references unknown crew "${crewId}". No fallback execution will occur.`,
      } satisfies SwarmSimulationError;
    }

    const step: SwarmStepResult = {
      crewId,
      label: crew.scenario.label,
      mode: crew.scenario.mode,
      executable: false,
      blockedActions: crew.blockedActions,
      requiredGates: crew.requiredGates,
    };
    steps.push(step);

    allBlocked.push(...crew.blockedActions);
    allGates.push(...crew.requiredGates);

    const gateRequired = crew.requiredGates.length > 0;
    const blocked = crewModeToBlocked(crew.scenario.mode);
    // Split the former vague `crew_mode_blocked` into the two distinct incidents
    // an operator needs to tell apart: a hard-forbidden crew step vs a step that
    // is merely awaiting a human confirmation.
    const reasonCode = blocked
      ? crew.scenario.mode === "forbidden"
        ? "crew_blocked_forbidden"
        : "crew_blocked_missing_confirmation"
      : gateRequired
        ? "crew_requires_gate"
        : "crew_read_only";
    audit.push({
      kind: "crew_simulated",
      crewId,
      swarmId,
      actionPolicy: crew.scenario.mode,
      executionMode: swarm.mode,
      blocked,
      gateRequired,
      reasonCode,
    });
  }

  const blockedActions = uniqueStable(allBlocked);
  const requiredGates = uniqueStable(allGates);
  // For a gated swarm, every required gate is a human confirmation it would need.
  const requiredConfirmations =
    swarm.mode === "gated" ? requiredGates.slice() : [];

  audit.unshift({
    kind: "swarm_simulated",
    swarmId,
    actionPolicy: swarm.mode,
    executionMode: swarm.mode,
    blocked: false,
    gateRequired: swarm.mode === "gated",
    reasonCode: `swarm_${swarm.mode}`,
  });

  return {
    swarm,
    executionMode: swarm.mode,
    steps,
    blockedActions,
    requiredGates,
    requiredConfirmations,
    safetyNotes: swarm.safetyNotes,
    audit,
  } satisfies SwarmSimulationResult;
}

export function isSwarmSimulationError(
  result: SwarmSimulationResult | SwarmSimulationError,
): result is SwarmSimulationError {
  return "kind" in result && "swarmId" in result && "message" in result;
}

export function listSwarmIds(): string[] {
  return [...SWARM_IDS];
}
