import { afterEach, describe, expect, it } from "vitest";

import {
  getEventLoggerAddress,
  getPoRRegistryAddress,
  isChainConfigured,
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

  it("falls back to registry addresses when env is absent", () => {
    delete process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS;
    delete process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS;

    expect(getEventLoggerAddress()).toBe(
      "0xb07E045D082d202bAc7C1d4F83e1A63d00653D9E",
    );
    expect(getPoRRegistryAddress()).toBe(
      "0x2B7229Ea0c94f12D984d9045ee12fB0D2Efcd28D",
    );
  });

  it("throws on malformed env address (no silent fallback)", () => {
    process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS = "not-an-address";

    expect(() => getEventLoggerAddress()).toThrow(
      /Invalid EVM address in environment/,
    );
  });

  it("reports chain configured via env or registry", () => {
    delete process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS;
    delete process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS;

    expect(isChainConfigured()).toBe(true);
  });
});
