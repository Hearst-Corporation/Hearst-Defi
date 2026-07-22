// /vaults/[id] — the server-side loader.
//
// Closes the last split-truth on this page: NAV/AUM and product terms now
// come from hearst-connect-backend (the same contracts /vaults reads), so the
// figure an investor sees here can no longer diverge from the one on the
// overview page. The VaultDeployment row is still read — but only for the
// contractual facts the backend does not serve per vault (status, share
// class, soft lock-up, SPV/exemption, fees, capacity, target pockets). Those
// are legal/config facts of the deployment record, not chain-derived
// business figures.
//
// Same three-state discipline as vaults/_data/vault-loader.ts: "ok" /
// "not_available" / "error" — an outage is never rendered as absence.

import "server-only";

import {
  getProductFactsheetFromBackend,
  getVaultFromBackend,
  isBackendError,
  type FactsheetTerms,
  type VaultSnapshot,
} from "@/lib/backend";
import { resolvedToWired, type WiredFromBackend } from "@/lib/backend/resolved-view";
import { getVault, type VaultProduct } from "@/lib/data/vaults";
import { logger } from "@/lib/logger";

export interface VaultDetailBackendOk {
  readonly state: "ok";
  readonly snapshot: WiredFromBackend<VaultSnapshot>;
  readonly terms: WiredFromBackend<FactsheetTerms>;
}

export interface VaultDetailBackendError {
  readonly state: "error";
  readonly message: string;
}

export type VaultDetailBackendData = VaultDetailBackendOk | VaultDetailBackendError;

export interface VaultDetailData {
  /** The deployment row — contractual/config facts only. Null → 404. */
  readonly vault: VaultProduct | null;
  /** Live business figures from the backend, with per-field honesty. */
  readonly backend: VaultDetailBackendData;
}

export async function loadVaultDetail(id: string): Promise<VaultDetailData> {
  const [vault, backend] = await Promise.all([getVault(id), loadBackendBlocks()]);
  return { vault, backend };
}

async function loadBackendBlocks(): Promise<VaultDetailBackendData> {
  try {
    const [vaultEnvelope, factsheetEnvelope] = await Promise.all([
      getVaultFromBackend(),
      getProductFactsheetFromBackend(),
    ]);
    return {
      state: "ok",
      snapshot: resolvedToWired(vaultEnvelope.data.snapshot, vaultEnvelope.data.runtime),
      terms: resolvedToWired(factsheetEnvelope.data.terms, factsheetEnvelope.data.runtime),
    };
  } catch (err) {
    // Outage ≠ absence: surfaced as an explicit error state, never collapsed
    // into "not configured" and never replaced by the DB aggregate alone.
    logger.error("vault-detail backend read failed", {
      error: isBackendError(err) ? err.message : String(err),
    });
    return {
      state: "error",
      message: "Live vault data could not be reached. Contractual terms below are unaffected.",
    };
  }
}
