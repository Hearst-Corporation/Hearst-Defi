import { afterEach, describe, expect, it } from "vitest";

import {
  getEventLoggerAddress,
  getPoRRegistryAddress,
  isChainConfigured,
  isPlaceholderTxHash,
} from "@/lib/chain/client";

const ORIG_EVENT = process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS;
const ORIG_POR = process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS;

afterEach(() => {
  process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS = ORIG_EVENT;
  process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS = ORIG_POR;
});

describe("chain client address resolution", () => {
  it("uses env override for event logger when provided", () => {
    process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS =
      "0x1111111111111111111111111111111111111111";

    expect(getEventLoggerAddress()).toBe(
      "0x1111111111111111111111111111111111111111",
    );
  });

  it("uses env override for por registry when provided", () => {
    process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS =
      "0x2222222222222222222222222222222222222222";

    expect(getPoRRegistryAddress()).toBe(
      "0x2222222222222222222222222222222222222222",
    );
  });

  it("returns null for event logger when env is absent (no registry fallback)", () => {
    delete process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS;
    delete process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS;

    expect(getEventLoggerAddress()).toBeNull();
    expect(getPoRRegistryAddress()).toBeNull();
  });

  it("throws on malformed env address (no silent fallback)", () => {
    process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS = "not-an-address";

    expect(() => getEventLoggerAddress()).toThrow(
      /Invalid EVM address in environment/,
    );
  });

  it("reports chain NOT configured when both env vars are absent", () => {
    delete process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS;
    delete process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS;

    expect(isChainConfigured()).toBe(false);
  });

  it("reports chain configured when both env vars are set to valid addresses", () => {
    process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS =
      "0x1111111111111111111111111111111111111111";
    process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS =
      "0x2222222222222222222222222222222222222222";

    expect(isChainConfigured()).toBe(true);
  });

  it("reports chain NOT configured when only one env var is set", () => {
    process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS =
      "0x1111111111111111111111111111111111111111";
    delete process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS;

    expect(isChainConfigured()).toBe(false);
  });
});

describe("isPlaceholderTxHash — D4/D8 no dead BaseScan links", () => {
  it("flags null/empty as placeholder (no link)", () => {
    expect(isPlaceholderTxHash(null)).toBe(true);
    expect(isPlaceholderTxHash(undefined)).toBe(true);
    expect(isPlaceholderTxHash("")).toBe(true);
  });

  it("flags fabricated demo (0xfeed…) and seed (0x5eed…) sentinels", () => {
    expect(
      isPlaceholderTxHash("0xfeed000000000000000000000000000000000000000000000000000000000001"),
    ).toBe(true);
    expect(
      isPlaceholderTxHash("0x5eed00000000000000000000000000000000000000000000000000000000f002"),
    ).toBe(true);
    // case-insensitive
    expect(
      isPlaceholderTxHash("0xFEED000000000000000000000000000000000000000000000000000000000001"),
    ).toBe(true);
  });

  it("flags fabricated mock-attestation (0xmock…) sentinels (B4 convention)", () => {
    expect(
      isPlaceholderTxHash("0xMOCK_abc0000000000000000000000000000000000000000000000000000001"),
    ).toBe(true);
    // lowercase variant
    expect(
      isPlaceholderTxHash("0xmock_abc0000000000000000000000000000000000000000000000000000001"),
    ).toBe(true);
  });

  it("does NOT flag a real-looking tx hash", () => {
    expect(
      isPlaceholderTxHash("0x9f8e7d6c5b4a39281706f5e4d3c2b1a0099887766554433221100ffeeddccbb"),
    ).toBe(false);
  });
});
