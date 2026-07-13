/** Canonical empty-state copy for portfolio surfaces — honest, no fabricated data. */

export const PORTFOLIO_DISTRIBUTIONS_CHART_EMPTY = "No distributions yet" as const;

export const PORTFOLIO_DISTRIBUTIONS_HISTORY_EMPTY = {
  message: "No distributions yet",
  detail:
    "Monthly USDC distributions appear here once your position starts paying out.",
} as const;

export const PORTFOLIO_DISTRIBUTIONS_LEAF_EMPTY = {
  message: "No distributions yet",
  detail: "Monthly USDC payouts appear here once your first cycle settles.",
} as const;

export const PORTFOLIO_TRANSACTIONS_EMPTY = {
  message: "No transactions yet",
  detail:
    "Deposits, payouts, and withdrawals appear here once activity is posted.",
} as const;

export const PORTFOLIO_REBALANCING_EMPTY = {
  message: "No rebalancing recorded on this vault yet.",
  detail:
    "Rebalancings are rare, deterministic, vault-wide operational events — they apply to the whole vault, not to your individual position.",
} as const;

export const PORTFOLIO_REBALANCING_SINCE_ENTRY_EMPTY = {
  message: "No rebalancing has been recorded since your entry.",
  detail:
    "This vault does have older operational rebalancing history from before your subscription.",
} as const;

export const PORTFOLIO_MINING_ALLOCATION_EMPTY = {
  message: "No mining allocation yet",
  detail:
    "Once capital is allocated to B1, this panel estimates your allocated fleet power from machine cost.",
} as const;

export const PORTFOLIO_MINING_ECONOMICS_EMPTY = {
  message: "Mining Economics is not available yet.",
  detail:
    "Cost to produce, production margin and break-even BTC price activate once a reference machine cost basis is available.",
} as const;

export const PORTFOLIO_PRODUCTION_CHART_EMPTY = "No production data yet" as const;

export const PORTFOLIO_ON_CHAIN_PROOFS_EMPTY = {
  message: "No on-chain proofs recorded yet.",
} as const;
