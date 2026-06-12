/**
 * Vault scope helpers for `/admin/dashboard` — pure, no I/O.
 * Single source for fixture pills and dashboard deep-links (ADR-006).
 */

import type { VaultId } from "@/lib/engine/types";
import { VAULT_BTC_PLUS, VAULT_DEFENSIVE, VAULT_YIELD, type VaultDefinition } from "@/lib/engine/vaults";

/** Stable fixture order for dashboard scope pills (yield → defensive → btc-plus). */
export const DASHBOARD_FIXTURE_VAULTS: readonly VaultDefinition[] = [
  VAULT_YIELD,
  VAULT_DEFENSIVE,
  VAULT_BTC_PLUS,
] as const;

const ENGINE_FIXTURE_IDS = new Set<string>(["yield", "defensive", "btc-plus"]);

export function isEngineFixtureVaultId(id: string): id is VaultId {
  return ENGINE_FIXTURE_IDS.has(id);
}

/** Dashboard URL for an engine fixture vault id. */
export function adminDashboardVaultHref(vaultId: string): string {
  return vaultId === "yield" ? "/admin/dashboard" : `/admin/dashboard?vault=${vaultId}`;
}

/** Scenario Lab URL for an engine fixture vault id. */
export function adminScenarioLabVaultHref(vaultId: string): string {
  return vaultId === "yield"
    ? "/admin/scenario-lab"
    : `/admin/scenario-lab?vault=${vaultId}`;
}

/**
 * Admin href for a vault ref slug (fixtures → dashboard scope, deployments → vault detail).
 * Mirrors `src/app/admin/distributions/page.tsx` vault column links.
 */
export function adminVaultHrefFromSlug(slug: string): string {
  return isEngineFixtureVaultId(slug)
    ? adminDashboardVaultHref(slug)
    : `/admin/vaults/${slug}`;
}
