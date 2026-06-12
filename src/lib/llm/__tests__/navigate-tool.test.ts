import { describe, expect, it } from "vitest";

import {
  NAV_DESTINATIONS,
  NAV_KEYS,
  navigateTool,
  resolveNavDestination,
  isProtectedRoute,
} from "@/lib/llm/navigate-tool";

describe("navigate-tool whitelist", () => {
  it("exposes only LP list/landing routes (no admin, no debug, no dynamic id)", () => {
    for (const d of NAV_DESTINATIONS) {
      expect(d.route).not.toMatch(/^\/admin/);
      expect(d.route).not.toMatch(/^\/debug/);
      expect(d.route).not.toContain("[");
    }
    expect(NAV_DESTINATIONS.map((d) => d.route)).toEqual([
      "/portfolio",
      "/vaults",
      "/proof-center",
      "/profile",
    ]);
  });

  it("the tool enum matches the destination keys exactly (model can't invent)", () => {
    expect(navigateTool.function.parameters.properties.destination.enum).toEqual(
      [...NAV_KEYS],
    );
    expect(navigateTool.function.name).toBe("navigate");
  });

  it("resolves a known key and rejects an unknown one", () => {
    expect(resolveNavDestination("portfolio")?.route).toBe("/portfolio");
    expect(resolveNavDestination("admin")).toBeNull();
    expect(resolveNavDestination("/etc/passwd")).toBeNull();
    expect(resolveNavDestination(null)).toBeNull();
    expect(resolveNavDestination(undefined)).toBeNull();
  });

  it("flags in-progress flows as protected (auto-nav must not yank)", () => {
    expect(isProtectedRoute("/vaults/abc123/invest")).toBe(true);
    expect(isProtectedRoute("/vaults/abc123/invest/confirmed")).toBe(true);
    expect(isProtectedRoute("/onboarding")).toBe(true);
    expect(isProtectedRoute("/totp-challenge")).toBe(true);
    expect(isProtectedRoute("/portfolio")).toBe(false);
    expect(isProtectedRoute("/vaults")).toBe(false);
    expect(isProtectedRoute("/vaults/abc123")).toBe(false);
  });
});
