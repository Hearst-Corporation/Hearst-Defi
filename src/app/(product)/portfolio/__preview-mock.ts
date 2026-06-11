import "server-only";

import type { PortfolioData } from "@/lib/data/portfolio";

/**
 * TEMPORARY layout-preview mock. Lets us render the SUBSCRIBED dashboard with
 * realistic numbers while we tune its proportions — independent of DB seed.
 *
 * NOT wired into production: only used when PREVIEW_LAYOUT is flipped on in
 * page.tsx. Delete both once the layout pass is signed off.
 */

const now = new Date();
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

export const PREVIEW_PORTFOLIO: PortfolioData = {
  positions: [
    {
      id: "preview-1",
      vaultName: "Hearst Yield Vault",
      principalUsdc: 500_000,
      accruedYieldUsdc: 18_420,
      distributedUsdc: 12_300,
      valueUsdc: 518_420,
      status: "active",
      apyLow: 9.4,
      apyHigh: 12.8,
      subscribedAt: ago(124),
    },
    {
      id: "preview-2",
      vaultName: "Hearst Yield Vault",
      principalUsdc: 250_000,
      accruedYieldUsdc: 6_180,
      distributedUsdc: 4_050,
      valueUsdc: 256_180,
      status: "active",
      apyLow: 9.4,
      apyHigh: 12.8,
      subscribedAt: ago(58),
    },
  ],
  totalValueUsdc: 774_600,
  totalYieldYtdUsdc: 40_950,
  nextDistributionAt: new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 0),
  ),
  recentTransactions: [
    {
      id: "tx-1",
      type: "distribution",
      amountUsdc: 5_240,
      occurredAt: ago(4),
      txHash: "0xabc123",
      positionVaultName: "Hearst Yield Vault",
    },
    {
      id: "tx-2",
      type: "deposit",
      amountUsdc: 250_000,
      occurredAt: ago(58),
      txHash: "0xdef456",
      positionVaultName: "Hearst Yield Vault",
    },
    {
      id: "tx-3",
      type: "claim",
      amountUsdc: 3_100,
      occurredAt: ago(34),
      txHash: "0x789aaa",
      positionVaultName: "Hearst Yield Vault",
    },
  ],
  pnl: {
    contributedUsdc: 750_000,
    currentValueUsdc: 774_600,
    realizedUsdc: 16_350,
    unrealizedUsdc: 24_600,
    totalReturnUsdc: 40_950,
    netReturnPct: 5.46,
    annualizedReturnPct: 11.2,
  },
  source: "live",
  updatedAt: now,
};
