/**
 * Live-read swarm safety floor — pure, no I/O.
 *
 * The hard invariants of the live-read family, asserted by the test suite over
 * every stage definition AND over the final draft:
 *
 *  - mode is exactly `live_read` (never write/deploy/send);
 *  - every capability is a READ / COMPUTE / RENDER — never a mutation;
 *  - the floor forbidden-actions set is a subset of each stage's forbiddenActions
 *    (so deploy_product / mark_vault_live / *_send_run / custodial_transfer can
 *    never be reachable from any stage);
 *  - the produced draft's `effects` are all false (nothing was sent/deployed/
 *    marked-live/written custodially).
 *
 * A violation is returned, never thrown — the caller decides (the pipeline turns
 * any violation into a typed `unsafe` error rather than proceeding).
 */

import {
  LIVE_READ_FORBIDDEN_ACTIONS,
  type LiveStageCapability,
  type LiveSwarmStageDef,
  type ProductConstructionDraft,
} from "./types";

/** Capabilities that are read/compute/render — the ONLY ones a stage may use. */
const READONLY_CAPABILITIES: ReadonlySet<LiveStageCapability> = new Set([
  "read_telegram",
  "read_market",
  "compute",
  "render_artifact",
  "compose_prose_guarded",
]);

export interface LiveSafetyViolation {
  kind:
    | "unsafe_mode"
    | "non_readonly_capability"
    | "missing_floor_forbidden"
    | "effect_not_suppressed";
  stageId?: string;
  detail: string;
}

/** Assert one stage definition against the floor. */
export function assertStageSafe(stage: LiveSwarmStageDef): LiveSafetyViolation[] {
  const v: LiveSafetyViolation[] = [];

  if (stage.mode !== "live_read") {
    v.push({
      kind: "unsafe_mode",
      stageId: stage.id,
      detail: `Stage "${stage.id}" mode "${stage.mode}" is not "live_read".`,
    });
  }

  for (const cap of stage.capabilities) {
    if (!READONLY_CAPABILITIES.has(cap)) {
      v.push({
        kind: "non_readonly_capability",
        stageId: stage.id,
        detail: `Stage "${stage.id}" declares non-read/compute capability "${cap}".`,
      });
    }
  }

  const forbidden = new Set(stage.forbiddenActions.map((a) => a.toLowerCase()));
  for (const floor of LIVE_READ_FORBIDDEN_ACTIONS) {
    if (!forbidden.has(floor)) {
      v.push({
        kind: "missing_floor_forbidden",
        stageId: stage.id,
        detail: `Stage "${stage.id}" must forbid floor action "${floor}".`,
      });
    }
  }

  return v;
}

/** Assert every stage in the pipeline definition. */
export function assertAllStagesSafe(
  stages: readonly LiveSwarmStageDef[],
): LiveSafetyViolation[] {
  return stages.flatMap(assertStageSafe);
}

/**
 * Assert the FINAL draft suppressed every effect. The pipeline never performs a
 * real action, so all four effect flags must be false; if any is true the draft
 * is rejected as unsafe rather than surfaced.
 */
export function assertDraftEffectsSuppressed(
  draft: Pick<ProductConstructionDraft, "effects">,
): LiveSafetyViolation[] {
  const v: LiveSafetyViolation[] = [];
  const e = draft.effects as Record<string, boolean>;
  for (const key of [
    "externalSend",
    "deployed",
    "markedLive",
    "custodialWrite",
  ]) {
    if (e[key] !== false) {
      v.push({
        kind: "effect_not_suppressed",
        detail: `Draft effect "${key}" must be false (no real action), got ${String(e[key])}.`,
      });
    }
  }
  return v;
}
