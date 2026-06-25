// Agentic Control Center — barrel export + aggregator.
//
// Read-only visibility layer over the agentic chain. Pure, client-safe, no I/O:
// no DB, no LLM, no tool execution, no mutation. The aggregator just composes the
// section accessors into one object for the page.

import type { AgenticControlCenterData } from "./types";
import { getRouterStatusSummary } from "./router-status";
import { getAgenticInventory } from "./inventory";
import { getHumanGateInventory } from "./gates";
import { getToolBoundarySummary } from "./tool-boundary-summary";
import { getPromptMap } from "./prompt-map";
import { getSafetySummary } from "./safety-summary";
import { getNextSteps } from "./next-steps";

export * from "./types";
export { getRouterStatusSummary } from "./router-status";
export { getAgenticInventory } from "./inventory";
export { getHumanGateInventory } from "./gates";
export { getToolBoundarySummary } from "./tool-boundary-summary";
export { getPromptMap } from "./prompt-map";
export { getSafetySummary } from "./safety-summary";
export { getNextSteps } from "./next-steps";

/** Static-registry marker. NOT a live timestamp — pure code has no Date.now. */
const REGISTRY_VERSION = "v0.1";
const GENERATED_AT = "static registry v0.1 / read-only";

/**
 * Aggregate every Control Center section into one read-only object.
 * Calls no DB, no LLM, executes no tool, mutates nothing.
 */
export function getAgenticControlCenterData(): AgenticControlCenterData {
  return {
    generatedAt: GENERATED_AT,
    version: REGISTRY_VERSION,
    router: getRouterStatusSummary(),
    inventory: getAgenticInventory(),
    gates: getHumanGateInventory(),
    tools: getToolBoundarySummary(),
    prompts: getPromptMap(),
    safetySummary: getSafetySummary(),
    nextSteps: getNextSteps(),
  };
}
