import { describe, expect, it } from "vitest";

import {
  derivedFrom,
  jsonSafe,
  serializeWired,
  unavailableJson,
  type WiredOk,
} from "@/lib/chain/wired-json";

const ADDRESS = "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
const READ_AT = "2026-07-15T10:00:00.000Z";

function ok<T>(data: T): WiredOk<T> {
  return {
    status: "wired",
    data,
    source: "v2",
    address: ADDRESS,
    chainId: 84532,
    readAt: READ_AT,
  } as WiredOk<T>;
}

describe("jsonSafe", () => {
  it("stringifies bigints without precision loss above 2^53", () => {
    // The whole reason strings are used: Number() would round this.
    const huge = 123456789012345678901234567890n;
    expect(jsonSafe(huge)).toBe("123456789012345678901234567890");
  });

  it("converts bigints nested in objects and arrays", () => {
    const out = jsonSafe({
      totalAssets: 12_000_000n,
      nested: { shares: [1n, 2n] },
      flag: true,
      name: "vault",
    });
    expect(out).toEqual({
      totalAssets: "12000000",
      nested: { shares: ["1", "2"] },
      flag: true,
      name: "vault",
    });
  });

  it("leaves null and undefined alone", () => {
    expect(jsonSafe(null)).toBeNull();
    expect(jsonSafe({ a: null })).toEqual({ a: null });
  });

  it("produces output JSON.stringify accepts", () => {
    // Guards the actual failure mode: NextResponse.json() throws on a bigint.
    expect(() => JSON.stringify({ v: 1n })).toThrow(TypeError);
    expect(() => JSON.stringify(jsonSafe({ v: 1n }))).not.toThrow();
  });

  it("renders Dates as ISO strings rather than {}", () => {
    expect(jsonSafe(new Date(READ_AT))).toBe(READ_AT);
  });
});

describe("serializeWired", () => {
  it("preserves the provenance envelope verbatim", () => {
    const out = serializeWired(ok({ totalAssets: 12_000_000n }));
    expect(out).toEqual({
      status: "wired",
      data: { totalAssets: "12000000" },
      source: "v2",
      address: ADDRESS,
      chainId: 84532,
      readAt: READ_AT,
    });
  });

  it("keeps unavailable unavailable, with its reason and detail", () => {
    const out = serializeWired({
      status: "unavailable",
      reason: "rpc_error",
      detail: "timeout",
    });
    expect(out).toEqual({
      status: "unavailable",
      reason: "rpc_error",
      detail: "timeout",
    });
  });

  it("never fabricates a value for an unavailable read", () => {
    const out = serializeWired<{ totalAssets: bigint }>({
      status: "unavailable",
      reason: "not_deployed",
    });
    expect(out).not.toHaveProperty("data");
    expect(out).not.toHaveProperty("address");
  });

  it("omits detail entirely when absent rather than emitting undefined", () => {
    expect(Object.keys(unavailableJson("revert"))).toEqual([
      "status",
      "reason",
    ]);
  });

  it("distinguishes an outage from an absence of data", () => {
    const outage = serializeWired({ status: "unavailable", reason: "rpc_error" });
    const absent = serializeWired({
      status: "unavailable",
      reason: "not_deployed",
    });
    expect(outage).not.toEqual(absent);
  });
});

describe("derivedFrom", () => {
  it("reuses the source envelope for a computed value", () => {
    expect(derivedFrom(ok(1n), { bps: 5_000 })).toEqual({
      status: "wired",
      data: { bps: 5_000 },
      source: "v2",
      address: ADDRESS,
      chainId: 84532,
      readAt: READ_AT,
    });
  });
});
