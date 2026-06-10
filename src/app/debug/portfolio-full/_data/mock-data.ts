import type {
  PortfolioData,
  PortfolioPosition,
  PortfolioTransaction,
} from "@/lib/data/portfolio";

/** Static demo portfolio for `/debug/portfolio-full` only. */
export const MOCK_POSITIONS: PortfolioPosition[] = [
  {
    id: "mock-pos-1",
    vaultName: "Hearst Yield Vault",
    principalUsdc: 500_000,
    accruedYieldUsdc: 42_300,
    distributedUsdc: 18_500,
    valueUsdc: 542_300,
    status: "active",
    apyLow: 9.4,
    apyHigh: 12.8,
    subscribedAt: new Date("2025-11-12T00:00:00Z"),
  },
  {
    id: "mock-pos-2",
    vaultName: "Hearst Yield Vault",
    principalUsdc: 250_000,
    accruedYieldUsdc: 11_200,
    distributedUsdc: 6_400,
    valueUsdc: 261_200,
    status: "active",
    apyLow: 9.4,
    apyHigh: 12.8,
    subscribedAt: new Date("2026-02-03T00:00:00Z"),
  },
  {
    id: "mock-pos-3",
    vaultName: "Hearst Yield Vault",
    principalUsdc: 100_000,
    accruedYieldUsdc: 2_100,
    distributedUsdc: 8_200,
    valueUsdc: 102_100,
    status: "matured",
    apyLow: 8.2,
    apyHigh: 11.1,
    subscribedAt: new Date("2024-06-01T00:00:00Z"),
  },
];

export const MOCK_TRANSACTIONS: PortfolioTransaction[] = [
  {
    id: "mock-tx-1",
    type: "distribution",
    amountUsdc: 12_450,
    occurredAt: new Date("2026-04-30T12:00:00Z"),
    txHash: "0x8f2a…c91e",
    positionVaultName: "Hearst Yield Vault",
  },
  {
    id: "mock-tx-2",
    type: "deposit",
    amountUsdc: 250_000,
    occurredAt: new Date("2026-02-03T09:15:00Z"),
    txHash: "0x4b1d…7a02",
    positionVaultName: "Hearst Yield Vault",
  },
  {
    id: "mock-tx-3",
    type: "distribution",
    amountUsdc: 6_050,
    occurredAt: new Date("2026-03-31T12:00:00Z"),
    txHash: null,
    positionVaultName: "Hearst Yield Vault",
  },
  {
    id: "mock-tx-4",
    type: "claim",
    amountUsdc: 4_200,
    occurredAt: new Date("2026-01-15T16:40:00Z"),
    txHash: "0x19ef…33bd",
    positionVaultName: "Hearst Yield Vault",
  },
  {
    id: "mock-tx-5",
    type: "deposit",
    amountUsdc: 500_000,
    occurredAt: new Date("2025-11-12T10:00:00Z"),
    txHash: "0xa03c…88f1",
    positionVaultName: "Hearst Yield Vault",
  },
];

export const MOCK_PORTFOLIO: PortfolioData = {
  positions: MOCK_POSITIONS,
  totalValueUsdc: MOCK_POSITIONS.reduce((s, p) => s + p.valueUsdc, 0),
  totalYieldYtdUsdc: 60_800,
  nextDistributionAt: new Date("2026-05-31T00:00:00Z"),
  recentTransactions: MOCK_TRANSACTIONS,
  // Static debug fixture — must NOT claim a Live provenance (CLAUDE.md #2).
  source: "fallback",
};
