/**
 * Unit tests — Prisma provider safety guard (pure decision logic only).
 *
 * No I/O, no real port probe, no client mutation: we test the exported pure
 * helpers that decide whether a generate is safe, plus provider/override
 * resolution. The dangerous path (sqlite while a postgres dev server is live) is
 * exercised purely via `devServerActive: true` — never by actually generating.
 */

import { describe, expect, it } from "vitest";

import {
  evaluateProviderSafety,
  hasIsolationOverride,
  resolveRequestedProvider,
} from "../assert-prisma-provider-safe.mjs";

describe("evaluateProviderSafety", () => {
  it("always allows a postgresql generate (prod/default provider)", () => {
    expect(
      evaluateProviderSafety({
        requested: "postgresql",
        devServerActive: true,
        overrideIsolated: false,
      }).safe,
    ).toBe(true);
  });

  it("REFUSES a sqlite generate while a dev server is live (the clobber case)", () => {
    const r = evaluateProviderSafety({
      requested: "sqlite",
      devServerActive: true,
      overrideIsolated: false,
    });
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/refusing sqlite generate/i);
  });

  it("allows a sqlite generate when no dev server is live", () => {
    expect(
      evaluateProviderSafety({
        requested: "sqlite",
        devServerActive: false,
        overrideIsolated: false,
      }).safe,
    ).toBe(true);
  });

  it("allows a sqlite generate under an isolation override even with a live server", () => {
    expect(
      evaluateProviderSafety({
        requested: "sqlite",
        devServerActive: true,
        overrideIsolated: true,
      }).safe,
    ).toBe(true);
  });

  it("does not gate unknown providers", () => {
    expect(
      evaluateProviderSafety({
        requested: "mysql",
        devServerActive: true,
        overrideIsolated: false,
      }).safe,
    ).toBe(true);
  });
});

describe("resolveRequestedProvider", () => {
  it("prefers an explicit CLI arg", () => {
    expect(resolveRequestedProvider(["node", "x", "sqlite"], {})).toBe("sqlite");
    expect(resolveRequestedProvider(["node", "x", "postgresql"], {})).toBe(
      "postgresql",
    );
  });

  it("falls back to PRISMA_PROVIDER env", () => {
    expect(
      resolveRequestedProvider(["node", "x"], { PRISMA_PROVIDER: "sqlite" }),
    ).toBe("sqlite");
  });

  it("infers postgresql from a postgres DATABASE_URL", () => {
    expect(
      resolveRequestedProvider(["node", "x"], {
        DATABASE_URL: "postgresql://u:p@host/db",
      }),
    ).toBe("postgresql");
  });

  it("defaults to sqlite when nothing points to postgres", () => {
    expect(resolveRequestedProvider(["node", "x"], {})).toBe("sqlite");
    expect(
      resolveRequestedProvider(["node", "x"], {
        DATABASE_URL: "file:./prisma/dev.db",
      }),
    ).toBe("sqlite");
  });
});

describe("hasIsolationOverride", () => {
  it("is true under CI", () => {
    expect(hasIsolationOverride({ CI: "true" })).toBe(true);
  });

  it("is true with PRISMA_SQLITE_ISOLATED=1", () => {
    expect(hasIsolationOverride({ PRISMA_SQLITE_ISOLATED: "1" })).toBe(true);
  });

  it("is false with no override", () => {
    expect(hasIsolationOverride({})).toBe(false);
  });
});
