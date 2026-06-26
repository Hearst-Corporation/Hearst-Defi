/**
 * Swarm foundation — types.
 *
 * A "swarm" is a deterministic, read-only COMPOSITION of one or more existing
 * crew-simulation scenarios (src/lib/agentic/crew-simulation). It exists only to
 * represent, simulate, and audit how several crews would coordinate — it NEVER
 * executes anything.
 *
 * Hard invariant: a swarm's execution mode can only be `simulation`, `dry_run`,
 * or `gated`. There is deliberately NO `autonomous_write` mode in this union —
 * the type system makes an auto-writing swarm unrepresentable.
 */

import type {
  CrewSimulationMode,
  CrewSimulationResult,
} from "../crew-simulation/types";

/**
 * Allowed swarm execution modes. Note the absence of any "autonomous_write" /
 * "execute" / "send" member — by construction a swarm cannot self-execute.
 *  - `simulation` — pure modelling, no side effect, no gate semantics.
 *  - `dry_run`    — would-be plan with effects explicitly suppressed.
 *  - `gated`      — at least one step needs a human gate before it could ever run.
 */
export type SwarmExecutionMode = "simulation" | "dry_run" | "gated";

/** How the constituent crews relate. Both are read-only; neither executes. */
export type SwarmCoordination = "sequential" | "parallel_readonly";

/**
 * A swarm definition. `crewIds` MUST reference existing crew-simulation scenario
 * ids — the registry/safety layer rejects unknown crews (no fallback).
 */
export type SwarmDefinition = {
  id: string;
  label: string;
  description: string;
  mode: SwarmExecutionMode;
  coordination: SwarmCoordination;
  /** Existing crew-simulation scenario ids this swarm composes. */
  crewIds: string[];
  /** Actions that must never be reachable from this swarm (send/deploy/…). */
  forbiddenActions: string[];
  safetyNotes: string[];
};

/** Pure audit event for a simulated swarm/crew step. No prompt/user text, no secrets. */
export type AgenticAuditEvent = {
  kind:
    | "swarm_simulated"
    | "crew_simulated"
    | "action_evaluated"
    | "blocked"
    | "gate_required";
  agentId?: string;
  crewId?: string;
  swarmId?: string;
  /** The governing policy/mode for the step (crew mode or action tier). */
  actionPolicy: string;
  executionMode: SwarmExecutionMode;
  blocked: boolean;
  gateRequired: boolean;
  /** Stable machine-readable reason (never free user text). */
  reasonCode: string;
};

/** Per-crew rollup inside a swarm simulation. Always non-executable. */
export type SwarmStepResult = {
  crewId: string;
  label: string;
  mode: CrewSimulationMode;
  executable: false;
  blockedActions: string[];
  requiredGates: string[];
};

/** Deterministic result of simulating a swarm. Contains no wall-clock value. */
export type SwarmSimulationResult = {
  swarm: SwarmDefinition;
  executionMode: SwarmExecutionMode;
  steps: SwarmStepResult[];
  /** Union of every constituent crew's blocked actions + the swarm's own. */
  blockedActions: string[];
  /** Union of every constituent crew's required gates. */
  requiredGates: string[];
  /** Human confirmations a gated swarm would require before any real action. */
  requiredConfirmations: string[];
  safetyNotes: string[];
  audit: AgenticAuditEvent[];
};

/** Typed failure — never an execution fallback. */
export type SwarmSimulationError = {
  kind: "unknown_swarm" | "unknown_crew" | "forbidden";
  swarmId: string;
  crewId?: string;
  message: string;
};

/** Narrow a crew result that may have been an error. */
export type CrewResultOrError =
  | CrewSimulationResult
  | { kind: string; scenarioId: string; message: string };
