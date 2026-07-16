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
import type { DashboardViewModel } from "../types/dashboard";
import type { MiningViewModel, MiningSummaryViewModel, ElectricityViewModel } from "../types/mining";
import type { ProfileViewModel } from "../types/profile";
import type { AiExpertResolvedViewModel } from "../types/ai-expert";
import { resolved, type ResolvedViewModel, type DataStatus as UiDataStatus } from "../types/common";

import {
  getBtcFromBackend,
  getMiningFromBackend,
  isBackendError,
  type DataStatus,
  type Envelope,
  type BtcDTO,
  type MiningDTO,
} from "@/lib/backend";

const NOT_WIRED_MESSAGE =
  "BackendInvestorUiDataSource: getDashboard/getProfile/getAiExperts are not wired to hearst-connect-backend yet (only /api/v1/btc and /api/v1/mining are consumed by this UI today) — see docs/backend-integration.md.";

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

function mapMiningSummary(dto: MiningDTO): ResolvedViewModel<MiningSummaryViewModel> {
  const m = dto.metrics;
  const e = dto.engine;
  // Two Resolved<T> blocks (metrics + engine) compose one UI block — status
  // is the worse of the two (worst-first, same precedence as the backend
  // envelope), value is null unless BOTH resolved.
  const status = precedenceWorst(m.status, e.status);
  const value: MiningSummaryViewModel | null =
    m.value != null && e.value != null
      ? {
          reportedHashrateTh: m.value.reportedHashrateTh,
          totalBtcEarnedSats: m.value.totalBtcEarnedSats,
          lastReportTime: m.value.lastReportTime,
          currentMonth: e.value.currentMonth,
          productDurationMonths: e.value.productDurationMonths,
          fleetActive: e.value.fleetActive,
          curtailed: e.value.curtailed,
          halvingMonth: e.value.halvingMonth,
          vendingCurveBps: e.value.vendingCurveBps,
        }
      : null;
  return resolved<MiningSummaryViewModel>(toUiStatus(status), value, {
    provenance: `backend:${m.provenance}`,
    freshness: toFreshness(m.freshness),
    error: m.reason ?? e.reason ? { code: m.reason ?? e.reason ?? "unknown", message: m.reason ?? e.reason ?? "unknown" } : null,
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
    throw new Error(NOT_WIRED_MESSAGE);
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

  async getProfile(): Promise<ProfileViewModel> {
    throw new Error(NOT_WIRED_MESSAGE);
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
