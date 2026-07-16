// src/features/investor-ui/types/dashboard.ts
//
// Dashboard-screen view models. Field shapes mirror hearst-connect-backend's DashboardDTO
// blocks (InvestorIdentity, InvestorPosition, AllocationBreakdown,
// VaultCapacityBlock, SubscriptionSummary, DistributionSummary, ActivityItem,
// AlertItem, ProofSummary, RuntimeSummary — hearst-connect-backend/src/domain/index.ts
// ~L96-227) redeclared locally as UI types, NOT imported cross-repo.

import type { ResolvedViewModel } from "./common";

export type PocketId = "B1" | "B2" | "B3";

export interface InvestorIdentityViewModel {
  readonly kycStatus: string | null; // pending | approved | rejected
  readonly shareClass: "A" | "B" | null;
  readonly whitelisted: boolean | null;
  readonly walletAddress: string | null;
  readonly accredited: boolean;
}

export interface InvestorPositionViewModel {
  readonly principal: string | null; // USDC decimal string
  readonly accrued: string | null; // BTC accumulated (est.), USDC-denominated
  readonly value: string | null; // principal + accrued
  readonly deposits: string | null;
  readonly withdrawals: string | null;
  readonly shares: string | null;
  readonly positionsCount: number;
  readonly subscribedAt: string | null; // ISO, lock-up anchor
  readonly status: string | null; // active | matured | exited
}

export interface AllocationPocketViewModel {
  readonly pocket: PocketId;
  readonly label: string;
  readonly targetBps: number; // product constant, e.g. 4000 | 2700 | 3300
  readonly actualBps: number | null; // on-chain, null until v2 indexed
}

export interface AllocationBreakdownViewModel {
  readonly pockets: readonly AllocationPocketViewModel[];
  readonly targetTotalBps: number; // 10000
}

export interface VaultCapacityViewModel {
  readonly tvlCap: string | null;
  readonly totalAssets: string | null;
  readonly availableCapacity: string | null; // computed upstream, never in UI
  readonly utilizationBps: number | null;
}

export interface SubscriptionViewModel {
  readonly subscriptionOpen: boolean;
  readonly minimumDeposit: string | null;
  readonly whitelistRequired: boolean;
  readonly userEligible: boolean | null;
}

export interface DistributionItemViewModel {
  readonly period: string; // "2026-04"
  readonly amountUsdc: string;
  readonly distributedAt: string; // ISO
  readonly status: string;
}

export interface DistributionViewModel {
  readonly count: number;
  readonly totalDistributedUsdc: string | null;
  readonly lastDistributionAt: string | null;
  readonly recent: readonly DistributionItemViewModel[];
}

export interface ActivityItemViewModel {
  readonly type: string; // deposit | claim | withdraw | distribution
  readonly amountUsdc: string;
  readonly occurredAt: string; // ISO
  readonly txHash: string | null;
}

export type AlertSeverity = "info" | "notice" | "warning";

export interface AlertViewModel {
  readonly code: string; // e.g. "kyc_pending" | "no_position"
  readonly severity: AlertSeverity;
  readonly message: string;
}

export interface ProofSummaryViewModel {
  readonly totalProofs: number;
  readonly latestProofAt: string | null;
  readonly types: readonly string[];
}

export type ContractRuntimeMode = "v2-testnet" | "v2-mainnet" | "not_configured";

export interface RuntimeViewModel {
  readonly mode: ContractRuntimeMode;
  readonly chainId: number | null;
  readonly contractAddress: string | null;
  readonly codePresent: boolean;
  readonly indexerLagBlocks: number | null;
  readonly generatedAt: string; // ISO — when this DTO/view model was assembled
}

/**
 * Aggregated dashboard view model — ONE call per screen, composed of
 * independently-resolved blocks (never a flat object). A consumer renders
 * each block's own status; a NOT_CONFIGURED `capacity` block does not force
 * the rest of the page into an error state.
 */
export interface DashboardViewModel {
  readonly runtime: RuntimeViewModel;
  readonly identity: ResolvedViewModel<InvestorIdentityViewModel>;
  readonly position: ResolvedViewModel<InvestorPositionViewModel>;
  readonly allocation: ResolvedViewModel<AllocationBreakdownViewModel>;
  readonly capacity: ResolvedViewModel<VaultCapacityViewModel>;
  readonly subscription: ResolvedViewModel<SubscriptionViewModel>;
  readonly distributions: ResolvedViewModel<DistributionViewModel>;
  readonly activity: ResolvedViewModel<readonly ActivityItemViewModel[]>;
  readonly alerts: ResolvedViewModel<readonly AlertViewModel[]>;
  readonly proofs: ResolvedViewModel<ProofSummaryViewModel>;
}
