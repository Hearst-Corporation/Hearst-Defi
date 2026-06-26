/**
 * Agentic registry snapshot — pure, deterministic, JSON-safe serialization for
 * the read-only admin API (GET /api/admin/agentic/registry).
 *
 * It composes EXISTING pure registries (agents inventory, crews, actions,
 * swarms) into a stable summary. No DB, no fetch, no Date, no prompt/user text,
 * no secrets. Same input → identical output.
 */

import { getAgenticInventory } from "../control-center/inventory";
import { CREW_SIMULATION_SCENARIOS } from "../crew-simulation";
import { ACTION_READINESS_ITEMS } from "../action-readiness";
import { SWARM_DEFINITIONS } from "./registry";

export type AgentSummary = {
  id: string;
  name: string;
  domain: string;
};

export type CrewSummary = {
  id: string;
  label: string;
  trigger: string;
  mode: string;
  risk: string;
  stepCount: number;
  forbiddenActions: string[];
};

export type SwarmSummary = {
  id: string;
  label: string;
  mode: string;
  coordination: string;
  crewIds: string[];
  forbiddenActions: string[];
  /** Enforced positive scope (catalog ids), or null when the swarm is tier-only. */
  allowedActionIds: string[] | null;
};

export type ActionSummary = {
  id: string;
  label: string;
  tier: string;
  status: string;
  autonomousAllowed: boolean;
  humanGateRequired: boolean;
  confirmationRequired: boolean;
};

export type AgenticSafetyMetadata = {
  allowedSwarmModes: string[];
  /** Modes that are intentionally NOT representable. */
  disallowedSwarmModes: string[];
  forbiddenAutonomousActions: string[];
  simulationOnly: true;
  noExternalTools: true;
  noDbWrites: true;
  noPromptOrUserTextStored: true;
};

export type AgenticRegistrySnapshot = {
  agents: AgentSummary[];
  crews: CrewSummary[];
  swarms: SwarmSummary[];
  actions: ActionSummary[];
  safety: AgenticSafetyMetadata;
};

/** Build the deterministic registry snapshot. Pure; safe to JSON.stringify. */
export function buildAgenticRegistrySnapshot(): AgenticRegistrySnapshot {
  const agents: AgentSummary[] = getAgenticInventory().map((a) => ({
    id: a.id,
    name: a.name,
    domain: a.domain,
  }));

  const crews: CrewSummary[] = CREW_SIMULATION_SCENARIOS.map((c) => ({
    id: c.id,
    label: c.label,
    trigger: c.trigger,
    mode: c.mode,
    risk: c.risk,
    stepCount: c.steps.length,
    forbiddenActions: [...c.forbiddenActions],
  }));

  const swarms: SwarmSummary[] = SWARM_DEFINITIONS.map((s) => ({
    id: s.id,
    label: s.label,
    mode: s.mode,
    coordination: s.coordination,
    crewIds: [...s.crewIds],
    forbiddenActions: [...s.forbiddenActions],
    allowedActionIds: s.allowedActionIds ? [...s.allowedActionIds] : null,
  }));

  const actions: ActionSummary[] = ACTION_READINESS_ITEMS.map((a) => ({
    id: a.id,
    label: a.label,
    tier: a.tier,
    status: a.status,
    autonomousAllowed: a.autonomousAllowed,
    humanGateRequired: a.humanGateRequired,
    confirmationRequired: a.confirmationRequired,
  }));

  const forbiddenAutonomousActions = ACTION_READINESS_ITEMS.filter(
    (a) => a.tier === "forbidden_autonomous",
  ).map((a) => a.id);

  const safety: AgenticSafetyMetadata = {
    allowedSwarmModes: ["simulation", "dry_run", "gated"],
    disallowedSwarmModes: ["autonomous_write"],
    forbiddenAutonomousActions,
    simulationOnly: true,
    noExternalTools: true,
    noDbWrites: true,
    noPromptOrUserTextStored: true,
  };

  return { agents, crews, swarms, actions, safety };
}
