import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the keeper signer — the module that holds the key and moves funds.
 *
 * Two tiers, deliberately separated:
 *
 *  1. GATE tests. Nothing reaches the chain: every case is rejected by
 *     `prepareKeeper` BEFORE a wallet is ever built. The gate is what stands
 *     between an HTTP request and a signature, so it is tested in isolation.
 *     `getPublicClient` throws in this tier — a gate test that reaches the chain
 *     fails loudly rather than quietly proving nothing.
 *
 *  2. ARMED tests. The keeper is enabled, keyed, and pointed at a v2 vault, and
 *     the chain is faked. These lock WHAT WE SEND: the positional argument
 *     order, the simulate-then-write sequence, and the fact that the call we
 *     simulate is the call we sign.
 *
 * ── Why tier 2 exists ────────────────────────────────────────────────────────
 * `swapAndReport` shipped with positions 1 and 2 transposed — `tokenOut` (an
 * address) handed to the contract's `uint256 amountIn`. Tier 1 was fully green
 * throughout: it never looked at a single argument. Only the `as const` tuple
 * typing caught it, and `reportMiningMetrics(uint256,uint256)` has no such net —
 * both parameters are uint256, so tsc CANNOT see a transposition there at all.
 *
 * So tier 2 asserts on the exact args handed to `writeContract`, positionally,
 * and cross-checks each one against the input list the socle's `DYNAVAULT_ABI`
 * declares. That check is derived from the ABI rather than hand-copied: it does
 * not need to know the right answer in advance, and it fails on the transposed
 * version because an address cannot inhabit a uint256 slot.
 *
 * NO NETWORK anywhere: `createWalletClient` is replaced, `getPublicClient` is
 * mocked, and `createPublicClient` throws if anything ever tries to build one.
 */

vi.mock("server-only", () => ({}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * The REAL adapter, with only `getVaultTarget` overridden so these tests pin OUR
 * gate rather than its address resolution.
 *
 * The ABI must be the genuine `DYNAVAULT_ABI` and not a `[]` stub: tier 2 checks
 * the args we send against the input list the socle declares, and a stubbed ABI
 * would check nothing. It also lets us assert that the keeper passes the socle's
 * ABI object itself — no local copy that could drift from the contract.
 */
const mockGetVaultTarget = vi.fn();
vi.mock("@/lib/chain/dynavault", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chain/dynavault")>();
  return { ...actual, getVaultTarget: () => mockGetVaultTarget() };
});

/** Throws by default (tier 1); the armed suite swaps in a fake (tier 2). */
const mockGetPublicClient = vi.fn();
vi.mock("@/lib/chain/client", () => ({
  getPublicClient: () => mockGetPublicClient(),
}));

/**
 * `createWalletClient` is the one seam the keeper does not take from a module we
 * can mock — it builds the wallet itself, from the private key. Replacing viem's
 * factory lets us capture `writeContract` without ever constructing a real
 * signer or holding real key material.
 *
 * `createPublicClient` is a hard network guard: nothing in this file may build
 * one (the keeper's public client comes from `@/lib/chain/client`, mocked above).
 */
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => {
      throw new Error("network access is forbidden in unit tests");
    }),
    createWalletClient: (config: { account: unknown }) => ({
      account: config.account,
      writeContract: (params: ChainCallParams) => mockWriteContract(params),
    }),
  };
});

import { DYNAVAULT_ABI } from "@/lib/chain/dynavault";
import {
  executeRebalance,
  isKeeperEnabled,
  payElectricity,
  reportMiningMetrics,
} from "@/lib/chain/keeper";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const V2_ADDRESS = "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
/** Syntactically valid secp256k1 key, well below the curve order. Never a real one. */
const VALID_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

const V2_TARGET = { mode: "v2", address: V2_ADDRESS };
const LEGACY_TARGET = { mode: "legacy", address: V2_ADDRESS };
const UNCONFIGURED_TARGET = { mode: "not_configured", address: null };

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const ROUTER_ADDRESS = "0x5555555555555555555555555555555555555555";
const SWAP_WORD =
  "0xefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef";

const SWAP_TX =
  "0xabababababababababababababababababababababababababababababababab";
const REBALANCE_TX =
  "0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";

/**
 * Every field holds a DISTINCT value on purpose. Two identical addresses (say
 * `tokenOut` and `router`) would let a transposition of those two positions slip
 * through an order test unnoticed — which is the exact failure this file exists
 * to prevent. `amountIn !== minAmountOut` for the same reason.
 */
const REBALANCE_INPUT = {
  tokenIn: USDC_ADDRESS,
  tokenOut: WETH_ADDRESS,
  amountIn: 1_000_000n,
  minAmountOut: 250_000n,
  router: ROUTER_ADDRESS,
  swapData: [SWAP_WORD],
} as const;

// ---------------------------------------------------------------------------
// Fake chain
// ---------------------------------------------------------------------------

/** What the keeper hands to `simulateContract` / `writeContract`. */
interface ChainCallParams {
  address: `0x${string}`;
  abi: unknown;
  functionName: string;
  args?: readonly unknown[];
  account?: unknown;
  chain?: unknown;
}

/**
 * Ordered log of every chain interaction. A plain array rather than mock
 * bookkeeping: it makes "simulate ran before write" an exact, readable equality
 * instead of an inference about call counts.
 */
const callLog: string[] = [];

/** Flipped per-test to model a swap that mines and then reverts. */
let receiptStatus = "success";

const mockSimulateContract = vi.fn(async (params: ChainCallParams) => {
  callLog.push(`simulate:${params.functionName}`);
  return { request: params };
});

const mockWriteContract = vi.fn(
  async (params: ChainCallParams): Promise<`0x${string}`> => {
    callLog.push(`write:${params.functionName}`);
    return params.functionName === "rebalance" ? REBALANCE_TX : SWAP_TX;
  },
);

const mockWaitForTransactionReceipt = vi.fn(
  async (params: {
    hash: `0x${string}`;
    timeout?: number;
  }): Promise<{ status: string }> => {
    callLog.push(`wait:${params.hash}`);
    return { status: receiptStatus };
  },
);

const fakePublicClient = {
  simulateContract: mockSimulateContract,
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
};

// ---------------------------------------------------------------------------
// ABI-derived assertions
// ---------------------------------------------------------------------------

/** The Solidity types the socle declares for a function, in order. */
function abiInputTypes(name: string): string[] {
  const item = DYNAVAULT_ABI.find((entry) => entry.name === name);
  if (item === undefined) {
    throw new Error(`${name} is not declared in DYNAVAULT_ABI`);
  }
  return item.inputs.map((input) => input.type);
}

/**
 * Does a runtime value fit the Solidity type declared at its position?
 *
 * This is the check that kills the whole bug class: an `address` is a 40-hex
 * string and a `uint256` is a bigint, so a transposed address/amount pair cannot
 * pass — without the test needing to know the correct order in advance.
 */
function matchesSolidityType(value: unknown, solidityType: string): boolean {
  switch (solidityType) {
    case "address":
      return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
    case "uint256":
      return typeof value === "bigint";
    case "bool":
      return typeof value === "boolean";
    case "bytes32[]":
      return (
        Array.isArray(value) &&
        value.every(
          (word: unknown) =>
            typeof word === "string" && /^0x[0-9a-fA-F]{64}$/.test(word),
        )
      );
    default:
      return false;
  }
}

function writeCallFor(functionName: string): ChainCallParams {
  const call = mockWriteContract.mock.calls.find(
    ([params]) => params.functionName === functionName,
  );
  if (call === undefined) {
    throw new Error(`writeContract was never called for ${functionName}`);
  }
  return call[0];
}

function simulateCallFor(functionName: string): ChainCallParams {
  const call = mockSimulateContract.mock.calls.find(
    ([params]) => params.functionName === functionName,
  );
  if (call === undefined) {
    throw new Error(`simulateContract was never called for ${functionName}`);
  }
  return call[0];
}

function writeArgsFor(functionName: string): readonly unknown[] {
  const params = writeCallFor(functionName);
  if (params.args === undefined) {
    throw new Error(`${functionName} was written without args`);
  }
  return params.args;
}

/** Assert every argument fits the type the ABI declares at that position. */
function expectArgsMatchAbi(functionName: string): void {
  const types = abiInputTypes(functionName);
  const args = writeArgsFor(functionName);
  expect(args).toHaveLength(types.length);
  types.forEach((solidityType, index) => {
    expect(
      matchesSolidityType(args[index], solidityType),
      `${functionName} arg ${index} must be a ${solidityType}, got ${typeof args[index]}`,
    ).toBe(true);
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  callLog.length = 0;
  receiptStatus = "success";
  delete process.env.KEEPER_ENABLED;
  delete process.env.KEEPER_PRIVATE_KEY;
  mockGetVaultTarget.mockReturnValue(V2_TARGET);
  mockGetPublicClient.mockImplementation(() => {
    throw new Error("getPublicClient must not be reached in a gate test");
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ---------------------------------------------------------------------------
// Tier 1 — the gate. Nothing here reaches the chain.
// ---------------------------------------------------------------------------

describe("isKeeperEnabled — default OFF", () => {
  it("is false when KEEPER_ENABLED is unset", () => {
    expect(isKeeperEnabled()).toBe(false);
  });

  it("is true ONLY for the literal '1'", () => {
    process.env.KEEPER_ENABLED = "1";
    expect(isKeeperEnabled()).toBe(true);
  });

  it.each(["0", "true", "yes", "TRUE", "", " 1"])(
    "is false for %o — nothing but '1' arms the keeper",
    (value) => {
      process.env.KEEPER_ENABLED = value;
      expect(isKeeperEnabled()).toBe(false);
    },
  );

  it("is re-read on every call, so the switch takes effect without a restart", () => {
    process.env.KEEPER_ENABLED = "1";
    expect(isKeeperEnabled()).toBe(true);
    process.env.KEEPER_ENABLED = "0";
    expect(isKeeperEnabled()).toBe(false);
  });
});

describe("kill-switch — every write is blocked when KEEPER_ENABLED is off", () => {
  beforeEach(() => {
    process.env.KEEPER_PRIVATE_KEY = VALID_KEY;
  });

  it("blocks reportMiningMetrics", async () => {
    await expect(
      reportMiningMetrics({ hashrateTh: 100, btcEarnedSats: 1 }),
    ).resolves.toEqual({ status: "blocked", reason: "keeper_disabled" });
  });

  it("blocks payElectricity", async () => {
    await expect(payElectricity()).resolves.toEqual({
      status: "blocked",
      reason: "keeper_disabled",
    });
  });

  it("blocks executeRebalance", async () => {
    await expect(executeRebalance(REBALANCE_INPUT)).resolves.toEqual({
      status: "blocked",
      reason: "keeper_disabled",
    });
  });

  it("does not even look at the vault target when disabled", async () => {
    await payElectricity();
    expect(mockGetVaultTarget).not.toHaveBeenCalled();
  });

  it("signs nothing — writeContract is never reached", async () => {
    await payElectricity();
    await reportMiningMetrics({ hashrateTh: 1, btcEarnedSats: 1 });
    await executeRebalance(REBALANCE_INPUT);
    expect(mockWriteContract).not.toHaveBeenCalled();
    expect(callLog).toEqual([]);
  });
});

describe("deployment gate — nothing is attempted against a non-v2 vault", () => {
  beforeEach(() => {
    process.env.KEEPER_ENABLED = "1";
    process.env.KEEPER_PRIVATE_KEY = VALID_KEY;
  });

  it("blocks with not_deployed in legacy mode (HearstYieldVault has no keeper surface)", async () => {
    mockGetVaultTarget.mockReturnValue(LEGACY_TARGET);
    const result = await payElectricity();
    expect(result).toMatchObject({ status: "blocked", reason: "not_deployed" });
  });

  it("blocks with not_deployed when no address is configured", async () => {
    mockGetVaultTarget.mockReturnValue(UNCONFIGURED_TARGET);
    const result = await reportMiningMetrics({ hashrateTh: 1, btcEarnedSats: 1 });
    expect(result).toMatchObject({ status: "blocked", reason: "not_deployed" });
  });

  it("distinguishes legacy from unconfigured in `detail` (server-side diagnostics)", async () => {
    mockGetVaultTarget.mockReturnValue(LEGACY_TARGET);
    const legacy = await payElectricity();
    mockGetVaultTarget.mockReturnValue(UNCONFIGURED_TARGET);
    const unconfigured = await payElectricity();

    expect(legacy).toMatchObject({ detail: expect.stringContaining("legacy") });
    expect(unconfigured).toMatchObject({
      detail: expect.stringContaining("NEXT_PUBLIC_DYNAVAULT_ADDRESS"),
    });
  });

  it("blocks executeRebalance before the swap — a half-done state must be impossible here", async () => {
    mockGetVaultTarget.mockReturnValue(UNCONFIGURED_TARGET);
    const result = await executeRebalance(REBALANCE_INPUT);
    expect(result).toMatchObject({ status: "blocked", reason: "not_deployed" });
    expect(result).not.toHaveProperty("swapTxHash");
  });
});

describe("key gate — a disarmed keeper is an explicit block, never a silent success", () => {
  beforeEach(() => {
    process.env.KEEPER_ENABLED = "1";
  });

  it("blocks with key_missing when KEEPER_PRIVATE_KEY is absent", async () => {
    const result = await payElectricity();
    expect(result).toEqual({ status: "blocked", reason: "key_missing" });
  });

  it("blocks with key_missing when KEEPER_PRIVATE_KEY is blank", async () => {
    process.env.KEEPER_PRIVATE_KEY = "   ";
    const result = await payElectricity();
    expect(result).toEqual({ status: "blocked", reason: "key_missing" });
  });

  it.each([
    ["not hex", "nope"],
    ["missing 0x prefix", "1111111111111111111111111111111111111111111111111111111111111111"],
    ["too short", "0x11111111111111111111111111111111111111111111111111111111111111"],
    ["too long", "0x111111111111111111111111111111111111111111111111111111111111111111"],
  ])("blocks with key_malformed — %s", async (_label, key) => {
    process.env.KEEPER_PRIVATE_KEY = key;
    const result = await payElectricity();
    expect(result).toEqual({ status: "blocked", reason: "key_malformed" });
  });

  it("NEVER returns a 'sent' status while disarmed", async () => {
    const results = [
      await payElectricity(),
      await reportMiningMetrics({ hashrateTh: 1, btcEarnedSats: 1 }),
      await executeRebalance(REBALANCE_INPUT),
    ];
    for (const result of results) {
      expect(result.status).toBe("blocked");
    }
  });

  it("never leaks the key material into the returned block", async () => {
    process.env.KEEPER_PRIVATE_KEY = VALID_KEY;
    mockGetVaultTarget.mockReturnValue(LEGACY_TARGET);
    const result = await payElectricity();
    expect(JSON.stringify(result)).not.toContain("1111111111111111");
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — armed. These lock what we actually send.
// ---------------------------------------------------------------------------

describe("armed keeper — swapAndReport argument order (the bug that moved money)", () => {
  beforeEach(() => {
    process.env.KEEPER_ENABLED = "1";
    process.env.KEEPER_PRIVATE_KEY = VALID_KEY;
    mockGetPublicClient.mockImplementation(() => fakePublicClient);
  });

  /**
   * THE regression lock.
   *
   * `swapAndReport(address tokenIn, uint256 amountIn, address tokenOut,
   *                uint256 minAmountOut, address target, bytes32[] swapData)`
   *
   * `amountIn` is position 1, BETWEEN the two tokens. The shipped bug passed
   * [tokenIn, tokenOut, amountIn, …] — an address into the amount slot. Every
   * value in REBALANCE_INPUT is distinct, so no transposition can survive this.
   */
  it("passes swapAndReport's args in the ABI's order: tokenIn, amountIn, tokenOut, minAmountOut, target, swapData", async () => {
    await executeRebalance(REBALANCE_INPUT);

    expect(writeArgsFor("swapAndReport")).toEqual([
      USDC_ADDRESS, // 0 · address tokenIn
      1_000_000n, //   1 · uint256 amountIn   ← NOT tokenOut
      WETH_ADDRESS, // 2 · address tokenOut
      250_000n, //     3 · uint256 minAmountOut
      ROUTER_ADDRESS, // 4 · address target
      [SWAP_WORD], //  5 · bytes32[] swapData
    ]);
  });

  /**
   * The same lock, derived from the ABI instead of hand-copied — it does not
   * need to know the right order in advance, only that an address cannot sit in
   * a uint256 slot. This is what generalises to every future signature change.
   */
  it("every swapAndReport arg fits the Solidity type DYNAVAULT_ABI declares at that position", async () => {
    await executeRebalance(REBALANCE_INPUT);
    expectArgsMatchAbi("swapAndReport");
  });

  it("sanity: the ABI this test checks against is still the v2.1 signature", () => {
    expect(abiInputTypes("swapAndReport")).toEqual([
      "address",
      "uint256",
      "address",
      "uint256",
      "address",
      "bytes32[]",
    ]);
  });

  it("amounts stay bigint end-to-end — a base-unit amount never becomes a Number", async () => {
    await executeRebalance(REBALANCE_INPUT);
    const args = writeArgsFor("swapAndReport");
    expect(typeof args[1]).toBe("bigint");
    expect(typeof args[3]).toBe("bigint");
  });

  it("signs against the socle's ABI object itself, never a local copy", async () => {
    await executeRebalance(REBALANCE_INPUT);
    expect(writeCallFor("swapAndReport").abi).toBe(DYNAVAULT_ABI);
    expect(writeCallFor("swapAndReport").address).toBe(V2_ADDRESS);
  });

  /**
   * Simulating one call and signing another is the same bug class one step
   * later. The keeper builds each args tuple ONCE and hands the same reference
   * to both, so identity — not just equality — is the invariant worth pinning.
   */
  it("simulates exactly what it signs — same args tuple, same abi, same address", async () => {
    await executeRebalance(REBALANCE_INPUT);
    const simulated = simulateCallFor("swapAndReport");
    const written = writeCallFor("swapAndReport");

    expect(simulated.args).toEqual(written.args);
    expect(simulated.args).toBe(written.args);
    expect(simulated.abi).toBe(written.abi);
    expect(simulated.address).toBe(written.address);
  });
});

describe("armed keeper — reportMiningMetrics argument order (tsc cannot catch this one)", () => {
  beforeEach(() => {
    process.env.KEEPER_ENABLED = "1";
    process.env.KEEPER_PRIVATE_KEY = VALID_KEY;
    mockGetPublicClient.mockImplementation(() => fakePublicClient);
  });

  /**
   * `reportMiningMetrics(uint256 hashrateTh, uint256 btcEarnedSats)`.
   *
   * BOTH are uint256, so the `as const` tuple type-checks either way round: the
   * compiler is blind here and this test is the ONLY thing standing between a
   * transposition and a vault reporting its hashrate as satoshis mined. The two
   * values are distinct and non-round so a swap cannot pass silently.
   */
  it("passes hashrateTh first and btcEarnedSats second", async () => {
    await reportMiningMetrics({ hashrateTh: 700, btcEarnedSats: 4242 });
    expect(writeArgsFor("reportMiningMetrics")).toEqual([700n, 4242n]);
  });

  it("every reportMiningMetrics arg fits the ABI's declared type at that position", async () => {
    await reportMiningMetrics({ hashrateTh: 700, btcEarnedSats: 4242 });
    expectArgsMatchAbi("reportMiningMetrics");
  });

  it("simulates exactly what it signs", async () => {
    await reportMiningMetrics({ hashrateTh: 700, btcEarnedSats: 4242 });
    expect(simulateCallFor("reportMiningMetrics").args).toBe(
      writeCallFor("reportMiningMetrics").args,
    );
  });

  it("reports sent with the tx hash and the chain it was sent to", async () => {
    const result = await reportMiningMetrics({ hashrateTh: 1, btcEarnedSats: 1 });
    expect(result).toMatchObject({
      status: "sent",
      txHash: SWAP_TX,
      address: V2_ADDRESS,
      chainId: 84532,
    });
  });
});

describe("armed keeper — payElectricity takes no arguments", () => {
  beforeEach(() => {
    process.env.KEEPER_ENABLED = "1";
    process.env.KEEPER_PRIVATE_KEY = VALID_KEY;
    mockGetPublicClient.mockImplementation(() => fakePublicClient);
  });

  it("sends payElectricity with an empty argument list, as the ABI declares", async () => {
    await payElectricity();
    expect(abiInputTypes("payElectricity")).toEqual([]);
    expect(writeCallFor("payElectricity").args ?? []).toEqual([]);
  });

  it("simulates before it moves USDC to elecPayee", async () => {
    await payElectricity();
    expect(callLog).toEqual(["simulate:payElectricity", "write:payElectricity"]);
  });
});

describe("armed keeper — simulate runs before every write", () => {
  beforeEach(() => {
    process.env.KEEPER_ENABLED = "1";
    process.env.KEEPER_PRIVATE_KEY = VALID_KEY;
    mockGetPublicClient.mockImplementation(() => fakePublicClient);
  });

  /**
   * The simulation is the net: a call that would revert is caught before a tx is
   * broadcast and burns gas. This pins the whole sequence — simulate/write for
   * the swap, then the receipt wait, then simulate/write for the rebalance — so
   * a reordering or a dropped simulate shows up as a diff, not as a lost fee.
   */
  it("runs simulate → write → wait-for-receipt → simulate → write, in that order", async () => {
    await executeRebalance(REBALANCE_INPUT);
    expect(callLog).toEqual([
      "simulate:swapAndReport",
      "write:swapAndReport",
      `wait:${SWAP_TX}`,
      "simulate:rebalance",
      "write:rebalance",
    ]);
  });

  it("returns both hashes when the whole sequence lands", async () => {
    const result = await executeRebalance(REBALANCE_INPUT);
    expect(result).toMatchObject({
      status: "sent",
      swapTxHash: SWAP_TX,
      rebalanceTxHash: REBALANCE_TX,
      address: V2_ADDRESS,
      chainId: 84532,
    });
  });

  it("waits on the swap receipt with a bounded timeout, never unbounded", async () => {
    await executeRebalance(REBALANCE_INPUT);
    const waited = mockWaitForTransactionReceipt.mock.calls.at(0)?.at(0);
    expect(waited?.hash).toBe(SWAP_TX);
    expect(typeof waited?.timeout).toBe("number");
  });

  /**
   * `waitForTransactionReceipt` RESOLVES for a reverted tx — it does not throw.
   * Reading "resolved" as "succeeded" would fire rebalance() on top of a swap
   * that never happened.
   */
  it("does NOT attempt the rebalance when the swap mines but reverts", async () => {
    receiptStatus = "reverted";
    const result = await executeRebalance(REBALANCE_INPUT);

    expect(result).toMatchObject({ status: "swap_reverted", swapTxHash: SWAP_TX });
    expect(callLog).toEqual([
      "simulate:swapAndReport",
      "write:swapAndReport",
      `wait:${SWAP_TX}`,
    ]);
    expect(mockWriteContract).toHaveBeenCalledTimes(1);
  });

  /**
   * A simulation that rejects must cost nothing: no tx, no hash, no half-done
   * state to reconcile.
   */
  it("signs nothing when the swap simulation rejects", async () => {
    mockSimulateContract.mockRejectedValueOnce(new Error("execution reverted"));
    const result = await executeRebalance(REBALANCE_INPUT);

    expect(result).toMatchObject({ status: "blocked" });
    expect(result).not.toHaveProperty("swapTxHash");
    expect(mockWriteContract).not.toHaveBeenCalled();
  });
});
