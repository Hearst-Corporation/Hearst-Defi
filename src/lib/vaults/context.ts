// src/lib/vaults/context.ts
//
// Server-side vault context helper. Resolves the "current vault" from the
// URL (?vault=<slug>) and/or the pathname (/admin/vaults/[id]).
// Returns a stable VaultContext for vault-scoped admin pages.

import "server-only";

import { listAllVaults, resolveVault } from "@/lib/vaults/resolver";
import type { VaultRef } from "@/lib/vaults/types";
import { vaultSlug } from "@/lib/vaults/slug";

export interface VaultContext {
  /** Currently scoped vault, or null when no vault is in the URL. */
  current: VaultRef | null;
  /** Full vault catalog (fixtures + deployments). */
  all: VaultRef[];
  /**
   * True when the page is explicitly scoped to a vault via:
   *   - `?vault=<slug>` query parameter, OR
   *   - `/admin/vaults/[id]` path segment.
   */
  isVaultScoped: boolean;
}

/** Extract the [id] segment from /admin/vaults/[id]/* paths. */
function extractVaultIdFromPath(pathname: string): string | null {
  const match = /^\/admin\/vaults\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

/**
 * Resolves the current vault context from URL params and pathname.
 *
 * Resolution order:
 *   1. `?vault=` query parameter (slug / ticker / cuid)
 *   2. `/admin/vaults/[id]` path segment
 *   3. null (no vault scope)
 *
 * Always returns all vaults for the switcher (status = "any" so admin can
 * see drafts and paused vaults too).
 */
export async function getCurrentVaultContext(
  searchParams: { vault?: string },
  pathname: string,
): Promise<VaultContext> {
  const all = await listAllVaults({ status: "any" });

  // 1. ?vault= takes priority (explicit user selection)
  const querySlug = searchParams.vault?.trim();
  if (querySlug) {
    const current = await resolveVault(querySlug);
    return { current, all, isVaultScoped: true };
  }

  // 2. /admin/vaults/[id] path scope
  const pathId = extractVaultIdFromPath(pathname);
  if (pathId) {
    const current = await resolveVault(pathId);
    return { current, all, isVaultScoped: true };
  }

  // 3. No vault scope
  return { current: null, all, isVaultScoped: false };
}

// Re-export for consumers that want to derive slugs from context
export { vaultSlug };
