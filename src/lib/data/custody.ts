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

/**
 * Provenance of a custody snapshot.
 *
 * Widens `CustodyProvenance` ("live" | "manual") with a third, non-value-bearing
 * state. The aggregate module's vocabulary describes how a MEASURED balance was
 * obtained; "unavailable" describes the case where nothing was measured at all,
 * so it belongs here at the I/O boundary rather than in the pure math module.
 */
export type CustodySnapshotProvenance = CustodyProvenance | "unavailable";

export interface CustodySnapshot {
  provenance: CustodySnapshotProvenance;
  /** True when FIREBLOCKS_VAULT_ACCOUNT_IDS pins the reserve scope. */
  configured: boolean;
  /**
   * When the reserves were actually observed. `null` when nothing was observed
   * — never a timestamp minted at the moment of failure, which would date a
   * reading that never happened.
   */
  asOf: string | null;
  accountsCount: number | null;
  /**
   * Measured USDC reserves, or `null` when unmeasured. `0` is a REAL reading
   * ("the vault is empty"); the absence of a reading must not borrow it.
   */
  totalUsdcReserves: number | null;
  accounts: CustodyAccountBalance[];
}

/**
 * Fireblocks is not wired up (no API key / secret / base path).
 *
 * A legitimate, honest absence: there is nothing to read because nothing was
 * ever connected. Distinct from `custodyUnavailable()` below — an operator
 * seeing this needs to provision credentials, not investigate an incident.
 */
function custodyNotConfigured(): CustodySnapshot {
  return {
    provenance: "manual",
    configured: false,
    asOf: null,
    accountsCount: null,
    totalUsdcReserves: null,
    accounts: [],
  };
}

/**
 * The Fireblocks read was ATTEMPTED and failed (timeout, 5xx, SDK import
 * error, bad credentials…).
 *
 * The trap this avoids: the previous fallback returned `totalUsdcReserves: 0`
 * stamped `asOf: new Date()`, which turned "we could not reach the custodian"
 * into the far stronger — and false — claim "the vault holds 0 USDC, verified
 * just now". A Proof-of-Reserves surface asserting zero reserves it never
 * measured is the exact failure mode this data layer exists to prevent, so an
 * outage carries no figures and no timestamp at all.
 */
function custodyUnavailable(): CustodySnapshot {
  return {
    provenance: "unavailable",
    configured: false,
    asOf: null,
    accountsCount: null,
    totalUsdcReserves: null,
    accounts: [],
  };
}

/**
 * Live Proof-of-Reserves from Fireblocks via a read-only Viewer key. Never
 * throws, so the Proof Center keeps rendering — but the two ways of having no
 * figures stay DISTINCT in the returned snapshot:
 *
 *   • not configured → `provenance: "manual"`, all figures `null`
 *   • upstream failure → `provenance: "unavailable"`, all figures `null`
 *
 * Callers must branch on `totalUsdcReserves == null` before treating reserves
 * as a number: a null is "we have no reading", never "the vault is empty".
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
  if (!apiKey || !secretKey || !basePath) return custodyNotConfigured();

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

    const { accounts, totalUsdcReserves } = aggregateCustody(raw, { accountIds });

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
      accounts,
    };
  } catch {
    // The call was made and did not come back. Report the outage as such —
    // degrading to a zeroed, freshly-timestamped snapshot here would publish a
    // reserve figure nobody ever read.
    return custodyUnavailable();
  }
}
