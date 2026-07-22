// /dashboard — the server-side loader.
//
// Reads the investor overview from hearst-connect-backend over HTTP instead of
// from `src/lib/chain/dynavault.ts`. Same rule as /vaults: one source for a
// business fact, and it is the backend.
//
// ── Why this file ADAPTS instead of re-typing the component ─────────────────
// `Series1Dashboard` is typed against the chain adapter's domain types
// (`VaultCore`, `StrategyInfo`, `MiningMetrics`, `ElecStatus`, `OpsState`,
// `ProductDuration`) — bigint-valued, because that is what a uint256 decodes
// to. The backend sends the same facts as decimal STRINGS (JSON has no
// bigint). So this module rebuilds those exact shapes from backend data, and
// the whole presentation tree stays untouched.
//
// The conversion is lossless in the direction that matters: `BigInt("127…")`
// is exact for any uint256, whereas `Number()` would silently round above
// 2^53 — a wrong TVL no test would catch. Nothing here parses a float.
//
// ── The honesty rule ───────────────────────────────────────────────────────
// Every absent field becomes an `unavailable` envelope carrying WHY, never a
// zero and never a fixture. A field the backend reports as null is
// `not_supported`; a whole read the backend could not produce keeps its own
// reason; and a backend that never answered at all is an `error` state the
// page renders as "we couldn't reach the data" — a different sentence from
// "there is honestly nothing there yet".

import "server-only";

import {
  getMiningElectricityFromBackend,
  getMiningOnchainFromBackend,
  getProductFactsheetFromBackend,
  getVaultFromBackend,
  getVaultStrategiesFromBackend,
  isBackendError,
} from "@/lib/backend";
import { resolvedToWired, selectExposedFromWired, type WiredFromBackend } from "@/lib/backend/resolved-view";
import { logger } from "@/lib/logger";

/** The adapter-shaped payloads the Series 1 dashboard tree consumes. Declared
 *  structurally so this module needs no `@/lib/chain/dynavault` import — the
 *  page passes them straight through and TypeScript checks the fit there. */
export interface DashboardCore {
  readonly totalAssets: bigint;
  readonly totalShares: bigint;
  readonly navPerShare: bigint;
  readonly asset: string;
  readonly assetDecimals: number;
}

export interface DashboardStrategy {
  readonly index: number;
  readonly adapter: string;
  readonly allocationBps: bigint;
  readonly enabled: boolean;
  readonly isIdle: boolean;
}

export interface DashboardMining {
  readonly reportedHashrateTh: bigint;
  readonly totalBtcEarnedSats: bigint;
  readonly lastReportTime: bigint;
}

export interface DashboardElec {
  readonly monthlyElecCost: bigint;
  readonly elecPayee: string;
  readonly totalElecPaid: bigint;
  /** null = no payment has ever been made. NOT 0 — that would render as the
   *  Unix epoch, i.e. a payment dated 1970. */
  readonly lastElecPaymentTime: bigint | null;
  readonly canPay: boolean;
}

export interface DashboardOps {
  readonly isCurtailed: boolean;
  readonly currentMonth: bigint;
  readonly miningNoteMode: boolean;
}

export interface DashboardDuration {
  readonly months: bigint;
}

export interface DashboardPageDataOk {
  readonly state: "ok";
  readonly core: WiredFromBackend<DashboardCore>;
  readonly strategies: WiredFromBackend<DashboardStrategy[]>;
  readonly mining: WiredFromBackend<DashboardMining>;
  readonly elec: WiredFromBackend<DashboardElec>;
  readonly ops: WiredFromBackend<DashboardOps>;
  readonly duration: WiredFromBackend<DashboardDuration>;
  readonly runtimeMode: string;
}

export interface DashboardPageDataError {
  readonly state: "error";
  readonly detail: string;
}

export type DashboardPageData = DashboardPageDataOk | DashboardPageDataError;

/** ISO timestamp → unix seconds as bigint (the adapter's representation). */
function isoToUnix(iso: string): bigint {
  return BigInt(Math.floor(new Date(iso).getTime() / 1000));
}

/**
 * Load /dashboard.
 *
 * Five independent backend calls, run concurrently. Unlike /vaults these are
 * NOT all-or-nothing: each feeds a different section of the surface, and the
 * canon (F3) is that a group states its own motive. So a per-call failure
 * degrades only its own block — `Promise.allSettled`, and a rejected call
 * becomes an `unavailable` envelope for that block alone.
 *
 * The vault call is the exception: if THAT is unreachable, the page has no
 * top-line figure to show and the whole surface is an honest error.
 */
export async function loadDashboardPageData(): Promise<DashboardPageData> {
  const [vaultR, strategiesR, miningR, elecR, factsheetR] = await Promise.allSettled([
    getVaultFromBackend(),
    getVaultStrategiesFromBackend(),
    getMiningOnchainFromBackend(),
    getMiningElectricityFromBackend(),
    getProductFactsheetFromBackend(),
  ]);

  if (vaultR.status === "rejected") {
    const e: unknown = vaultR.reason;
    const detail = isBackendError(e)
      ? `${e.code}${e.status !== null ? ` ${e.status}` : ""} on ${e.path} (request ${e.requestId})`
      : e instanceof Error
        ? e.message
        : "unknown error";
    logger.error("dashboard: backend vault read failed", { detail });
    return { state: "error", detail };
  }

  const vault = vaultR.value;
  const runtime = vault.data.runtime;

  /** A call that failed transport-side: unavailable for its block only. */
  const unreachable = <T,>(what: string, reason: unknown): WiredFromBackend<T> => {
    logger.warn("dashboard: backend block unreachable", {
      block: what,
      detail: isBackendError(reason) ? `${reason.code} on ${reason.path}` : String(reason),
    });
    return { status: "unavailable", reason: "backend:unreachable" };
  };

  const snapshot = resolvedToWired(vault.data.snapshot, runtime);

  const core: WiredFromBackend<DashboardCore> = selectExposedFromWired(snapshot, (s) =>
    s.totalAssets === null || s.totalShares === null || s.navPerShare === null
      ? null
      : {
          totalAssets: BigInt(s.totalAssets),
          totalShares: BigInt(s.totalShares),
          navPerShare: BigInt(s.navPerShare),
          asset: s.asset,
          assetDecimals: s.assetDecimals,
        },
  );

  const strategies: WiredFromBackend<DashboardStrategy[]> =
    strategiesR.status === "fulfilled"
      ? selectExposedFromWired(
          resolvedToWired(strategiesR.value.data.strategies, strategiesR.value.data.runtime),
          (list) =>
            list.map((s, index) => ({
              index,
              adapter: s.adapter ?? "",
              allocationBps: BigInt(s.targetBps),
              // The backend reports no per-strategy `enabled` flag; a pocket it
              // returns at all is part of the active set. Not inferred from
              // `isIdle` — an idle pocket (B3) is enabled, just undeployed.
              enabled: true,
              isIdle: s.isIdle,
            })),
        )
      : unreachable("strategies", strategiesR.reason);

  const mining: WiredFromBackend<DashboardMining> =
    miningR.status === "fulfilled"
      ? selectExposedFromWired(
          resolvedToWired(miningR.value.data.hashrate, miningR.value.data.runtime),
          // Every field required: a null in ANY of them makes the block
          // unavailable rather than letting one absent field ride along as a
          // zero next to two real measurements.
          (m) =>
            m.reportedHashrateTh === null || m.totalBtcEarnedSats === null || m.lastReportTime === null
              ? null
              : {
                  reportedHashrateTh: BigInt(m.reportedHashrateTh),
                  totalBtcEarnedSats: BigInt(m.totalBtcEarnedSats),
                  lastReportTime: isoToUnix(m.lastReportTime),
                },
        )
      : unreachable("mining", miningR.reason);

  const elec: WiredFromBackend<DashboardElec> =
    elecR.status === "fulfilled"
      ? selectExposedFromWired(
          resolvedToWired(elecR.value.data.electricity, elecR.value.data.runtime),
          // `totalPaid` and `lastPayment` are NOT defaulted to 0. A measured
          // "0 USDC paid so far" and "we do not know what has been paid" are
          // different facts, and the second must not render as the first —
          // that is exactly the NOT_CONFIGURED-to-zero collapse the honesty
          // contract forbids. `lastPayment` is legitimately null when no
          // payment has ever been made, so it is carried as null rather than
          // as the epoch (0 would render as 1 Jan 1970).
          (e) =>
            e.monthlyCost === null || e.totalPaid === null
              ? null
              : {
                  monthlyElecCost: BigInt(e.monthlyCost),
                  elecPayee: e.payee ?? "",
                  totalElecPaid: BigInt(e.totalPaid),
                  lastElecPaymentTime: e.lastPayment === null ? null : isoToUnix(e.lastPayment),
                  canPay: e.canPay ?? false,
                },
        )
      : unreachable("electricity", elecR.reason);

  // `currentMonth` / `isCurtailed` / `miningNoteMode` are engine state. None of
  // the five routes above exposes them, and the vault snapshot only carries
  // `miningNoteMode`. Rather than invent the other two — a fabricated "month 1"
  // would misstate the product's progress — the whole ops block reports itself
  // as not exposed. The dashboard already renders that as one group motive.
  const ops: WiredFromBackend<DashboardOps> = { status: "unavailable", reason: "backend:not_supported" };

  const duration: WiredFromBackend<DashboardDuration> =
    factsheetR.status === "fulfilled"
      ? selectExposedFromWired(
          resolvedToWired(factsheetR.value.data.terms, factsheetR.value.data.runtime),
          (t) => (t.productDurationMonths === null ? null : { months: BigInt(t.productDurationMonths) }),
        )
      : unreachable("factsheet", factsheetR.reason);

  return {
    state: "ok",
    core,
    strategies,
    mining,
    elec,
    ops,
    duration,
    runtimeMode: runtime.mode,
  };
}
