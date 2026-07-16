// src/lib/chain/vault-mode.ts
//
// CLIENT-SAFE vault MODE + ADDRESS resolution.
//
// Split out of `src/lib/chain/dynavault.ts` (which is `server-only`, speaks
// viem/RPC, and must NEVER reach the browser). The mode/address logic here reads
// ONLY `NEXT_PUBLIC_*` env vars (public, safe in a client bundle) and does NO
// I/O, NO RPC, NO prisma — so a `"use client"` chain (invest-form →
// src/lib/onchain/vault.ts) can read `getVaultMode()` WITHOUT dragging the
// server-only chain adapter into the browser bundle. `dynavault.ts` re-exports
// this surface, so existing server importers keep their `@/lib/chain/dynavault`
// path unchanged.
//
// The only `viem` reference below is a TYPE (`Address`), erased at compile time —
// no viem runtime is pulled into the client.
//
// ── Turbopack trap (see dynavault.ts header) ──────────────────────────────────
// Next/Turbopack only inlines NEXT_PUBLIC_* into the CLIENT bundle when the
// expression is the LITERAL `process.env.NEXT_PUBLIC_FOO`. The module constants
// below read the vars literally; `resolve*(env)` stay env-injected for tests.

import type { Address } from "viem";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Validate + normalise a raw env string into an Address, or null. */
export function normaliseAddress(raw: string | undefined): Address | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return ADDRESS_RE.test(trimmed) ? (trimmed as Address) : null;
}

/**
 * PermissionedDynaVault v2.1 address from an injected env. Exported for unit
 * tests ONLY — runtime code must use `getVaultAddress()` / `getVaultTarget()`,
 * which read the literal `process.env.*` (Turbopack trap).
 *
 * A malformed value returns null (→ fallback to legacy) rather than throwing:
 * this module runs in the browser where a throw would white-screen a page. The
 * loud failure lives server-side in `src/lib/env.ts`, where
 * NEXT_PUBLIC_DYNAVAULT_ADDRESS is Zod-validated at boot.
 */
export function resolveDynavaultAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  return normaliseAddress(env.NEXT_PUBLIC_DYNAVAULT_ADDRESS);
}

/**
 * Legacy HearstYieldVault address from an injected env. Honors the canonical
 * name first, then the historical alias — same precedence as the production gate
 * in `src/lib/env.ts`, so a deployment configured with either name behaves
 * consistently across the whole app.
 */
export function resolveLegacyVaultAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  return (
    normaliseAddress(env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS) ??
    normaliseAddress(env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS)
  );
}

export type WiredSource = "v2" | "legacy";
export type VaultMode = WiredSource | "not_configured";

export type V2Target = { readonly mode: "v2"; readonly address: Address };
export type LegacyTarget = { readonly mode: "legacy"; readonly address: Address };
export type UnconfiguredTarget = {
  readonly mode: "not_configured";
  readonly address: null;
};

/** What this app is pointed at, right now. */
export type VaultTarget = V2Target | LegacyTarget | UnconfiguredTarget;

/** Single source of the mode precedence — used by BOTH the literal module
 *  constants and the env-injected `resolveVaultTarget`, so the two can't drift. */
function targetFrom(v2: Address | null, legacy: Address | null): VaultTarget {
  if (v2 !== null) return { mode: "v2", address: v2 };
  if (legacy !== null) return { mode: "legacy", address: legacy };
  return { mode: "not_configured", address: null };
}

/** Pure, env-injected target resolution. Exported for unit tests. */
export function resolveVaultTarget(
  env: Record<string, string | undefined> = process.env,
): VaultTarget {
  return targetFrom(resolveDynavaultAddress(env), resolveLegacyVaultAddress(env));
}

/**
 * v2 address — LITERAL env read so Turbopack inlines it into the client bundle.
 * Do NOT refactor into `resolveDynavaultAddress(process.env)`: that breaks the
 * inlining and the browser silently loses the address.
 */
export const DYNAVAULT_ADDRESS: Address | null = normaliseAddress(
  process.env.NEXT_PUBLIC_DYNAVAULT_ADDRESS,
);

/** Legacy address — same literal-read rule as above. */
export const LEGACY_VAULT_ADDRESS: Address | null =
  normaliseAddress(process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS) ??
  normaliseAddress(process.env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS);

/**
 * The target resolved once at module init. On the server this reflects the
 * runtime env; in the browser it reflects the env inlined at BUILD time — a
 * newly-deployed contract needs a rebuild, not just a restart.
 */
const MODULE_TARGET: VaultTarget = targetFrom(DYNAVAULT_ADDRESS, LEGACY_VAULT_ADDRESS);

export function getVaultTarget(): VaultTarget {
  return MODULE_TARGET;
}

export function getVaultMode(): VaultMode {
  return MODULE_TARGET.mode;
}

export function getVaultAddress(): Address | null {
  return MODULE_TARGET.address;
}
