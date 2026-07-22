// /vaults — the server-side loader.
//
// Reads the vault's state from hearst-connect-backend (independent repository)
// over HTTP, NOT from the frontend's own `src/lib/chain/dynavault.ts`. That
// adapter remains in the tree for the client-side wallet-signing flows
// (deposit/redeem), which are legitimately front-end concerns; every READ of a
// business fact now has exactly one source, and it is the backend.
//
// ── The three states this loader can return, and why they are three ─────────
//
//   "ok"             the backend answered; each field carries its own honesty
//                    envelope, so a page can render live figures next to
//                    honestly-absent ones in the same band.
//   "not_available"  the backend answered, but says the fact is not there yet
//                    (NOT_CONFIGURED / NOT_SUPPORTED / UNAVAILABLE per field).
//                    "There is honestly nothing there yet."
//   "error"          the request never came back — network, 5xx, timeout, or a
//                    missing/invalid signing key (a hard 401). "We couldn't
//                    reach the data."
//
// The last two must NEVER be collapsed. An investor reading "not configured
// yet" learns something true about the product; an investor reading it during
// an outage has been lied to. That is why the BackendError is caught HERE and
// turned into an explicit `error` state rather than being allowed to hit the
// segment error boundary (which would blank the whole page, losing the
// distinction) — and why it is never turned into a fixture or a zero.

import "server-only";

import {
  getProductFactsheetFromBackend,
  getVaultFromBackend,
  getVaultStrategiesFromBackend,
  isBackendError,
  type Envelope,
  type FactsheetTerms,
  type VaultDTO,
  type VaultStrategiesDTO,
  type VaultSnapshot,
  type VaultCapacityBlock,
  type VaultStrategy,
} from "@/lib/backend";
import { resolvedToWired, type WiredFromBackend } from "@/lib/backend/resolved-view";
import { logger } from "@/lib/logger";

export interface VaultPageDataOk {
  readonly state: "ok";
  readonly snapshot: WiredFromBackend<VaultSnapshot>;
  readonly capacity: WiredFromBackend<VaultCapacityBlock>;
  readonly strategies: WiredFromBackend<readonly VaultStrategy[]>;
  /** Product terms (duration, minimum deposit, curtailment thresholds) as the
   *  BACKEND reports them. The page used to print "24 months" / "$250k" as
   *  literals; those are product facts with a source, and this is it. */
  readonly terms: WiredFromBackend<FactsheetTerms>;
  /** Contract identity as reported by the backend — what actually answered. */
  readonly runtime: VaultDTO["runtime"];
  /** Composite, worst-field-first. Reported as-is; never upgraded. */
  readonly compositeStatus: string;
}

export interface VaultPageDataError {
  readonly state: "error";
  /** Operator-facing detail for the page's error block. Carries no secret. */
  readonly detail: string;
}

export type VaultPageData = VaultPageDataOk | VaultPageDataError;

/**
 * Load /vaults.
 *
 * The vault snapshot and the strategies are read together: a failure of EITHER
 * is a failure of the read path, not a partial success — if the snapshot is
 * unreachable, showing the pockets alone would imply the rest is merely
 * "absent". `Promise.all` rejects on the first, which is the honest outcome.
 *
 * The factsheet is deliberately NOT in that group. It carries the product's
 * written terms (duration, minimum ticket), which are a different kind of fact
 * from the vault's live state: losing them should grey out two KPI cells, not
 * blank the page. So it settles separately and degrades to an `unavailable`
 * envelope carrying its own motive.
 */
export async function loadVaultPageData(): Promise<VaultPageData> {
  try {
    const [vaultAndStrategies, factsheetResult] = await Promise.all([
      Promise.all([getVaultFromBackend(), getVaultStrategiesFromBackend()]) as Promise<
        [Envelope<VaultDTO>, Envelope<VaultStrategiesDTO>]
      >,
      getProductFactsheetFromBackend().then(
        (ok) => ({ ok: true as const, value: ok }),
        (err: unknown) => ({ ok: false as const, error: err }),
      ),
    ]);

    const [vault, strategies] = vaultAndStrategies;
    const runtime = vault.data.runtime;

    const terms: WiredFromBackend<FactsheetTerms> = factsheetResult.ok
      ? resolvedToWired(factsheetResult.value.data.terms, factsheetResult.value.data.runtime)
      : (logger.warn("vaults: factsheet unreachable", {
          detail: isBackendError(factsheetResult.error)
            ? `${factsheetResult.error.code} on ${factsheetResult.error.path}`
            : String(factsheetResult.error),
        }),
        { status: "unavailable", reason: "backend:unreachable" });

    return {
      state: "ok",
      snapshot: resolvedToWired(vault.data.snapshot, runtime),
      capacity: resolvedToWired(vault.data.capacity, runtime),
      strategies: resolvedToWired(strategies.data.strategies, strategies.data.runtime),
      terms,
      runtime,
      compositeStatus: vault.meta.status,
    };
  } catch (e) {
    // An unreachable backend is an ERROR, never an absence. Logged with the
    // request id for correlation; the page shows a generic "couldn't reach"
    // block. No fixture, no zero, no cached guess.
    const detail = isBackendError(e)
      ? `${e.code}${e.status !== null ? ` ${e.status}` : ""} on ${e.path} (request ${e.requestId})`
      : e instanceof Error
        ? e.message
        : "unknown error";

    logger.error("vaults: backend read failed", { detail });
    return { state: "error", detail };
  }
}
