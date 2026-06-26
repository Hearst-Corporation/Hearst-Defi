/**
 * Product Projection — public surface.
 *
 * Pure, deterministic, read-only projection artifact builder. No I/O, no write,
 * no external tool, no prompt/user text, no invented numbers, APY range only.
 * See docs/agentic/PRODUCT_PROJECTION_SWARM.md.
 */

export type {
  ProductProjectionInput,
  ProjectionReportArtifact,
  ProjectionMetric,
  ProjectionScenario,
  ProjectionChart,
  ProjectionRisk,
  ProvenanceSource,
  Confidence,
} from "./types";

export { validateProjectionInput } from "./validate-projection-input";
export type { ValidationResult } from "./validate-projection-input";

export { buildProjectionArtifact } from "./build-projection-artifact";

export {
  assertProjectionArtifactSafe,
  FORBIDDEN_WORDS,
  MANDATORY_DISCLAIMERS,
} from "./projection-guards";
export type { ProjectionGuardViolation } from "./projection-guards";
