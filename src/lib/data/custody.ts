import "server-only";

import { readFileSync } from "node:fs";

import { env } from "@/lib/env";
import {
  aggregateCustody,
  type CustodyAccountBalance,
  type CustodyProvenance,
  type RawCustodyAccount,
} from "@/lib/data/custody-aggregate";

/**
 * Resolve the Fireblocks PEM secret key.
 *
 * Priority:
 *   1. FIREBLOCKS_SECRET_KEY — inline PEM content. Required for Vercel/serverless
 *      where a file path is not deployable.
 *   2. FIREBLOCKS_SECRET_KEY_PATH — local file path. Works in development but
 *      cannot be used on Vercel. Kept for backwards compat.
 *
 * Returns null when neither is configured.
 */
function resolveFireblocksSecretKey(): string | null {
  if (env.FIREBLOCKS_SECRET_KEY) return env.FIREBLOCKS_SECRET_KEY;
  if (env.FIREBLOCKS_SECRET_KEY_PATH) {
    try {
      return readFileSync(env.FIREBLOCKS_SECRET_KEY_PATH, "utf8");
    } catch {
      return null;
    }
  }
  return null;
}

export interface CustodySnapshot {
  provenance: CustodyProvenance;
  /** True when FIREBLOCKS_VAULT_ACCOUNT_IDS pins the reserve scope. */
  configured: boolean;
  asOf: string;
  accountsCount: number;
  totalUsdcReserves: number;
  /** BTC-family reserve total — same live Fireblocks feed as totalUsdcReserves. */
  totalBtcReserves: number;
  accounts: CustodyAccountBalance[];
}

function manualFallback(): CustodySnapshot {
  return {
    provenance: "manual",
    configured: false,
    asOf: new Date().toISOString(),
    accountsCount: 0,
    totalUsdcReserves: 0,
    totalBtcReserves: 0,
    accounts: [],
  };
}

/**
 * Live Proof-of-Reserves from Fireblocks via a read-only Viewer key. Never
 * throws — missing config or any upstream failure degrades to a `manual`
 * snapshot so the Proof Center keeps rendering.
 *
 * The reserve scope is pinned by `FIREBLOCKS_VAULT_ACCOUNT_IDS` (comma-separated
 * vault account ids). When unset, every account is returned with
 * `configured: false` so the consumer can flag the scope as not yet pinned.
 *
 */
export async function loadCustody(): Promise<CustodySnapshot> {
  const apiKey = env.FIREBLOCKS_API_KEY;
  const basePath = env.FIREBLOCKS_BASE_URL;
  const secretKey = resolveFireblocksSecretKey();
  if (!apiKey || !secretKey || !basePath) return manualFallback();

  try {
    // Dynamic import: @fireblocks/ts-sdk@19 has a static `require('uuid')`
    // that breaks on Vercel because uuid@14 is ESM-only (ERR_REQUIRE_ESM).
    // Loading lazily inside the try/catch lets the failure degrade to the
    // manual fallback instead of crashing the route at module-eval time.
    const { Fireblocks } = await import("@fireblocks/ts-sdk");
    const fb = new Fireblocks({ apiKey, secretKey, basePath });
    const res = await fb.vaults.getPagedVaultAccounts({ limit: 200 });

    const raw: RawCustodyAccount[] = (res.data?.accounts ?? []).map((a) => ({
      id: String(a.id ?? ""),
      name: a.name ?? "",
      assets: (a.assets ?? []).map((x) => ({
        id: String(x.id ?? ""),
        total: Number(x.total ?? 0),
      })),
    }));

    const accountIds = (env.FIREBLOCKS_VAULT_ACCOUNT_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { accounts, totalUsdcReserves, totalBtcReserves } = aggregateCustody(raw, {
      accountIds,
    });

    // Honesty guard (P1-7): an `attested` PoR requires BOTH a live signed
    // attestation AND non-zero reserves. Fireblocks may answer "live" while
    // the vault sits empty — that is a *pending* state, not an attested one.
    // The `por-summary` component upgrades to `attested` only when the
    // snapshot is `provenance: "live" && configured`; by downgrading both
    // when reserves are zero we keep the public truth: empty vault, no
    // attestation. Keeps `live`-as-source semantics elsewhere because the
    // upstream Fireblocks call DID succeed.
    const hasFunds = totalUsdcReserves > 0;
    const scopePinned = accountIds.length > 0;

    return {
      provenance: hasFunds ? "live" : "manual",
      configured: scopePinned && hasFunds,
      asOf: new Date().toISOString(),
      accountsCount: accounts.length,
      totalUsdcReserves,
      totalBtcReserves,
      accounts,
    };
  } catch {
    return manualFallback();
  }
}
