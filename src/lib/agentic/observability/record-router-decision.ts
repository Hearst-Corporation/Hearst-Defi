import "server-only";

// Router Observability v0 — safe recorder used by the cockpit-chat route.
//
// `recordRouterDecisionSafe` is the ONLY entry point the route calls. It:
//   - builds a SAFE trace (decision-summary drops all user text),
//   - appends it to the capped store (Redis or in-memory),
//   - NEVER throws and NEVER blocks the chat response (fire-and-forget friendly).
//
// It changes NO router/guard behaviour: it only observes the already-computed
// decision + the outcome the caller derived at the branch site.

import { buildRouterDecisionId } from "@/lib/trace-ids";
import { logger } from "@/lib/logger";
import type { AgenticIntentDecision } from "@/lib/agentic/intent-router-types";
import {
  buildRouterDecisionTrace,
  buildUnknownDecisionTrace,
} from "./decision-summary";
import { appendRouterDecisionTrace } from "./store";
import type { RouterDecisionOutcome } from "./types";

export interface RecordRouterDecisionInput {
  /** The classified decision. Undefined when the router was unavailable. */
  decision: AgenticIntentDecision | undefined;
  /** Outcome derived at the branch site in the route. */
  outcome: RouterDecisionOutcome;
  /** Turn id (drives the trace id — never a user value). */
  turnId: string;
  chatId?: string | null;
  messageId?: string | null;
}

/**
 * Record one router decision. Best-effort: any failure is caught and logged at
 * warn so the chat flow is never affected. Returns void; callers may `await` or
 * fire-and-forget with `void`.
 */
export async function recordRouterDecisionSafe(
  input: RecordRouterDecisionInput,
): Promise<void> {
  try {
    const ctx = {
      id: buildRouterDecisionId(input.turnId),
      // Timestamp stamped here (server-only module — not a pure type module).
      createdAt: new Date().toISOString(),
      outcome: input.outcome,
      ...(input.chatId ? { chatId: input.chatId } : {}),
      ...(input.messageId ? { messageId: input.messageId } : {}),
    };
    const trace = input.decision
      ? buildRouterDecisionTrace(input.decision, ctx)
      : buildUnknownDecisionTrace(ctx);
    await appendRouterDecisionTrace(trace);
  } catch (err) {
    // Observability must never break chat. Swallow after logging.
    logger.warn(
      "router-observability: recordRouterDecisionSafe failed (non-blocking)",
      {},
      err instanceof Error ? err : undefined,
    );
  }
}
