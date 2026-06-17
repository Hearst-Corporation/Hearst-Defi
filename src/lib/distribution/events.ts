/**
 * Distribution event definitions.
 *
 * These are the event names and payload shapes sent via Inngest
 * when distribution milestones are reached. Consumers register
 * Inngest functions against these event names to handle email
 * delivery, notifications, and audit fan-outs.
 *
 * Pure type module — no runtime imports, safe to use anywhere.
 */

// ---------------------------------------------------------------------------
// Event names
// ---------------------------------------------------------------------------

export const DISTRIBUTION_EVENTS = {
  EXECUTED: "distribution.executed",
} as const;

// ---------------------------------------------------------------------------
// Payload shapes
// ---------------------------------------------------------------------------

export interface DistributionExecutedPayload {
  /** ID of the Distribution row (primary key). */
  distributionId: string;
  /** Period string, e.g. "2026-05". */
  period: string;
  /** Total USDC amount distributed. */
  amountUsdc: number;
  /** Number of ledger entries created (= recipient count). */
  ledgerEntriesCount: number;
  /** Mock tx hash. Real hash injected post-audit in Phase 3. */
  txHash: string;
  /** ISO-8601 timestamp of execution. */
  executedAt: string;
}


