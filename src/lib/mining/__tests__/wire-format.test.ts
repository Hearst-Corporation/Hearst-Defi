import { describe, expect, it } from "vitest";

import { jsonSafe, toBigInt } from "@/lib/mining/wire-format";

describe("jsonSafe", () => {
  it("renders bigint as a lossless decimal string instead of throwing", () => {
    // The failure this guards against: JSON.stringify throws on bigint, so an
    // unfiltered chain read would 500 exactly when the chain finally answers.
    expect(() => JSON.stringify({ v: 1n })).toThrow();
    expect(() => JSON.stringify(jsonSafe({ v: 1n }))).not.toThrow();
    expect(jsonSafe({ v: 12_000_000n })).toEqual({ v: "12000000" });
  });

  it("keeps a uint256 beyond Number.MAX_SAFE_INTEGER exact", () => {
    const huge = 2n ** 200n;
    expect(jsonSafe({ v: huge })).toEqual({ v: huge.toString() });
  });

  it("preserves the Wired envelope rather than flattening it", () => {
    // The envelope IS the provenance — flattening it would strip the ability to
    // tell "read at 0x… at 14:03" from "we have no idea".
    const wired = {
      status: "wired",
      data: { totalElecPaid: 5n, elecPayee: "0xfeed" },
      source: "v2",
      address: "0xabc",
      chainId: 84532,
      readAt: "2026-07-15T00:00:00.000Z",
    };

    expect(jsonSafe(wired)).toEqual({
      status: "wired",
      data: { totalElecPaid: "5", elecPayee: "0xfeed" },
      source: "v2",
      address: "0xabc",
      chainId: 84532,
      readAt: "2026-07-15T00:00:00.000Z",
    });
  });

  it("keeps an unavailable reason intact", () => {
    expect(
      jsonSafe({ status: "unavailable", reason: "not_supported_by_legacy" }),
    ).toEqual({ status: "unavailable", reason: "not_supported_by_legacy" });
  });

  it("drops undefined keys and keeps null", () => {
    expect(jsonSafe({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
  });

  it("blanks a non-finite number rather than inventing a finite one", () => {
    expect(jsonSafe({ v: Number.POSITIVE_INFINITY })).toEqual({ v: null });
    expect(jsonSafe({ v: Number.NaN })).toEqual({ v: null });
  });

  it("walks arrays and nesting", () => {
    expect(jsonSafe({ xs: [1n, { y: 2n }] })).toEqual({
      xs: ["1", { y: "2" }],
    });
  });
});

describe("toBigInt", () => {
  it("accepts bigint and decimal strings — either adapter choice works", () => {
    expect(toBigInt(42n)).toBe(42n);
    expect(toBigInt("42")).toBe(42n);
    expect(toBigInt("  42  ")).toBe(42n);
    expect(toBigInt(0n)).toBe(0n);
    expect(toBigInt(7)).toBe(7n);
  });

  it("rejects anything that is not a whole non-negative number", () => {
    // A uint256 can never legitimately be any of these. Returning null makes the
    // route emit an explicit decode_error instead of a NaN countdown.
    expect(toBigInt(1.5)).toBeNull();
    expect(toBigInt("1.5")).toBeNull();
    expect(toBigInt("-1")).toBeNull();
    expect(toBigInt("")).toBeNull();
    expect(toBigInt("abc")).toBeNull();
    expect(toBigInt(null)).toBeNull();
    expect(toBigInt(undefined)).toBeNull();
    expect(toBigInt({})).toBeNull();
    expect(toBigInt(Number.NaN)).toBeNull();
  });
});
