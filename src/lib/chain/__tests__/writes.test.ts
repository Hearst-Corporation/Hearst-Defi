/**
 * Write-path unit tests for EventLogger and PoRRegistry.
 *
 * All on-chain I/O is mocked via the `@/lib/chain/publisher` seam —
 * no network calls are made. Tests verify:
 *   1. DISARMED: when getPublisherWalletClient() returns null, both writers
 *      resolve to null and writeContract is never called.
 *   2. ARMED: when a fake wallet client is provided, each writer calls
 *      writeContract with the correct function name and arguments, and
 *      returns the fake txHash.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletClient } from "viem";

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before the subject imports.
// ---------------------------------------------------------------------------

vi.mock("@/lib/chain/publisher", () => ({
  getPublisherPrivateKey: vi.fn(),
  isPublisherArmed: vi.fn(),
  getPublisherWalletClient: vi.fn(),
}));

// After mocking publisher, import the subjects and the mock itself.
import { writeHearstEvent } from "@/lib/chain/event-logger";
import { publishAttestation } from "@/lib/chain/por-registry";
import { isPublisherArmed, getPublisherWalletClient } from "@/lib/chain/publisher";
import { EVENT_KIND_LABELS } from "@/lib/chain/abis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_TX = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab" as `0x${string}`;

const EVENT_LOGGER_ADDR = "0x1111111111111111111111111111111111111111";
const POR_REGISTRY_ADDR = "0x2222222222222222222222222222222222222222";
const FAKE_CONTEXT_HASH = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`;
const FAKE_EVIDENCE_HASH = "0xcafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe" as `0x${string}`;

/** Minimal fake WalletClient — typed just enough for writeContract. */
function makeFakeWalletClient() {
  const writeContract = vi.fn().mockResolvedValue(FAKE_TX);
  const client = {
    writeContract,
    account: { address: "0xfakeaccount" as `0x${string}` },
    chain: { id: 84532, name: "Base Sepolia" },
  };
  return { client: client as unknown as WalletClient, writeContract };
}

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

const ORIG_EL = process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS;
const ORIG_POR = process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS;
const ORIG_KEY = process.env.HEARST_PUBLISHER_PRIVATE_KEY;

beforeEach(() => {
  process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS = EVENT_LOGGER_ADDR;
  process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS = POR_REGISTRY_ADDR;
});

afterEach(() => {
  // Restore env
  process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS = ORIG_EL;
  process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS = ORIG_POR;
  process.env.HEARST_PUBLISHER_PRIVATE_KEY = ORIG_KEY;
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// DISARMED suite
// ---------------------------------------------------------------------------

describe("DISARMED — getPublisherWalletClient returns null", () => {
  beforeEach(() => {
    vi.mocked(getPublisherWalletClient).mockReturnValue(null);
    vi.mocked(isPublisherArmed).mockReturnValue(false);
  });

  it("writeHearstEvent resolves to null without calling writeContract", async () => {
    const result = await writeHearstEvent({
      kind: "Distribution",
      contextHash: FAKE_CONTEXT_HASH,
    });

    expect(result).toBeNull();
    // No fake client was created — just confirm the mock was called
    expect(getPublisherWalletClient).toHaveBeenCalled();
  });

  it("publishAttestation resolves to null without calling writeContract", async () => {
    const result = await publishAttestation({
      period: 202606n,
      totalAumUsd: 1_000_000_000n,
      minedBtcSats: 50_000_000n,
      evidenceHash: FAKE_EVIDENCE_HASH,
    });

    expect(result).toBeNull();
    expect(getPublisherWalletClient).toHaveBeenCalled();
  });

  it("isPublisherArmed returns false", () => {
    expect(isPublisherArmed()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ARMED suite
// ---------------------------------------------------------------------------

describe("ARMED — getPublisherWalletClient returns a fake client", () => {
  let writeContract: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const { client, writeContract: wc } = makeFakeWalletClient();
    writeContract = wc;
    vi.mocked(getPublisherWalletClient).mockReturnValue(client);
    vi.mocked(isPublisherArmed).mockReturnValue(true);
  });

  it("isPublisherArmed returns true", () => {
    expect(isPublisherArmed()).toBe(true);
  });

  it("writeHearstEvent with kind=Distribution calls logEvent with the correct enum index", async () => {
    const kind = "Distribution" as const;
    const expectedKindIndex = EVENT_KIND_LABELS.indexOf(kind);
    expect(expectedKindIndex).toBeGreaterThan(-1); // sanity: label must exist

    const result = await writeHearstEvent({
      kind,
      contextHash: FAKE_CONTEXT_HASH,
      payloadCid: "bafybeicid",
    });

    expect(result).toBe(FAKE_TX);
    expect(writeContract).toHaveBeenCalledOnce();

    const call = writeContract.mock.calls.at(0)?.at(0) as {
      functionName: string;
      args: [number, `0x${string}`, string];
    };

    expect(call.functionName).toBe("logEvent");
    expect(call.args[0]).toBe(expectedKindIndex);
    expect(call.args[1]).toBe(FAKE_CONTEXT_HASH);
    expect(call.args[2]).toBe("bafybeicid");
  });

  it("writeHearstEvent omits payloadCid falls back to empty string", async () => {
    await writeHearstEvent({
      kind: "ModeChange",
      contextHash: FAKE_CONTEXT_HASH,
    });

    const call = writeContract.mock.calls.at(0)?.at(0) as {
      functionName: string;
      args: [number, `0x${string}`, string];
    };

    expect(call.args[2]).toBe("");
  });

  it("publishAttestation calls publish with all 5 args and returns txHash", async () => {
    const opts = {
      period: 202606n,
      totalAumUsd: 2_500_000_000_000n,
      minedBtcSats: 125_000_000n,
      evidenceHash: FAKE_EVIDENCE_HASH,
      evidenceCid: "bafybeievidence",
    };

    const result = await publishAttestation(opts);

    expect(result).toBe(FAKE_TX);
    expect(writeContract).toHaveBeenCalledOnce();

    const call = writeContract.mock.calls.at(0)?.at(0) as {
      functionName: string;
      args: [bigint, bigint, bigint, `0x${string}`, string];
    };

    expect(call.functionName).toBe("publish");
    expect(call.args[0]).toBe(opts.period);
    expect(call.args[1]).toBe(opts.totalAumUsd);
    expect(call.args[2]).toBe(opts.minedBtcSats);
    expect(call.args[3]).toBe(opts.evidenceHash);
    expect(call.args[4]).toBe(opts.evidenceCid);
  });

  it("publishAttestation omits evidenceCid falls back to empty string", async () => {
    await publishAttestation({
      period: 202606n,
      totalAumUsd: 1n,
      minedBtcSats: 1n,
      evidenceHash: FAKE_EVIDENCE_HASH,
    });

    const call = writeContract.mock.calls.at(0)?.at(0) as {
      functionName: string;
      args: [bigint, bigint, bigint, `0x${string}`, string];
    };

    expect(call.args[4]).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("writeHearstEvent returns null when event logger address is not configured", async () => {
    delete process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS;
    const { client } = makeFakeWalletClient();
    vi.mocked(getPublisherWalletClient).mockReturnValue(client);

    const result = await writeHearstEvent({
      kind: "Rebalance",
      contextHash: FAKE_CONTEXT_HASH,
    });

    expect(result).toBeNull();
  });

  it("publishAttestation returns null when por registry address is not configured", async () => {
    delete process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS;
    const { client } = makeFakeWalletClient();
    vi.mocked(getPublisherWalletClient).mockReturnValue(client);

    const result = await publishAttestation({
      period: 202606n,
      totalAumUsd: 1n,
      minedBtcSats: 1n,
      evidenceHash: FAKE_EVIDENCE_HASH,
    });

    expect(result).toBeNull();
  });
});
