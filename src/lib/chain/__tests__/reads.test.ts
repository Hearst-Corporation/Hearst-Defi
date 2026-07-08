/**
 * Read-path pagination tests for EventLogger and PoRRegistry.
 *
 * Every free-tier RPC caps the block range accepted per `getLogs` call (see
 * src/lib/chain/get-logs-chunked.ts docstring). These tests verify that
 * `fetchOnChainEvents` / `fetchOnChainAttestations` paginate a wide
 * [deployBlock, latest] range into bounded windows, aggregate + sort the
 * results as before, and — critically — fail CLOSED (empty array, never a
 * silent partial page) when one window keeps erroring.
 *
 * All chain I/O is mocked via the `@/lib/chain/client` seam — no network
 * calls are made. `@/lib/env` is mocked with getters bound to dedicated
 * `__TEST_*` process.env vars so each test can control the deploy-block /
 * chunk-size env inputs without needing to reimport the module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const EVENT_LOGGER_ADDR = "0x1111111111111111111111111111111111111111";
const POR_REGISTRY_ADDR = "0x2222222222222222222222222222222222222222";

const {
  getBlockNumberMock,
  getContractEventsMock,
  getBlockMock,
  getEventLoggerAddressMock,
  getPoRRegistryAddressMock,
  getHearstPublisherAddressMock,
} = vi.hoisted(() => ({
  getBlockNumberMock: vi.fn(),
  getContractEventsMock: vi.fn(),
  getBlockMock: vi.fn(),
  getEventLoggerAddressMock: vi.fn(),
  getPoRRegistryAddressMock: vi.fn(),
  getHearstPublisherAddressMock: vi.fn(),
}));

vi.mock("@/lib/chain/client", () => ({
  getEventLoggerAddress: getEventLoggerAddressMock,
  getPoRRegistryAddress: getPoRRegistryAddressMock,
  getHearstPublisherAddress: getHearstPublisherAddressMock,
  getPublicClient: () => ({
    getBlockNumber: getBlockNumberMock,
    getContractEvents: getContractEventsMock,
    getBlock: getBlockMock,
  }),
}));

// Bound to __TEST_* env vars (not the real process.env names) so each test
// can set them AFTER import without needing to reset modules — mirrors the
// pattern in src/lib/agentic/observability/__tests__/db-store-aggregate.test.ts.
vi.mock("@/lib/env", () => ({
  env: {
    get NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK() {
      const v = process.env.__TEST_EL_DEPLOY_BLOCK;
      return v === undefined ? undefined : Number(v);
    },
    get NEXT_PUBLIC_POR_REGISTRY_DEPLOY_BLOCK() {
      const v = process.env.__TEST_POR_DEPLOY_BLOCK;
      return v === undefined ? undefined : Number(v);
    },
    get NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE() {
      const v = process.env.__TEST_CHUNK_SIZE;
      return v === undefined ? undefined : Number(v);
    },
  },
}));

import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";

function makeHearstEventLog(blockNumber: bigint, eventId: bigint) {
  return {
    args: {
      eventId,
      kind: 0,
      contextHash: `0x${"aa".repeat(32)}` as `0x${string}`,
      publisher: "0x9999999999999999999999999999999999999999",
      timestamp: 1_700_000_000n,
      payloadCid: "bafybeicid",
    },
    transactionHash: `0x${blockNumber.toString(16).padStart(64, "0")}` as `0x${string}`,
    blockNumber,
  };
}

function makeAttestationLog(blockNumber: bigint, attestationId: bigint) {
  return {
    args: {
      attestationId,
      period: 202606n,
      attestor: "0x9999999999999999999999999999999999999999",
      totalAumUsd: 1_000_000_000n,
      minedBtcSats: 50_000_000n,
      evidenceHash: `0x${"bb".repeat(32)}` as `0x${string}`,
      evidenceCid: "bafybeievidence",
    },
    transactionHash: `0x${blockNumber.toString(16).padStart(64, "0")}` as `0x${string}`,
    blockNumber,
  };
}

beforeEach(() => {
  getEventLoggerAddressMock.mockReturnValue(EVENT_LOGGER_ADDR);
  getPoRRegistryAddressMock.mockReturnValue(POR_REGISTRY_ADDR);
  getHearstPublisherAddressMock.mockReturnValue(null); // no publisher filter by default
  getBlockMock.mockResolvedValue({ timestamp: 1_700_000_000n });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.__TEST_EL_DEPLOY_BLOCK;
  delete process.env.__TEST_POR_DEPLOY_BLOCK;
  delete process.env.__TEST_CHUNK_SIZE;
});

// ---------------------------------------------------------------------------
// fetchOnChainEvents
// ---------------------------------------------------------------------------

describe("fetchOnChainEvents — pagination", () => {
  it("splits a wide range into multiple getContractEvents windows and aggregates all events", async () => {
    process.env.__TEST_EL_DEPLOY_BLOCK = "0";
    process.env.__TEST_CHUNK_SIZE = "100";
    getBlockNumberMock.mockResolvedValue(349n); // range [0, 349] over chunk=100 → 4 windows

    getContractEventsMock.mockImplementation(
      async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => [
        makeHearstEventLog(fromBlock, fromBlock), // one distinguishing event per window
      ],
    );

    const events = await fetchOnChainEvents({ limit: 50 });

    // 4 windows called: [0,99] [100,199] [200,299] [300,349]
    expect(getContractEventsMock).toHaveBeenCalledTimes(4);
    const calledRanges = getContractEventsMock.mock.calls.map((call) => {
      const arg = call[0] as { fromBlock: bigint; toBlock: bigint };
      return [arg.fromBlock, arg.toBlock];
    });
    expect(calledRanges).toEqual([
      [0n, 99n],
      [100n, 199n],
      [200n, 299n],
      [300n, 349n],
    ]);

    // All 4 events aggregated (one per window), sorted descending by eventId.
    expect(events).toHaveLength(4);
    expect(events.map((e) => e.eventId)).toEqual([300n, 200n, 100n, 0n]);
  });

  it("respects the `limit` option after aggregating across windows", async () => {
    process.env.__TEST_EL_DEPLOY_BLOCK = "0";
    process.env.__TEST_CHUNK_SIZE = "100"; // below MIN_CHUNK_SIZE would get clamped up — use a valid value
    getBlockNumberMock.mockResolvedValue(399n); // 4 windows of 100 blocks

    getContractEventsMock.mockImplementation(
      async ({ fromBlock }: { fromBlock: bigint }) => [
        makeHearstEventLog(fromBlock, fromBlock),
      ],
    );

    const events = await fetchOnChainEvents({ limit: 2 });
    expect(events).toHaveLength(2);
  });

  it("fails closed: returns [] (never a partial page) when one window errors twice", async () => {
    process.env.__TEST_EL_DEPLOY_BLOCK = "0";
    process.env.__TEST_CHUNK_SIZE = "100";
    getBlockNumberMock.mockResolvedValue(299n); // 3 windows: [0,99] [100,199] [200,299]

    getContractEventsMock.mockImplementation(
      async ({ fromBlock }: { fromBlock: bigint }) => {
        if (fromBlock === 100n) {
          throw new Error("rpc range too large");
        }
        return [makeHearstEventLog(fromBlock, fromBlock)];
      },
    );

    const events = await fetchOnChainEvents({ limit: 50 });

    expect(events).toEqual([]);
    // The failing window was retried once (2 attempts), never gave up early
    // and never let the healthy windows' partial results leak through.
    const failingCalls = getContractEventsMock.mock.calls.filter((call) => {
      const arg = call[0] as { fromBlock: bigint };
      return arg.fromBlock === 100n;
    });
    expect(failingCalls).toHaveLength(2);
  });

  it("still returns [] (never throws) when the contract address is not configured", async () => {
    getEventLoggerAddressMock.mockReturnValue(null);
    const events = await fetchOnChainEvents();
    expect(events).toEqual([]);
    expect(getContractEventsMock).not.toHaveBeenCalled();
  });

  it("a single-window range (small span) still issues exactly one call", async () => {
    delete process.env.__TEST_EL_DEPLOY_BLOCK;
    process.env.__TEST_CHUNK_SIZE = "100000";
    getBlockNumberMock.mockResolvedValue(20n); // no deploy block → tail fallback (10-block window)
    getContractEventsMock.mockResolvedValue([makeHearstEventLog(20n, 1n)]);

    const events = await fetchOnChainEvents();

    expect(getContractEventsMock).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// fetchOnChainAttestations
// ---------------------------------------------------------------------------

describe("fetchOnChainAttestations — pagination", () => {
  it("splits a wide range into multiple getContractEvents windows and aggregates all attestations", async () => {
    process.env.__TEST_POR_DEPLOY_BLOCK = "0";
    process.env.__TEST_CHUNK_SIZE = "100";
    getBlockNumberMock.mockResolvedValue(249n); // 3 windows

    getContractEventsMock.mockImplementation(
      async ({ fromBlock }: { fromBlock: bigint }) => [
        makeAttestationLog(fromBlock, fromBlock),
      ],
    );

    const attestations = await fetchOnChainAttestations({ limit: 12 });

    expect(getContractEventsMock).toHaveBeenCalledTimes(3);
    expect(attestations).toHaveLength(3);
    expect(attestations.map((a) => a.attestationId)).toEqual([
      200n,
      100n,
      0n,
    ]);
  });

  it("fails closed: returns [] when one window errors twice", async () => {
    process.env.__TEST_POR_DEPLOY_BLOCK = "0";
    process.env.__TEST_CHUNK_SIZE = "100";
    getBlockNumberMock.mockResolvedValue(199n); // 2 windows: [0,99] [100,199]

    getContractEventsMock.mockImplementation(
      async ({ fromBlock }: { fromBlock: bigint }) => {
        if (fromBlock === 0n) throw new Error("window down");
        return [makeAttestationLog(fromBlock, fromBlock)];
      },
    );

    const attestations = await fetchOnChainAttestations();
    expect(attestations).toEqual([]);
  });

  it("returns [] when the registry address is not configured", async () => {
    getPoRRegistryAddressMock.mockReturnValue(null);
    const attestations = await fetchOnChainAttestations();
    expect(attestations).toEqual([]);
    expect(getContractEventsMock).not.toHaveBeenCalled();
  });
});
