/**
 * Live-read swarm family — public surface.
 *
 * A data-grounded product-construction pipeline (6 swarms) that FETCHES real
 * market/Telegram data and COMPUTES a numeric, charted, written draft — strictly
 * read-only (no write, send, deploy, or mark-live). See ./types for the contract
 * and ./assert-live-safe for the enforced floor.
 */

export type {
  LiveReadMode,
  LiveSwarmStageId,
  LiveSwarmStageDef,
  LiveSwarmStepAudit,
  LiveProvenance,
  StrategyCrossArtifact,
  QuantArtifact,
  ChartArtifact,
  WriteupArtifact,
  ProductConstructionDraft,
  ProductConstructionError,
} from "./types";
export { LIVE_READ_FORBIDDEN_ACTIONS } from "./types";

export {
  LIVE_SWARM_STAGES,
  LIVE_SWARM_STAGE_IDS,
  getLiveSwarmStage,
} from "./stage-registry";

export {
  assertStageSafe,
  assertAllStagesSafe,
  assertDraftEffectsSuppressed,
} from "./assert-live-safe";
export type { LiveSafetyViolation } from "./assert-live-safe";

export { runCharts, buildDeterministicWriteup } from "./runners-artifacts";

export {
  runProductConstructionPipeline,
  isProductConstructionError,
} from "./pipeline";
export type { PipelineOptions } from "./pipeline";
