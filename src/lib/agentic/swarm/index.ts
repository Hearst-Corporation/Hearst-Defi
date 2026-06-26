/**
 * Swarm foundation — public surface.
 *
 * A deterministic, read-only composition layer over the existing crew
 * simulations. Pure functions only: no DB, no network, no tool execution, no
 * send/deploy. See docs/agentic/BACKEND_AGENTIC_FOUNDATION.md.
 */

export type {
  SwarmExecutionMode,
  SwarmCoordination,
  SwarmDefinition,
  SwarmStepResult,
  SwarmSimulationResult,
  SwarmSimulationError,
  AgenticAuditEvent,
  CrewResultOrError,
} from "./types";

export {
  SWARM_DEFINITIONS,
  SWARM_IDS,
  getSwarmDefinition,
} from "./registry";

export {
  simulateSwarm,
  isSwarmSimulationError,
  listSwarmIds,
} from "./simulate-swarm";

export {
  assertSwarmSafe,
  assertAllSwarmsSafe,
} from "./safety";
export type { SwarmSafetyViolation } from "./safety";

export {
  evaluateActionReadiness,
} from "./readiness";
export type {
  ActionDecision,
  ActionReadinessContext,
  ActionReadinessEvaluation,
} from "./readiness";

export { buildAgenticRegistrySnapshot } from "./registry-snapshot";
export type {
  AgenticRegistrySnapshot,
  AgentSummary,
  CrewSummary,
  SwarmSummary,
  ActionSummary,
  AgenticSafetyMetadata,
} from "./registry-snapshot";
