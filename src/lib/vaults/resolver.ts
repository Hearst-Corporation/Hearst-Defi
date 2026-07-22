import "server-only";

import { prisma } from "@/lib/db";
import {
  VAULT_YIELD,
  VAULT_DEFENSIVE,
  VAULT_BTC_PLUS,
  type VaultDefinition,
} from "@/lib/engine/vaults";
import type { VaultId } from "@/lib/engine/types";
import type { VaultRef } from "@/lib/vaults/types";
import { vaultSlug, vaultLabel } from "@/lib/vaults/slug";

// =============================================================================
// Vault resolver — bridges the schism between the `VaultId` engine fixtures
// (yield / defensive / btc-plus, defined in src/lib/engine/vaults.ts) and the
// `VaultDeployment` Prisma rows created by the admin wizard.
//
// Decision: hybrid model (mvp-plus / vault-schema-reconciliation, 2026-05-26).
// - The 3 engine fixtures stay as canonical demo vaults (engine purity, tests,
//   methodology v1.0). Their lookup keys are the `VaultId` enum value AND their
//   ticker (HYV / HDV / HBP).
// - The wizard publishes `VaultDeployment` rows with a unique `ticker` that
//   serves as the URL-safe slug (lowercased for routing).
// - `resolveVault(input)` accepts either a `VaultId`, a fixture ticker, a
//   deployment ticker, or a deployment cuid `id`. Lookup order is:
//     1. VaultId enum match → fixture
//     2. Fixture ticker (case-insensitive) → fixture
//     3. Prisma deployment by ticker (uppercase) OR by cuid id
//     4. null (caller decides 404 vs default)
// =============================================================================

const FIXTURES: readonly VaultDefinition[] = [
  VAULT_YIELD,
  VAULT_DEFENSIVE,
  VAULT_BTC_PLUS,
] as const;

const FIXTURE_BY_ID = new Map<VaultId, VaultDefinition>(
  FIXTURES.map((v) => [v.id, v]),
);

const FIXTURE_BY_TICKER = new Map<string, VaultDefinition>(
  FIXTURES.map((v) => [v.ticker.toUpperCase(), v]),
);

// VaultRef is defined in types.ts (pure, no server-only) and re-exported here
// so existing imports from resolver.ts continue to work without change.
export type { VaultRef };

/** Status filter for {@link listAllVaults}. Defaults to `live` deployments. */
export type DeploymentStatusFilter = "live" | "any" | "live-or-paused";

/**
 * Resolve a vault identifier (engine VaultId, fixture ticker, deployment
 * ticker, or deployment cuid) to a {@link VaultRef}.
 *
 * Returns `null` if no match — caller decides whether to 404 or fall back to a
 * default (typically `VAULT_YIELD`).
 */
export async function resolveVault(input: string): Promise<VaultRef | null> {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // 1. VaultId enum direct match (lowercase known set)
  const lower = trimmed.toLowerCase();
  const byId = FIXTURE_BY_ID.get(lower as VaultId);
  if (byId) return { kind: "fixture", fixture: byId };

  // 2. Fixture ticker match (case-insensitive)
  const byTicker = FIXTURE_BY_TICKER.get(trimmed.toUpperCase());
  if (byTicker) return { kind: "fixture", fixture: byTicker };

  // 3. Prisma deployment — try ticker (uppercased convention) then cuid
  const deployment = await prisma.vaultDeployment.findFirst({
    where: {
      OR: [{ ticker: trimmed.toUpperCase() }, { id: trimmed }],
    },
  });
  if (deployment) return { kind: "deployment", deployment };

  return null;
}

/**
 * Synchronous variant for fixture-only resolution. Use when you know the input
 * cannot be a deployment (e.g. inside the engine, agents, or fixture tests).
 */
export function resolveFixture(input: string): VaultDefinition | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  return (
    FIXTURE_BY_ID.get(trimmed.toLowerCase() as VaultId) ??
    FIXTURE_BY_TICKER.get(trimmed.toUpperCase()) ??
    null
  );
}

/**
 * List every vault visible to the operator: 3 engine fixtures + Prisma
 * deployments matching the status filter. Fixtures come first (stable order
 * yield → defensive → btc-plus), then deployments by `updatedAt desc`.
 *
 * Collision rules: a deployment is hidden if it duplicates a fixture by any
 * of (a) ticker, (b) id matching a `VaultId`, or (c) display name matching
 * a fixture label (case-insensitive, trimmed). This prevents the selector
 * from showing two "Hearst Yield Vault" entries when the wizard publishes
 * a deployment with the canonical name but a different ticker.
 */
export async function listAllVaults(
  options: { status?: DeploymentStatusFilter } = {},
): Promise<VaultRef[]> {
  const { status = "live" } = options;

  const whereStatus =
    status === "any"
      ? undefined
      : status === "live-or-paused"
        ? { status: { in: ["live", "paused"] } }
        : { status: "live" };

  const deployments = await prisma.vaultDeployment.findMany({
    where: whereStatus,
    orderBy: { updatedAt: "desc" },
  });

  const fixtureTickers = new Set(FIXTURE_BY_TICKER.keys());
  const fixtureIds = new Set<string>(FIXTURE_BY_ID.keys());
  const fixtureLabels = new Set([
    ...FIXTURES.map((f) => f.label.trim().toLowerCase()),
    // Historical labels stay collision keys. The presets were renamed to the
    // Series 1 canon ("Hearst Bitcoin Reserve Vault — Series 1", "… (retired
    // configuration)"), but VaultDeployment rows created under the OLD names
    // still exist — without these aliases such a row would stop deduplicating
    // against its fixture and show up twice in every vault list.
    "hearst yield vault",
    "hearst defensive vault",
    "hearst btc plus vault",
  ]);

  const seenDeploymentKeys = new Set<string>();
  const deploymentRefs: VaultRef[] = [];
  for (const d of deployments) {
    const ticker = d.ticker.toUpperCase();
    const nameKey = d.name.trim().toLowerCase();
    if (fixtureTickers.has(ticker)) continue;
    if (fixtureIds.has(d.id.toLowerCase())) continue;
    if (fixtureLabels.has(nameKey)) continue;
    // Stable per-deployment dedup (defense in depth against duplicate rows).
    const dedupKey = `${ticker}::${nameKey}`;
    if (seenDeploymentKeys.has(dedupKey)) continue;
    seenDeploymentKeys.add(dedupKey);
    deploymentRefs.push({ kind: "deployment", deployment: d });
  }

  const fixtureRefs: VaultRef[] = FIXTURES.map((fixture) => ({
    kind: "fixture",
    fixture,
  }));

  return [...fixtureRefs, ...deploymentRefs];
}

// vaultSlug and vaultLabel live in slug.ts (pure, no server-only).
// Re-exported here so existing imports from resolver.ts continue to work.
export { vaultSlug, vaultLabel };
