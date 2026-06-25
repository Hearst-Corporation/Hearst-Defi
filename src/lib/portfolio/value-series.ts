/**
 * Portfolio value chart series types.
 *
 * (2026-06-25, Agent 1/4 Cleanup: logic removed, types kept for data wiring).
 */

export type ValueSeriesTx = {
  type: "deposit" | "claim" | "withdraw" | "distribution";
  amountUsdc: number;
  occurredAt: Date;
};
