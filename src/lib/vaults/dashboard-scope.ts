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
  return adminFixtureScopedHref("/admin/dashboard", vaultId);
}

/** Scenario Lab URL for an engine fixture vault id. */
export function adminScenarioLabVaultHref(vaultId: string): string {
  return adminFixtureScopedHref("/admin/scenario-lab", vaultId);
}

/** Distributions URL for an engine fixture vault id. */
export function adminDistributionsVaultHref(vaultId: string): string {
  return adminFixtureScopedHref("/admin/distributions", vaultId);
}

/** Rebalancing signals URL for an engine fixture vault id. */
export function adminSignalsVaultHref(vaultId: string): string {
  return adminFixtureScopedHref("/admin/signals", vaultId);
}

/** Resolve `?vault=` to a fixture id (defaults to yield). */
export function resolveFixtureVaultId(raw: string | undefined): VaultId {
  if (raw && isEngineFixtureVaultId(raw)) return raw;
  return "yield";
}

/** Admin pages — alias for `resolveFixtureVaultId` (scenario-lab, investor-memo, …). */
export const resolveAdminVaultId = resolveFixtureVaultId;

/**
 * Append `?vault=` (and optional extra params) to an admin path.
 * Used by section sub-nav and in-page filters so scope is not lost on navigation.
 */
export function withAdminVaultQuery(
  href: string,
  vault: string | null | undefined,
  extra?: Record<string, string | undefined>,
): string {
  const sp = new URLSearchParams();
  if (vault) sp.set("vault", vault);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== "") sp.set(key, value);
    }
  }
  const query = sp.toString();
  return query ? `${href}?${query}` : href;
}

function adminFixtureScopedHref(path: string, vaultId: string): string {
  return vaultId === "yield" ? path : `${path}?vault=${vaultId}`;
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
