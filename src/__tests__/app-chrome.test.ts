/**
 * Unit tests for the bare-route detection logic in src/components/app-chrome.tsx.
 *
 * `isBareRoute` is a private (non-exported) helper. We replicate the identical
 * pure logic here to test the contract: which paths render WITHOUT the Cockpit
 * shell (bare) vs. which paths wrap children in the full shell.
 *
 * If BARE_EXACT or BARE_PREFIXES change in the source, this test must follow.
 */

import { describe, it, expect } from "vitest";

// ── Replicated from src/components/app-chrome.tsx (private helper) ────────────
const BARE_EXACT = new Set<string>([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/totp-challenge",
]);
const BARE_PREFIXES = ["/legal"] as const;
const CHAT_ONLY_PREFIXES = ["/apply"] as const;

function isBareRoute(pathname: string): boolean {
  if (BARE_EXACT.has(pathname)) return true;
  return BARE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isChatOnlyRoute(pathname: string): boolean {
  return CHAT_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
// ─────────────────────────────────────────────────────────────────────────────

describe("isBareRoute — routes that render WITHOUT the Cockpit shell", () => {
  it.each([
    "/",          // login/home screen
    "/login",     // sign-in form
    "/forgot-password",
    "/reset-password",
    "/totp-challenge",
    "/legal",     // legal index — exact match
    "/legal/privacy",
    "/legal/terms",
    "/legal/disclaimer",
  ])("renders bare for %s", (path) => {
    expect(isBareRoute(path)).toBe(true);
  });
});

describe("isBareRoute — routes that render WITH the Cockpit shell", () => {
  it.each([
    "/portfolio",
    "/portfolio/abc",
    "/admin/dashboard",
    "/apply",
    "/apply/confirmed",
    "/vaults",
    "/vaults/eth-yield",
    "/profile",
    "/proof-center",
    "/debug/module-layout",
  ])("renders with shell for %s", (path) => {
    expect(isBareRoute(path)).toBe(false);
  });
});

describe("isChatOnlyRoute — routes that keep assistant without launcher", () => {
  it.each([
    "/apply",
    "/apply/confirmed",
    "/apply/anything/else",
  ])("is chat-only for %s", (path) => {
    expect(isChatOnlyRoute(path)).toBe(true);
    expect(isBareRoute(path)).toBe(false);
  });

  it.each([
    "/",
    "/login",
    "/legal/privacy",
    "/portfolio",
    "/apply-other",
  ])("is NOT chat-only for %s", (path) => {
    expect(isChatOnlyRoute(path)).toBe(false);
  });
});

describe("isBareRoute — near-miss paths must NOT be bare", () => {
  it.each([
    "/legal-other",         // not a /legal/* sub-path
    "/legally-binding",     // prefix 'legal' but not '/legal/'
    "/login-redirect",      // starts with 'login' but is NOT '/login' exactly
    "/loginn",              // not '/login' exactly
    "//",                   // double-slash is not '/'
  ])("is NOT bare for %s", (path) => {
    expect(isBareRoute(path)).toBe(false);
  });
});

describe("isBareRoute — exact vs sub-path semantics for /legal", () => {
  it("treats /legal exactly as bare", () => {
    expect(isBareRoute("/legal")).toBe(true);
  });

  it("treats /legal/anything as bare", () => {
    expect(isBareRoute("/legal/foo/bar")).toBe(true);
  });

  it("does NOT treat /legal-other as bare (not a sub-path)", () => {
    expect(isBareRoute("/legal-other")).toBe(false);
  });
});
