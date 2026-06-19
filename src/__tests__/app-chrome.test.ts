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
// /apply renders standalone: the qualification chamber carries its own inline
// assistant panel (ApplyAssistantPanel), so it must NOT get the Cockpit chat
// rail. /legal/* uses its own LegalLayout.
const BARE_PREFIXES = ["/legal", "/apply"] as const;

function isBareRoute(pathname: string): boolean {
  if (BARE_EXACT.has(pathname)) return true;
  return BARE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Bare routes that still carry the full institutional footer (replicated from
// src/components/app-chrome.tsx — private helper): home/login "/" + /legal/*.
function isFooterBareRoute(pathname: string): boolean {
  return (
    pathname === "/" || pathname === "/legal" || pathname.startsWith("/legal/")
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
    "/apply",             // qualification funnel — standalone, own assistant panel
    "/apply/confirmed",
    "/apply/anything/else",
  ])("renders bare for %s", (path) => {
    expect(isBareRoute(path)).toBe(true);
  });
});

describe("isBareRoute — routes that render WITH the Cockpit shell", () => {
  it.each([
    "/portfolio",
    "/portfolio/abc",
    "/admin/dashboard",
    "/vaults",
    "/vaults/eth-yield",
    "/profile",
    "/proof-center",
    "/debug/module-layout",
  ])("renders with shell for %s", (path) => {
    expect(isBareRoute(path)).toBe(false);
  });
});

describe("isBareRoute — near-miss paths must NOT be bare", () => {
  it.each([
    "/legal-other",         // not a /legal/* sub-path
    "/legally-binding",     // prefix 'legal' but not '/legal/'
    "/login-redirect",      // starts with 'login' but is NOT '/login' exactly
    "/loginn",              // not '/login' exactly
    "//",                   // double-slash is not '/'
    "/apply-other",         // not a /apply/* sub-path
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

describe("isBareRoute — exact vs sub-path semantics for /apply", () => {
  it("treats /apply exactly as bare", () => {
    expect(isBareRoute("/apply")).toBe(true);
  });

  it("treats /apply/anything as bare", () => {
    expect(isBareRoute("/apply/confirmed")).toBe(true);
  });

  it("does NOT treat /apply-other as bare (not a sub-path)", () => {
    expect(isBareRoute("/apply-other")).toBe(false);
  });
});

describe("isFooterBareRoute — bare routes that carry the full footer", () => {
  it.each(["/", "/legal", "/legal/privacy", "/legal/terms", "/legal/disclaimer"])(
    "shows the full footer on %s",
    (path) => {
      expect(isFooterBareRoute(path)).toBe(true);
    },
  );

  it.each([
    "/login",
    "/forgot-password",
    "/reset-password",
    "/totp-challenge",
    "/apply",
    "/apply/confirmed",
    "/legal-other",
  ])("does NOT show the full footer on %s", (path) => {
    expect(isFooterBareRoute(path)).toBe(false);
  });
});
