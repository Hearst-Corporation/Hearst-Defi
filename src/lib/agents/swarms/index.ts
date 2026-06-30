/**
 * Outreach Swarms — Multi-specialist campaign preparation.
 *
 * Export all swarm types and orchestration functions.
 *
 * @example
 * ```ts
 * import { runOutreachSwarm, shouldRunSwarm } from "@/lib/agents/swarms";
 *
 * if (shouldRunSwarm(intent)) {
 *   const run = runOutreachSwarm({
 *     message: "Prepare UAE investor campaign",
 *     intent: "create_campaign",
 *     isAdmin: true,
 *     userId: "user-123",
 *     recipientScope: "UAE family offices",
 *   });
 * }
 * ```
 */

// Types
export type {
  OutreachSwarmRole,
  SwarmStatus,
  SwarmConfidence,
  OutreachSpecialistOutput,
  OutreachSwarmRun,
  OutreachSwarmActionCard,
  OutreachSwarmInput,
  OutreachSwarmConfig,
} from "./outreach-swarm-types";

// Core
export {
  DEFAULT_SWARM_CONFIG,
  validateSwarmSafety,
  validateSwarmRunSafety,
} from "./outreach-swarm-types";

// Orchestrator
export {
  runOutreachSwarm,
  shouldRunSwarm,
  runOutreachSwarmIfNeeded,
} from "./outreach-swarm-orchestrator";

// Specialists (for advanced use)
export { runLeadResearchSpecialist } from "./specialists/lead-research";
export { runSegmentationSpecialist, isSafeSegment } from "./specialists/segmentation";
export { runChannelStrategySpecialist, getChannelGuidance } from "./specialists/channel-strategy";
export { runDraftWriterSpecialist, getAvailableTemplates } from "./specialists/draft-writer";
export { runSafetyReviewSpecialist, COMPLIANCE_CHECKS } from "./specialists/safety-review";
export { runCampaignSummarySpecialist } from "./specialists/campaign-summary";
