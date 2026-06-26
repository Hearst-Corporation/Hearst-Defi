/**
 * Swarm safety assertions — pure, no I/O.
 *
 * These encode the hard invariants of the swarm foundation and are exercised by
 * the test suite against every registered swarm:
 *  - mode is one of the safe union members (never autonomous_write/execute/send);
 *  - every referenced crew id exists in the crew-simulation registry;
 *  - vault/product swarms list deploy + mark_live as forbidden;
 *  - outreach swarms list send as forbidden;
 *  - a gated swarm composes at least one crew that actually requires a gate.
 */

import { listSimulationScenarioIds } from "../crew-simulation";
import { simulateCrewFlow, isCrewSimulationError } from "../crew-simulation";
import type { SwarmDefinition, SwarmExecutionMode } from "./types";

const SAFE_MODES: readonly SwarmExecutionMode[] = [
  "simulation",
  "dry_run",
  "gated",
];

export type SwarmSafetyViolation = {
  kind:
    | "unsafe_mode"
    | "unknown_crew"
    | "missing_deploy_forbidden"
    | "missing_mark_live_forbidden"
    | "missing_send_forbidden"
    | "gated_without_gate";
  swarmId: string;
  crewId?: string;
  detail: string;
};

export function assertSwarmSafe(
  swarm: SwarmDefinition,
): SwarmSafetyViolation[] {
  const violations: SwarmSafetyViolation[] = [];
  const knownCrews = new Set(listSimulationScenarioIds());

  if (!SAFE_MODES.includes(swarm.mode)) {
    violations.push({
      kind: "unsafe_mode",
      swarmId: swarm.id,
      detail: `Swarm "${swarm.id}" has unsafe mode "${swarm.mode}". Allowed: ${SAFE_MODES.join(", ")}.`,
    });
  }

  for (const crewId of swarm.crewIds) {
    if (!knownCrews.has(crewId)) {
      violations.push({
        kind: "unknown_crew",
        swarmId: swarm.id,
        crewId,
        detail: `Swarm "${swarm.id}" references unknown crew "${crewId}".`,
      });
    }
  }

  const forbidden = swarm.forbiddenActions.map((a) => a.toLowerCase());
  const isVault = swarm.id.includes("vault") || swarm.id.includes("product");
  const isOutreach = swarm.id.includes("outreach");

  if (isVault) {
    if (!forbidden.some((a) => a.includes("deploy"))) {
      violations.push({
        kind: "missing_deploy_forbidden",
        swarmId: swarm.id,
        detail: `Vault/product swarm "${swarm.id}" must forbid deploy.`,
      });
    }
    if (!forbidden.some((a) => a.includes("mark") && a.includes("live"))) {
      violations.push({
        kind: "missing_mark_live_forbidden",
        swarmId: swarm.id,
        detail: `Vault/product swarm "${swarm.id}" must forbid mark_live.`,
      });
    }
  }

  if (isOutreach && !forbidden.some((a) => a.includes("send"))) {
    violations.push({
      kind: "missing_send_forbidden",
      swarmId: swarm.id,
      detail: `Outreach swarm "${swarm.id}" must forbid send.`,
    });
  }

  if (swarm.mode === "gated") {
    const hasAnyGate = swarm.crewIds.some((crewId) => {
      const crew = simulateCrewFlow(crewId);
      return !isCrewSimulationError(crew) && crew.requiredGates.length > 0;
    });
    if (!hasAnyGate) {
      violations.push({
        kind: "gated_without_gate",
        swarmId: swarm.id,
        detail: `Gated swarm "${swarm.id}" composes no crew that requires a gate.`,
      });
    }
  }

  return violations;
}

export function assertAllSwarmsSafe(
  swarms: SwarmDefinition[],
): SwarmSafetyViolation[] {
  return swarms.flatMap((s) => assertSwarmSafe(s));
}
