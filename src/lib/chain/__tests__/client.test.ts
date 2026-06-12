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
