// src/features/investor-ui/data-source/fixture-data-source.ts
//
// The fixture-backed InvestorUiDataSource. Deterministic, no I/O, safe to use
// in any environment (dev/preview/tests). This is the DEFAULT implementation
// today because GPU1's public investor-UI endpoints are not wired yet
// (Gpu1InvestorUiDataSource is a prepared skeleton, not active).
//
// Each getter marks its blocks `status: "FIXTURE"` / `provenance: "fixture"`
// via the shared `fixtureBlock` / `fixtureUnresolved` helpers — never LIVE.

import type { InvestorUiDataSource } from "./investor-ui-data-source";
import type { BtcViewModel } from "../types/btc";
import type { DashboardViewModel } from "../types/dashboard";
import type { MiningViewModel } from "../types/mining";
import type { ProfileViewModel } from "../types/profile";
import type { AiExpertResolvedViewModel } from "../types/ai-expert";

import { dashboardCompleteFixture } from "../fixtures/dashboard-complete";
import { dashboardPartialFixture } from "../fixtures/dashboard-partial";
import { dashboardUnavailableFixture } from "../fixtures/dashboard-unavailable";
import { dashboardNotConfiguredFixture } from "../fixtures/dashboard-not-configured";
import { dashboardNoPositionFixture } from "../fixtures/dashboard-no-position";
import { dashboardCapFullFixture } from "../fixtures/dashboard-cap-full";
import { dashboardNotEligibleFixture } from "../fixtures/dashboard-not-eligible";
import { btcCompleteFixture } from "../fixtures/btc-complete";
import { btcNotConfiguredFixture } from "../fixtures/btc-not-configured";
import { miningCompleteFixture } from "../fixtures/mining-complete";
import { miningStaleFixture } from "../fixtures/mining-stale";
import { miningUnavailableFixture } from "../fixtures/mining-unavailable";
import { profileCompleteFixture } from "../fixtures/profile-complete";
import { profileIncompleteFixture } from "../fixtures/profile-incomplete";
import { aiExpertCompleteFixture, aiExpertUnavailableFixture } from "../fixtures/ai-expert-complete";

/** The `?state=` values a screen's QA switcher can accept, mapped to a named
 *  fixture per screen. Unknown/absent values fall back to "complete". */
export type DashboardFixtureState =
  | "complete"
  | "partial"
  | "unavailable"
  | "not-configured"
  | "no-position"
  | "cap-full"
  | "not-eligible";

export type BtcFixtureState = "complete" | "not-configured";
export type MiningFixtureState = "complete" | "stale" | "unavailable";
export type ProfileFixtureState = "complete" | "incomplete";

const DASHBOARD_FIXTURES: Record<DashboardFixtureState, DashboardViewModel> = {
  complete: dashboardCompleteFixture,
  partial: dashboardPartialFixture,
  unavailable: dashboardUnavailableFixture,
  "not-configured": dashboardNotConfiguredFixture,
  "no-position": dashboardNoPositionFixture,
  "cap-full": dashboardCapFullFixture,
  "not-eligible": dashboardNotEligibleFixture,
};

const BTC_FIXTURES: Record<BtcFixtureState, BtcViewModel> = {
  complete: btcCompleteFixture,
  "not-configured": btcNotConfiguredFixture,
};

const MINING_FIXTURES: Record<MiningFixtureState, MiningViewModel> = {
  complete: miningCompleteFixture,
  stale: miningStaleFixture,
  unavailable: miningUnavailableFixture,
};

const PROFILE_FIXTURES: Record<ProfileFixtureState, ProfileViewModel> = {
  complete: profileCompleteFixture,
  incomplete: profileIncompleteFixture,
};

export interface FixtureInvestorUiDataSourceOptions {
  readonly dashboard?: DashboardFixtureState;
  readonly btc?: BtcFixtureState;
  readonly mining?: MiningFixtureState;
  readonly profile?: ProfileFixtureState;
}

/** Fixture-backed data source — the only implementation wired pre-launch
 *  (PermissionedDynaVault v2.1 not deployed, CLAUDE.md non-negotiable #8). */
export class FixtureInvestorUiDataSource implements InvestorUiDataSource {
  private readonly dashboardState: DashboardFixtureState;
  private readonly btcState: BtcFixtureState;
  private readonly miningState: MiningFixtureState;
  private readonly profileState: ProfileFixtureState;

  constructor(options: FixtureInvestorUiDataSourceOptions = {}) {
    this.dashboardState = options.dashboard ?? "complete";
    this.btcState = options.btc ?? "complete";
    this.miningState = options.mining ?? "complete";
    this.profileState = options.profile ?? "complete";
  }

  async getDashboard(): Promise<DashboardViewModel> {
    return DASHBOARD_FIXTURES[this.dashboardState];
  }

  async getBtc(): Promise<BtcViewModel> {
    return BTC_FIXTURES[this.btcState];
  }

  async getMining(): Promise<MiningViewModel> {
    return MINING_FIXTURES[this.miningState];
  }

  async getProfile(): Promise<ProfileViewModel> {
    return PROFILE_FIXTURES[this.profileState];
  }

  async getAiExperts(): Promise<AiExpertResolvedViewModel> {
    return this.dashboardState === "unavailable"
      ? aiExpertUnavailableFixture
      : aiExpertCompleteFixture;
  }
}

function isDashboardFixtureState(value: string): value is DashboardFixtureState {
  return Object.hasOwn(DASHBOARD_FIXTURES, value);
}
function isBtcFixtureState(value: string): value is BtcFixtureState {
  return Object.hasOwn(BTC_FIXTURES, value);
}
function isMiningFixtureState(value: string): value is MiningFixtureState {
  return Object.hasOwn(MINING_FIXTURES, value);
}
function isProfileFixtureState(value: string): value is ProfileFixtureState {
  return Object.hasOwn(PROFILE_FIXTURES, value);
}

/** Resolve a fixture data source from `?state=` preview query params — one
 *  per screen, all optional. Unknown/absent values fall back to "complete". */
export function getFixtureInvestorUiDataSource(previewState?: {
  dashboard?: string | null;
  btc?: string | null;
  mining?: string | null;
  profile?: string | null;
}): FixtureInvestorUiDataSource {
  return new FixtureInvestorUiDataSource({
    dashboard:
      previewState?.dashboard != null && isDashboardFixtureState(previewState.dashboard)
        ? previewState.dashboard
        : "complete",
    btc:
      previewState?.btc != null && isBtcFixtureState(previewState.btc)
        ? previewState.btc
        : "complete",
    mining:
      previewState?.mining != null && isMiningFixtureState(previewState.mining)
        ? previewState.mining
        : "complete",
    profile:
      previewState?.profile != null && isProfileFixtureState(previewState.profile)
        ? previewState.profile
        : "complete",
  });
}
