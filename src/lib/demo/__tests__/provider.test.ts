import { describe, expect, it } from "vitest";

import { canRunDemoProvider } from "../guard";
import { DEMO_INVESTOR_EMAIL, isDemoInvestor } from "../provider";

describe("canRunDemoProvider — fail-closed", () => {
  it("production + flag on → false", () => {
    expect(canRunDemoProvider("production", "1")).toBe(false);
  });

  it("production + flag off → false", () => {
    expect(canRunDemoProvider("production", undefined)).toBe(false);
  });

  it("development + flag off → false", () => {
    expect(canRunDemoProvider("development", undefined)).toBe(false);
  });

  it("test + flag off → false", () => {
    expect(canRunDemoProvider("test", undefined)).toBe(false);
  });

  it("development + flag on → true", () => {
    expect(canRunDemoProvider("development", "1")).toBe(true);
  });

  it("test + flag on → true", () => {
    expect(canRunDemoProvider("test", "1")).toBe(true);
  });

  it("empty/missing env + flag on → false (fail-closed)", () => {
    // Passing `undefined` would re-trigger the `= process.env.NODE_ENV` default,
    // so we exercise the falsy-env branch with "" — the same `!nodeEnv` guard
    // that catches a genuinely-unset NODE_ENV at runtime.
    expect(canRunDemoProvider("", "1")).toBe(false);
  });

  it("flag other than '1' → false", () => {
    expect(canRunDemoProvider("development", "true")).toBe(false);
    expect(canRunDemoProvider("development", "0")).toBe(false);
  });
});

describe("isDemoInvestor", () => {
  const demo = { email: DEMO_INVESTOR_EMAIL };
  const real = { email: "investor@example.com" };

  it("guard disabled → false even for demo identity", () => {
    expect(isDemoInvestor(demo, false)).toBe(false);
  });

  it("enabled + non-demo investor → false", () => {
    expect(isDemoInvestor(real, true)).toBe(false);
  });

  it("enabled + demo investor → true", () => {
    expect(isDemoInvestor(demo, true)).toBe(true);
  });

  it("null investor → false", () => {
    expect(isDemoInvestor(null, true)).toBe(false);
  });

  it("undefined investor → false", () => {
    expect(isDemoInvestor(undefined, true)).toBe(false);
  });

  it("investor with null email → false", () => {
    expect(isDemoInvestor({ email: null }, true)).toBe(false);
  });
});
