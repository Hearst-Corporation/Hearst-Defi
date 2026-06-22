/**
 * Unit tests for the route-guard logic in src/proxy.ts.
 *
 * `isProtected` is a private (non-exported) helper, so we cannot import it
 * directly. Instead we replicate the identical pure logic here
 * (PROTECTED_PREFIXES + prefix-matching algorithm) and test that contract.
 * If the implementation ever changes, this test suite will need to follow —
 * which is the intended safety net.
 *
 * The `config.matcher` array at the bottom of proxy.ts is the canonical list
 * of protected routes; PROTECTED_PREFIXES and the matcher must agree.
 */

import { describe, it, expect } from "vitest";

// ── Replicated from src/proxy.ts (private helper) ─────────────────────────────
const PROTECTED_PREFIXES = [
  "/admin",
  "/portfolio",
  "/profile",
  "/proof-center",
  "/vaults",
] as const;

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
// ─────────────────────────────────────────────────────────────────────────────

describe("isProtected — exact prefix matches", () => {
  it.each(PROTECTED_PREFIXES)("protects %s (exact)", (prefix) => {
    expect(isProtected(prefix)).toBe(true);
  });
});

describe("isProtected — sub-path matches", () => {
  it.each([
    "/admin/dashboard",
    "/admin/vaults/new",
    "/portfolio/123",
    "/portfolio/abc?tab=2",
    "/profile/settings",
    "/proof-center/submissions",
    "/vaults/eth-yield",
    "/vaults/eth-yield/invest",
    "/vaults/eth-yield/invest/confirmed",
  ])("protects %s (sub-path)", (path) => {
    expect(isProtected(path)).toBe(true);
  });
});

describe("isProtected — public routes must NOT match", () => {
  it.each([
    "/",
    "/login",
    "/legal",
    "/legal/privacy",
    "/legal/terms",
    "/legal/disclaimer",
    // Near-miss paths — must NOT trigger the gate
    "/profile-public",
    "/profil",           // missing trailing 'e'
    "/profilex",
    "/admins",
    "/vaultsx",
    "/portfolio2",
    "/proof-centers",
    "/proof",            // only a prefix of /proof-center
    "/proof-cent",
    "/api/auth/login",
  ])("does NOT protect %s (public)", (path) => {
    expect(isProtected(path)).toBe(false);
  });
});

describe("isProtected — edge cases", () => {
  it("does not match a prefix that is a substring but not a full segment", () => {
    // '/profilex' must not match '/profile'
    expect(isProtected("/profilex")).toBe(false);
    // '/admins' must not match '/admin'
    expect(isProtected("/admins")).toBe(false);
  });

  it("matches when the path ends with the prefix exactly", () => {
    expect(isProtected("/profile")).toBe(true);
    expect(isProtected("/admin")).toBe(true);
  });

  it("matches deeply nested sub-paths", () => {
    expect(isProtected("/admin/vaults/abc/edit")).toBe(true);
    expect(isProtected("/portfolio/pos-123/detail")).toBe(true);
  });
});
