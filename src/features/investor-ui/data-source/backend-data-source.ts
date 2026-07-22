// src/features/investor-ui/data-source/backend-data-source.ts
//
// The LIVE InvestorUiDataSource — reads from hearst-connect-backend
// (independent repository, github.com/Hearst-Corporation/hearst-connect-backend)
// over HTTP via `@/lib/backend`. This is now the DEFAULT implementation (see
// `./index.ts`); `FixtureInvestorUiDataSource` is used only for explicit
// `?state=` QA previews.
//
// NO silent fallback: a backend failure (network, 5xx, timeout) is NOT
// caught here and turned into a fixture — it propagates as a BackendError,
// mapped to an honest "ERROR" ResolvedViewModel block by the caller (the
// page), never masked. Distinguish this from the backend's own honest
// NOT_CONFIGURED (backend reachable, contract not deployed) — both render as
// "no live number", but only ERROR should say "we couldn't reach the data",
// while NOT_CONFIGURED says "there is honestly nothing there yet".

import type { InvestorUiDataSource } from "./investor-ui-data-source";
import type { BtcViewModel, BitcoinReserveViewModel, PerformanceViewModel } from "../types/btc";
import type {
  DashboardViewModel,
  InvestorIdentityViewModel,
  InvestorPositionViewModel,
  AllocationBreakdownViewModel,
  VaultCapacityViewModel,
  SubscriptionViewModel,
  DistributionViewModel,
  ActivityItemViewModel,
  AlertViewModel,
  ProofSummaryViewModel,
} from "../types/dashboard";
import type { MiningViewModel, MiningSummaryViewModel, ElectricityViewModel } from "../types/mining";
import type { ProfileViewModel } from "../types/profile";
import type { AiExpertResolvedViewModel } from "../types/ai-expert";
import { resolved, type ResolvedViewModel, type DataStatus as UiDataStatus } from "../types/common";

import {
  getBtcFromBackend,
  getMiningFromBackend,
  getDashboardFromBackend,
  getProfileFromBackend,
  isBackendError,
  type DataStatus,
  type Envelope,
  type BtcDTO,
  type MiningDTO,
  type DashboardDTO,
  type ProfileDTO,
} from "@/lib/backend";

/**
 * `getAiExperts` still throws: no AI-experts route exists on the backend
 * (verified 2026-07-22), so there is nothing to call, and throwing keeps the
 * gap visible instead of papering over it with a fabricated block.
 *
 * `getProfile` no longer belongs in this message — `/api/v1/profile` shipped
 * with backend 7cf84d9 (deployed and verified live 2026-07-22) and is wired
 * below.
 */
const NOT_WIRED_MESSAGE =
  "BackendInvestorUiDataSource: getAiExperts is not wired to hearst-connect-backend yet (no AI-experts screen endpoint exists) — see docs/backend-integration.md.";

/** Maps the backend's `DataStatus` to the UI's presentation `DataStatus`.
 *  1:1 for the 5 shared values — the UI has no "FIXTURE"/"ERROR" input here
 *  because this data source never fabricates or silently downgrades. */
function toUiStatus(status: DataStatus): UiDataStatus {
  switch (status) {
    case "LIVE":
      return "LIVE";
    case "STALE":
      return "STALE";
    case "PARTIAL":
      return "PARTIAL";
    case "NOT_CONFIGURED":
    case "NOT_SUPPORTED":
    case "PERMISSION_DENIED":
      return "NOT_CONFIGURED";
    case "UNAVAILABLE":
      return "UNAVAILABLE";
  }
}

function toFreshness(freshness: { readonly asOf: string | null; readonly ageSeconds: number | null; readonly stale: boolean }): string {
  if (freshness.asOf == null) return "unavailable";
  if (freshness.stale) return `stale — last updated ${freshness.asOf}`;
  return `as of ${freshness.asOf}`;
}

function mapReserve(dto: BtcDTO): ResolvedViewModel<BitcoinReserveViewModel> {
  const r = dto.reserve;
  return resolved<BitcoinReserveViewModel>(toUiStatus(r.status), r.value == null ? null : {
    reserveUsdc: r.value.balanceUsdc,
    reserveBps: null,
    electricityCoveredMonths: null,
    reserveBtcSats: null,
    reserveBtcUsd: r.value.balanceUsdc,
  }, {
    provenance: `backend:${r.provenance}`,
    freshness: toFreshness(r.freshness),
    error: r.reason ? { code: r.reason, message: r.reason } : null,
  });
}

function mapPerformance(dto: BtcDTO): ResolvedViewModel<PerformanceViewModel> {
  const t = dto.takeProfitTiers;
  return resolved<PerformanceViewModel>(toUiStatus(t.status), null, {
    provenance: `backend:${t.provenance}`,
    freshness: toFreshness(t.freshness),
    error: t.reason ? { code: t.reason, message: t.reason } : null,
  });
}

// MiningDTO's contract-owned fields (hashrate/btcEarned/curtailment/engine)
// are separate Resolved<T> blocks — the frontend's MiningSummaryViewModel
// merges hashrate+btcEarned (on-chain "metrics") with engine (term/fleet
// state) into one presentation block. All contract-owned, so composing them
// worst-first is correct: if any is NOT_CONFIGURED, the composite is too.
function mapMiningSummary(dto: MiningDTO): ResolvedViewModel<MiningSummaryViewModel> {
  const hashrate = dto.hashrate;
  const btcEarned = dto.btcEarned;
  const engine = dto.engine;
  const status = precedenceWorst(precedenceWorst(hashrate.status, btcEarned.status), engine.status);
  const value: MiningSummaryViewModel | null =
    hashrate.value != null && btcEarned.value != null && engine.value != null
      ? {
          reportedHashrateTh: hashrate.value.reportedHashrateTh,
          totalBtcEarnedSats: btcEarned.value.totalBtcEarnedSats,
          lastReportTime: hashrate.value.lastReportTime,
          currentMonth: engine.value.currentMonth,
          productDurationMonths: engine.value.productDurationMonths,
          fleetActive: engine.value.fleetActive,
          curtailed: engine.value.curtailed,
          halvingMonth: engine.value.halvingMonth,
          vendingCurveBps: engine.value.vendingCurveBps,
        }
      : null;
  const reason = hashrate.reason ?? btcEarned.reason ?? engine.reason;
  return resolved<MiningSummaryViewModel>(toUiStatus(status), value, {
    provenance: `backend:${hashrate.provenance}`,
    freshness: toFreshness(hashrate.freshness),
    error: reason ? { code: reason, message: reason } : null,
  });
}

function mapElectricity(dto: MiningDTO): ResolvedViewModel<ElectricityViewModel> {
  const el = dto.electricity;
  return resolved<ElectricityViewModel>(toUiStatus(el.status), el.value, {
    provenance: `backend:${el.provenance}`,
    freshness: toFreshness(el.freshness),
    error: el.reason ? { code: el.reason, message: el.reason } : null,
  });
}

function mapResolved<TBackend, TUi>(
  block: { readonly status: DataStatus; readonly value: TBackend | null; readonly provenance: string; readonly freshness: { readonly asOf: string | null; readonly ageSeconds: number | null; readonly stale: boolean }; readonly reason?: string },
  mapValue: (v: TBackend) => TUi,
): ResolvedViewModel<TUi> {
  return resolved<TUi>(toUiStatus(block.status), block.value == null ? null : mapValue(block.value), {
    provenance: `backend:${block.provenance}`,
    freshness: toFreshness(block.freshness),
    error: block.reason ? { code: block.reason, message: block.reason } : null,
  });
}

function mapDashboard(dto: DashboardDTO, generatedAt: string): DashboardViewModel {
  return {
    runtime: {
      mode: dto.runtime.mode,
      chainId: dto.runtime.chainId,
      contractAddress: dto.runtime.contractAddress,
      codePresent: dto.runtime.codePresent,
      indexerLagBlocks: dto.runtime.indexerLagBlocks,
      generatedAt,
    },
    identity: mapResolved<InvestorIdentityViewModel, InvestorIdentityViewModel>(dto.identity, (v) => v),
    position: mapResolved<InvestorPositionViewModel, InvestorPositionViewModel>(dto.position, (v) => v),
    allocation: mapResolved<AllocationBreakdownViewModel, AllocationBreakdownViewModel>(dto.allocation, (v) => v),
    capacity: mapResolved<VaultCapacityViewModel, VaultCapacityViewModel>(dto.capacity, (v) => v),
    subscription: mapResolved<SubscriptionViewModel, SubscriptionViewModel>(dto.subscription, (v) => v),
    distributions: mapResolved<DistributionViewModel, DistributionViewModel>(dto.distributions, (v) => v),
    activity: mapResolved<readonly ActivityItemViewModel[], readonly ActivityItemViewModel[]>(dto.activity, (v) => v),
    alerts: mapResolved<readonly AlertViewModel[], readonly AlertViewModel[]>(dto.alerts, (v) => v),
    proofs: mapResolved<ProofSummaryViewModel, ProofSummaryViewModel>(dto.proofs, (v) => v),
  };
}

const STATUS_PRECEDENCE: readonly DataStatus[] = [
  "UNAVAILABLE",
  "PERMISSION_DENIED",
  "NOT_SUPPORTED",
  "NOT_CONFIGURED",
  "STALE",
  "PARTIAL",
  "LIVE",
];

function precedenceWorst(a: DataStatus, b: DataStatus): DataStatus {
  return STATUS_PRECEDENCE.indexOf(a) <= STATUS_PRECEDENCE.indexOf(b) ? a : b;
}

/** Live data source backed by hearst-connect-backend. Errors are NOT caught
 *  here — see module header. The caller (page) decides how to render a
 *  thrown BackendError (honest ERROR block, never a fixture substitution). */
export class BackendInvestorUiDataSource implements InvestorUiDataSource {
  async getDashboard(): Promise<DashboardViewModel> {
    const envelope: Envelope<DashboardDTO> = await getDashboardFromBackend();
    return mapDashboard(envelope.data, envelope.meta.generatedAt);
  }

  async getBtc(): Promise<BtcViewModel> {
    const envelope: Envelope<BtcDTO> = await getBtcFromBackend();
    const dto = envelope.data;
    return {
      generatedAt: envelope.meta.generatedAt,
      reserve: mapReserve(dto),
      performance: mapPerformance(dto),
    };
  }

  async getMining(): Promise<MiningViewModel> {
    const envelope: Envelope<MiningDTO> = await getMiningFromBackend();
    const dto = envelope.data;
    return {
      generatedAt: envelope.meta.generatedAt,
      mining: mapMiningSummary(dto),
      electricity: mapElectricity(dto),
    };
  }

  /**
   * Wired to `GET /api/v1/profile` (backend 7cf84d9). The backend's profile is
   * IDENTITY-ONLY by design — position/distributions live on /api/v1/dashboard,
   * and duplicating them here would recreate the dual read path this codebase
   * removed. So exactly ONE of the nine blocks maps from the response; the
   * other eight resolve NOT_CONFIGURED with the honest motive ("no backend
   * endpoint serves this yet"), never a fabricated empty value:
   * a preferences block invented as all-false would state choices the user
   * never made, and an empty documents list would state "no documents" as a
   * fact nobody checked.
   *
   * The identity block carries the backend's own status through `toUiStatus`:
   * LIVE stays LIVE; PARTIAL ("no_investor_record" — a brand-new account, a
   * product state) stays PARTIAL with its reason attached; UNAVAILABLE
   * ("db_error") stays UNAVAILABLE. A transport failure (including a 404 from
   * an older backend without the route) is NOT caught here — it propagates as
   * a BackendError per this file's header, and the page renders an honest
   * ERROR block, never a fake profile.
   */
  async getProfile(): Promise<ProfileViewModel> {
    const envelope: Envelope<ProfileDTO> = await getProfileFromBackend();
    const identity = envelope.data.identity;

    const notServed = <T,>(what: string): ResolvedViewModel<T> =>
      resolved<T>("NOT_CONFIGURED", null, {
        provenance: "backend:none",
        freshness: "unavailable",
        error: {
          code: "no_backend_endpoint",
          message: `No backend endpoint serves ${what} yet — /api/v1/profile is identity-only.`,
        },
      });

    return {
      generatedAt: envelope.meta.generatedAt,
      identity: mapResolved<InvestorIdentityViewModel, InvestorIdentityViewModel>(
        identity,
        (v) => v,
      ),
      contact: notServed("contact details"),
      kyc: notServed("detailed KYC state"),
      investorStatus: notServed("investor standing"),
      security: notServed("security posture"),
      preferences: notServed("notification preferences"),
      documents: notServed("documents"),
      subscriptionHistory: notServed("subscription history"),
      activity: notServed("profile activity"),
    };
  }

  async getAiExperts(): Promise<AiExpertResolvedViewModel> {
    throw new Error(NOT_WIRED_MESSAGE);
  }

  /** Page-scoped extra blocks for /btc (attribution/production/custody/
   *  events/proofs) — not part of the shared InvestorUiDataSource interface
   *  (see src/app/(product)/btc/_data/btc-page-types.ts header), but this
   *  class exposes it directly so /btc's loader can call one data source for
   *  everything instead of mixing a shared interface + an ad hoc backend call. */
  async getBtcExtra(): Promise<BtcDTO> {
    const envelope: Envelope<BtcDTO> = await getBtcFromBackend();
    return envelope.data;
  }
}

export { isBackendError };
