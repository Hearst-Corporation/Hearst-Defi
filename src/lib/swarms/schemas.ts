import { z } from "zod";

/**
 * Zod schemas for the crewai-engine HTTP contract (kickoff→poll).
 *
 * Defensive by design: `z.object` strips unknown keys (no `.passthrough`
 * needed), so engine responses can carry extra fields without breaking the
 * parse. We validate only what we consume — the rest is intentionally dropped.
 */

/** Lifecycle of a swarm run. `paused_hitl` means the run awaits a human
 *  decision (resume endpoint); the others are self-explanatory. */
export const RunStatusSchema = z.enum([
  "pending",
  "running",
  "paused_hitl",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

/** Terminal states — polling stops here. */
export const TERMINAL_STATUSES: readonly RunStatus[] = [
  "completed",
  "failed",
  "cancelled",
] as const;

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Response of POST /v1/swarms/{id}/kickoff — returns immediately (202). */
export const SwarmKickoffResponseSchema = z.object({
  run_id: z.string().min(1),
  swarm_id: z.string().min(1),
  status: RunStatusSchema,
});
export type SwarmKickoffResponse = z.infer<typeof SwarmKickoffResponseSchema>;

/** Response of GET /v1/swarms/{id}/status/{run_id} — the run record. The engine
 *  returns `id`; some routes echo `run_id`. Both optional, accept either. */
export const SwarmRunSchema = z.object({
  id: z.string().optional(),
  run_id: z.string().optional(),
  swarm_id: z.string().optional(),
  status: RunStatusSchema,
  /** The agentic output text once `completed`. */
  result_text: z.string().optional(),
  total_cost_usd: z.number().optional(),
  total_tokens: z.number().optional(),
  /** Step trace — shape varies per engine version; kept loose on purpose. */
  steps: z.array(z.unknown()).optional(),
  /** Present when status === "paused_hitl": the decision awaiting a human. */
  decision: z.unknown().optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
});
export type SwarmRun = z.infer<typeof SwarmRunSchema>;

/** Body accepted by every kickoff. `inputs` is the swarm-specific payload. */
export const SwarmKickoffBodySchema = z.object({
  trigger: z
    .enum(["morning", "evening", "intraday", "on_demand", "webhook"])
    .default("on_demand"),
  inputs: z.record(z.string(), z.unknown()).default({}),
});
export type SwarmKickoffBody = z.input<typeof SwarmKickoffBodySchema>;
