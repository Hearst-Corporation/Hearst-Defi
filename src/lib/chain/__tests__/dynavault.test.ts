/**
 * Unit tests for the PermissionedDynaVault v2.1 adapter.
 *
 * NO NETWORK: `viem` is mocked so `createPublicClient` can never reach an RPC,
 * and every read that exercises a chain call is fed an injected fake client via
 * `ReadOpts.client`.
 *
 * Mode-dependent tests use `vi.resetModules()` + a dynamic import: the module
 * resolves its target ONCE at init from the literal `process.env.NEXT_PUBLIC_*`
 * reads (the Turbopack inlining requirement — see the module header), so the
 * only way to exercise a different mode is to re-import it under a different
 * env. The pure `resolveVaultTarget(env)` covers the matrix without that dance.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DYNAVAULT_ABI,
  DYNAVAULT_DEPOSIT_EVENT_SIGNATURE,
  LEGACY_DEPOSIT_EVENT_SIGNATURE,
  LEGACY_VAULT_READ_ABI,
  UNAVAILABLE_REASONS,
  resolveDynavaultAddress,
  resolveLegacyVaultAddress,
  resolveVaultTarget,
  type ReadContractClient,
} from "@/lib/chain/dynavault";

// Hard network guard: if any code path ever builds a real client and calls it,
// the test fails loudly instead of hitting Base Sepolia.
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    http: vi.fn(() => ({})),
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn(async () => {
        throw new Error("network access is forbidden in unit tests");
      }),
    })),
  };
});

const V2_ADDR = "0x1111111111111111111111111111111111111111";
const LEGACY_ADDR = "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
const ALIAS_ADDR = "0x3333333333333333333333333333333333333333";
const USER_ADDR = "0x4444444444444444444444444444444444444444";
const USDC_ADDR = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const ENV_KEYS = [
  "NEXT_PUBLIC_DYNAVAULT_ADDRESS",
  "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS",
  "NEXT_PUBLIC_HEARST_VAULT_ADDRESS",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];
type DynaVaultModule = typeof import("@/lib/chain/dynavault");

const ORIGINAL_ENV: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    ORIGINAL_ENV[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
  vi.resetModules();
  vi.clearAllMocks();
});

/** Re-import the module with a controlled env so MODULE_TARGET is recomputed. */
async function importWithEnv(
  env: Partial<Record<EnvKey, string>>,
): Promise<DynaVaultModule> {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const key of ENV_KEYS) {
    const value = env[key];
    if (value !== undefined) process.env[key] = value;
  }
  vi.resetModules();
  return import("@/lib/chain/dynavault");
}

/** A fake viem client: returns a canned value per functionName. */
function fakeClient(handlers: Record<string, unknown>): ReadContractClient {
  return {
    readContract: async ({ functionName }) => {
      if (!(functionName in handlers)) {
        // Mirrors viem's ContractFunctionZeroDataError wording.
        throw new Error(
          `The contract function "${functionName}" returned no data ("0x").`,
        );
      }
      return handlers[functionName];
    },
  };
}

/** A fake client whose every call throws. */
function throwingClient(error: Error): ReadContractClient {
  return {
    readContract: async () => {
      throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// resolveDynavaultAddress — env-injected, pure
// ---------------------------------------------------------------------------

describe("resolveDynavaultAddress", () => {
  it("returns the v2 address when NEXT_PUBLIC_DYNAVAULT_ADDRESS is well-formed", () => {
    expect(
      resolveDynavaultAddress({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR }),
    ).toBe(V2_ADDR);
  });

  it("trims surrounding whitespace (a .env classic)", () => {
    expect(
      resolveDynavaultAddress({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: `  ${V2_ADDR}  ` }),
    ).toBe(V2_ADDR);
  });

  it("returns null when the var is absent or empty", () => {
    expect(resolveDynavaultAddress({})).toBeNull();
    expect(resolveDynavaultAddress({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: "" })).toBeNull();
  });

  it("returns null (never throws) on a malformed value — the browser must not white-screen", () => {
    expect(
      resolveDynavaultAddress({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: "not-an-address" }),
    ).toBeNull();
    expect(
      resolveDynavaultAddress({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: "0x1234" }),
    ).toBeNull();
  });

  it("resolveLegacyVaultAddress honors the canonical name then the alias", () => {
    expect(
      resolveLegacyVaultAddress({
        NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
      }),
    ).toBe(LEGACY_ADDR);
    expect(
      resolveLegacyVaultAddress({ NEXT_PUBLIC_HEARST_VAULT_ADDRESS: ALIAS_ADDR }),
    ).toBe(ALIAS_ADDR);
    // Canonical wins over the alias.
    expect(
      resolveLegacyVaultAddress({
        NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
        NEXT_PUBLIC_HEARST_VAULT_ADDRESS: ALIAS_ADDR,
      }),
    ).toBe(LEGACY_ADDR);
  });
});

// ---------------------------------------------------------------------------
// Mode matrix
// ---------------------------------------------------------------------------

describe("resolveVaultTarget — mode matrix", () => {
  it("v2 when the DynaVault address is set", () => {
    expect(
      resolveVaultTarget({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR }),
    ).toEqual({ mode: "v2", address: V2_ADDR });
  });

  it("v2 wins over legacy when both are set", () => {
    expect(
      resolveVaultTarget({
        NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR,
        NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
      }),
    ).toEqual({ mode: "v2", address: V2_ADDR });
  });

  it("legacy when only the yield-vault address is set", () => {
    expect(
      resolveVaultTarget({ NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR }),
    ).toEqual({ mode: "legacy", address: LEGACY_ADDR });
  });

  it("legacy via the historical alias too", () => {
    expect(
      resolveVaultTarget({ NEXT_PUBLIC_HEARST_VAULT_ADDRESS: ALIAS_ADDR }),
    ).toEqual({ mode: "legacy", address: ALIAS_ADDR });
  });

  it("falls back to legacy when the v2 address is malformed (env.ts is the loud gate)", () => {
    expect(
      resolveVaultTarget({
        NEXT_PUBLIC_DYNAVAULT_ADDRESS: "0xdeadbeef",
        NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
      }),
    ).toEqual({ mode: "legacy", address: LEGACY_ADDR });
  });

  it("not_configured when nothing is set", () => {
    expect(resolveVaultTarget({})).toEqual({
      mode: "not_configured",
      address: null,
    });
  });
});

describe("getVaultMode / getVaultAddress — module constants", () => {
  it("reports v2 when NEXT_PUBLIC_DYNAVAULT_ADDRESS is present at import time", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    expect(mod.getVaultMode()).toBe("v2");
    expect(mod.getVaultAddress()).toBe(V2_ADDR);
  });

  it("reports legacy when only the yield vault is configured", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    expect(mod.getVaultMode()).toBe("legacy");
    expect(mod.getVaultAddress()).toBe(LEGACY_ADDR);
  });

  it("reports not_configured when nothing is configured", async () => {
    const mod = await importWithEnv({});
    expect(mod.getVaultMode()).toBe("not_configured");
    expect(mod.getVaultAddress()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Legacy mode — v2-only reads must be honestly unavailable, never fabricated
// ---------------------------------------------------------------------------

describe("legacy mode — unsupported reads return not_supported_by_legacy", () => {
  it("strategies / mining / electricity / whitelist / vending curve are all unavailable", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    expect(mod.getVaultMode()).toBe("legacy");

    const results = await Promise.all([
      mod.readStrategies(),
      mod.readStrategy(0),
      mod.readMiningMetrics(),
      mod.readElecStatus(),
      mod.readWhitelist(USER_ADDR),
      mod.readVendingCurve(3),
    ]);

    for (const result of results) {
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.reason).toBe(UNAVAILABLE_REASONS.NOT_SUPPORTED_BY_LEGACY);
        // The reason must be actionable, not a shrug.
        expect(result.detail).toContain("NEXT_PUBLIC_DYNAVAULT_ADDRESS");
      }
    }
  });

  it("never touches the chain for an unsupported read (guard fires first)", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    const client = throwingClient(new Error("should never be called"));
    const result = await mod.readMiningMetrics({ client });
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe(UNAVAILABLE_REASONS.NOT_SUPPORTED_BY_LEGACY);
    }
  });

  it("maps totalSupply() → totalShares and reports source=legacy, tvlCap=null", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    // Real on-chain state of 0x2bd14d52…: 12 USDC / 12e18 shares / NAV 1.0000.
    const client = fakeClient({
      totalAssets: 12_000_000n,
      totalSupply: 12_000_000_000_000_000_000n,
      convertToAssets: 1_000_000n,
      asset: USDC_ADDR,
      paused: false,
    });

    const result = await mod.readVaultCore({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;

    expect(result.source).toBe("legacy");
    expect(result.address).toBe(LEGACY_ADDR);
    expect(result.chainId).toBe(84532);
    expect(result.data.totalAssets).toBe(12_000_000n);
    expect(result.data.totalShares).toBe(12_000_000_000_000_000_000n);
    expect(result.data.navPerShare).toBe(1_000_000n);
    expect(result.data.asset).toBe(USDC_ADDR);
    // tvlCap does not exist on the legacy contract → null, never 0.
    expect(result.data.tvlCap).toBeNull();
    expect(result.data.paused).toBe(false);
    // Legacy shares stay 18-dec — verified on-chain, must NOT change.
    expect(result.data.shareDecimals).toBe(18);
  });

  it("maps balanceOf() → shares for a user position in legacy mode", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    const client = fakeClient({
      balanceOf: 11_000_000_000_000_000_000n,
      convertToAssets: 11_000_000n,
    });

    const result = await mod.readUserShares(USER_ADDR, { client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.source).toBe("legacy");
    expect(result.data.shares).toBe(11_000_000_000_000_000_000n);
    expect(result.data.assets).toBe(11_000_000n);
  });
});

// ---------------------------------------------------------------------------
// not_configured mode
// ---------------------------------------------------------------------------

describe("not_configured mode — everything is unavailable / not_deployed", () => {
  it("core, nav and user reads report not_deployed", async () => {
    const mod = await importWithEnv({});
    const results = await Promise.all([
      mod.readVaultCore(),
      mod.readNavPerShare(),
      mod.readUserShares(USER_ADDR),
      mod.readStrategies(),
      mod.readElecStatus(),
    ]);
    for (const result of results) {
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.reason).toBe(UNAVAILABLE_REASONS.NOT_DEPLOYED);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// v2 mode — wired reads
// ---------------------------------------------------------------------------

describe("v2 mode — wired reads", () => {
  it("readVaultCore reads totalShares() (not totalSupply) and tvlCap", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({
      totalAssets: 250_000_000n,
      totalShares: 250_000_000_000_000_000_000n,
      convertToAssets: 1_000_000n,
      asset: USDC_ADDR,
      tvlCap: 10_000_000_000_000n,
    });

    const result = await mod.readVaultCore({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;

    expect(result.source).toBe("v2");
    expect(result.address).toBe(V2_ADDR);
    expect(result.data.totalShares).toBe(250_000_000_000_000_000_000n);
    expect(result.data.tvlCap).toBe(10_000_000_000_000n);
    // The v2.1 spec lists no paused() view → null ("not exposed"), not false.
    expect(result.data.paused).toBeNull();
    expect(result.data.assetDecimals).toBe(6);
    // v2 shares are 6-dec (spec "1:1" with USDC) — NOT the legacy 18.
    expect(result.data.shareDecimals).toBe(6);
    expect(Date.parse(result.readAt)).not.toBeNaN();
  });

  it("readStrategies enumerates getStrategyCount() rows", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({
      getStrategyCount: 2n,
      strategies: [USDC_ADDR, 4500n, true, false],
    });

    const result = await mod.readStrategies({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.index).toBe(0);
    expect(result.data[0]?.adapter).toBe(USDC_ADDR);
    expect(result.data[0]?.allocationBps).toBe(4500n);
    expect(result.data[1]?.index).toBe(1);
  });

  it("readStrategies refuses to enumerate an absurd count (no unbounded loop)", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({ getStrategyCount: 100_000n });

    const result = await mod.readStrategies({ client });
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe(UNAVAILABLE_REASONS.DECODE_ERROR);
    }
  });

  it("readWhitelist derives effectivelyAllowed from permissionDisabled", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });

    const gated = await mod.readWhitelist(USER_ADDR, {
      client: fakeClient({ whitelist: false, permissionDisabled: false }),
    });
    expect(gated.status).toBe("wired");
    if (gated.status === "wired") {
      expect(gated.data.effectivelyAllowed).toBe(false);
    }

    // Gate open to everyone → allowed even though the user is not whitelisted.
    const open = await mod.readWhitelist(USER_ADDR, {
      client: fakeClient({ whitelist: false, permissionDisabled: true }),
    });
    expect(open.status).toBe("wired");
    if (open.status === "wired") {
      expect(open.data.effectivelyAllowed).toBe(true);
    }
  });

  it("readElecStatus decodes the 5-tuple positionally", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({
      elecStatus: [1_500_000n, USER_ADDR, 9_000_000n, 1_752_000_000n, true],
    });

    const result = await mod.readElecStatus({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.data.monthlyElecCost).toBe(1_500_000n);
    expect(result.data.elecPayee).toBe(USER_ADDR);
    expect(result.data.totalElecPaid).toBe(9_000_000n);
    expect(result.data.lastElecPaymentTime).toBe(1_752_000_000n);
    expect(result.data.canPay).toBe(true);
  });

  it("readMiningMetrics exposes the 3rd component as lastReportTime (spec §9.1)", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({
      miningMetrics: [182_000n, 12_345_678n, 1_752_100_000n],
    });

    const result = await mod.readMiningMetrics({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.data.reportedHashrateTh).toBe(182_000n);
    expect(result.data.totalBtcEarnedSats).toBe(12_345_678n);
    expect(result.data.lastReportTime).toBe(1_752_100_000n);
  });

  it("readGovernance reads keeper() + owner()", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({ keeper: USER_ADDR, owner: USDC_ADDR });

    const result = await mod.readGovernance({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.source).toBe("v2");
    expect(result.data.keeper).toBe(USER_ADDR);
    expect(result.data.owner).toBe(USDC_ADDR);
  });

  it("readGovernance decode_errors when keeper()/owner() is not an address", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({ keeper: 42n, owner: USDC_ADDR });

    const result = await mod.readGovernance({ client });
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe(UNAVAILABLE_REASONS.DECODE_ERROR);
    }
  });

  it("readOpsState reads isCurtailed()/currentMonth()/miningNoteMode()", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({
      isCurtailed: true,
      currentMonth: 7n,
      miningNoteMode: false,
    });

    const result = await mod.readOpsState({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.data.isCurtailed).toBe(true);
    expect(result.data.currentMonth).toBe(7n);
    expect(result.data.miningNoteMode).toBe(false);
  });

  it("readOpsState decode_errors when a component has the wrong type", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    // currentMonth() answering with a bool instead of a uint256.
    const client = fakeClient({
      isCurtailed: false,
      currentMonth: true,
      miningNoteMode: true,
    });

    const result = await mod.readOpsState({ client });
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe(UNAVAILABLE_REASONS.DECODE_ERROR);
    }
  });

  it("readProductDurationMonths reads the uint256 term", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({ productDurationMonths: 24n });

    const result = await mod.readProductDurationMonths({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.data.months).toBe(24n);
  });

  it("readProductDurationMonths decode_errors on a non-uint256", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({ productDurationMonths: USER_ADDR });

    const result = await mod.readProductDurationMonths({ client });
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe(UNAVAILABLE_REASONS.DECODE_ERROR);
    }
  });

  it("readConvertToShares previews a deposit in v2 (6-dec shares)", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({ convertToShares: 250_000_000n });

    const result = await mod.readConvertToShares(250_000_000n, { client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.source).toBe("v2");
    expect(result.data.shares).toBe(250_000_000n);
    expect(result.data.assetDecimals).toBe(6);
    expect(result.data.shareDecimals).toBe(6);
  });

  it("readConvertToShares rejects a negative amount without touching the chain", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = throwingClient(new Error("should never be called"));

    const result = await mod.readConvertToShares(-1n, { client });
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe(UNAVAILABLE_REASONS.INVALID_INPUT);
    }
  });

  it("readConvertToShares decode_errors on a non-uint256", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = fakeClient({ convertToShares: USER_ADDR });

    const result = await mod.readConvertToShares(1_000_000n, { client });
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.reason).toBe(UNAVAILABLE_REASONS.DECODE_ERROR);
    }
  });
});

// ---------------------------------------------------------------------------
// New reads — legacy support boundary
// ---------------------------------------------------------------------------

describe("new reads — legacy / not_configured boundary", () => {
  it("v2-only reads (governance / opsState / productDuration) are not_supported_by_legacy", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    const client = throwingClient(new Error("guard must fire before any call"));

    const results = await Promise.all([
      mod.readGovernance({ client }),
      mod.readOpsState({ client }),
      mod.readProductDurationMonths({ client }),
    ]);

    for (const result of results) {
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.reason).toBe(UNAVAILABLE_REASONS.NOT_SUPPORTED_BY_LEGACY);
        expect(result.detail).toContain("NEXT_PUBLIC_DYNAVAULT_ADDRESS");
      }
    }
  });

  it("readConvertToShares works in LEGACY mode (convertToShares is ERC-4626) with 18-dec shares", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    const client = fakeClient({ convertToShares: 12_000_000_000_000_000_000n });

    const result = await mod.readConvertToShares(12_000_000n, { client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.source).toBe("legacy");
    expect(result.data.shares).toBe(12_000_000_000_000_000_000n);
    expect(result.data.shareDecimals).toBe(18);
  });

  it("new v2-only reads report not_deployed when nothing is configured", async () => {
    const mod = await importWithEnv({});
    const results = await Promise.all([
      mod.readGovernance(),
      mod.readOpsState(),
      mod.readProductDurationMonths(),
      mod.readConvertToShares(1_000_000n),
    ]);
    for (const result of results) {
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.reason).toBe(UNAVAILABLE_REASONS.NOT_DEPLOYED);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Share decimals are MODE-DEPENDENT — the silent ×1e12 NAV trap
//
// v2 shares are 6-dec (spec "1:1" with USDC); legacy shares are 18-dec (verified
// on-chain). `convertToAssets` for NAV must be probed with ONE whole share in the
// RIGHT unit — 1e6 in v2, 1e18 in legacy. Probing legacy's 1e18 against a 6-dec
// v2 vault is exactly the 1e12 error this split guards against.
// ---------------------------------------------------------------------------

/** A fake client that records the args each call was made with. */
function capturingClient(handlers: Record<string, unknown>): {
  client: ReadContractClient;
  calls: { functionName: string; args: readonly unknown[] }[];
} {
  const calls: { functionName: string; args: readonly unknown[] }[] = [];
  return {
    calls,
    client: {
      readContract: async ({ functionName, args }) => {
        calls.push({ functionName, args });
        if (!(functionName in handlers)) {
          throw new Error(
            `The contract function "${functionName}" returned no data ("0x").`,
          );
        }
        return handlers[functionName];
      },
    },
  };
}

describe("share decimals track the mode", () => {
  it("v2: readNavPerShare probes ONE 6-dec share and stamps shareDecimals=6", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const { client, calls } = capturingClient({ convertToAssets: 1_000_000n });

    const result = await mod.readNavPerShare({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.data.shareDecimals).toBe(6);
    const nav = calls.find((call) => call.functionName === "convertToAssets");
    expect(nav?.args).toEqual([10n ** 6n]);
  });

  it("legacy: readNavPerShare probes ONE 18-dec share and stamps shareDecimals=18", async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    const { client, calls } = capturingClient({ convertToAssets: 1_000_000n });

    const result = await mod.readNavPerShare({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.data.shareDecimals).toBe(18);
    const nav = calls.find((call) => call.functionName === "convertToAssets");
    expect(nav?.args).toEqual([10n ** 18n]);
  });

  it("v2: readVaultCore probes convertToAssets with 1e6, not 1e18", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const { client, calls } = capturingClient({
      totalAssets: 250_000_000n,
      totalShares: 250_000_000n,
      convertToAssets: 1_000_000n,
      asset: USDC_ADDR,
      tvlCap: 10_000_000_000_000n,
    });

    const result = await mod.readVaultCore({ client });
    expect(result.status).toBe("wired");
    if (result.status !== "wired") return;
    expect(result.data.shareDecimals).toBe(6);
    const nav = calls.find((call) => call.functionName === "convertToAssets");
    expect(nav?.args).toEqual([10n ** 6n]);
  });

  it("v2: readUserShares stamps shareDecimals=6; legacy stamps 18", async () => {
    const v2 = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const v2Result = await v2.readUserShares(USER_ADDR, {
      client: fakeClient({ shares: 5_000_000n, convertToAssets: 5_000_000n }),
    });
    expect(v2Result.status).toBe("wired");
    if (v2Result.status === "wired") {
      expect(v2Result.data.shareDecimals).toBe(6);
    }

    const legacy = await importWithEnv({
      NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: LEGACY_ADDR,
    });
    const legacyResult = await legacy.readUserShares(USER_ADDR, {
      client: fakeClient({
        balanceOf: 11_000_000_000_000_000_000n,
        convertToAssets: 11_000_000n,
      }),
    });
    expect(legacyResult.status).toBe("wired");
    if (legacyResult.status === "wired") {
      expect(legacyResult.data.shareDecimals).toBe(18);
    }
  });
});

// ---------------------------------------------------------------------------
// Failure taxonomy — an outage must stay discernable from an absence
// ---------------------------------------------------------------------------

describe("failure taxonomy", () => {
  it("an RPC outage reports rpc_error (NOT a zero, NOT a revert)", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = throwingClient(
      new Error(
        "HTTP request failed. Status: 503\nURL: https://sepolia.base.org/v2/secret-key",
      ),
    );

    const result = await mod.readVaultCore({ client });
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe(UNAVAILABLE_REASONS.RPC_ERROR);
    // detail is a short single line with URLs stripped.
    expect(result.detail).not.toContain("http");
    expect(result.detail).not.toContain("secret-key");
    expect(result.detail?.length ?? 0).toBeLessThanOrEqual(200);
  });

  it("a missing function (zero data) reports revert, not rpc_error", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    // The classic v2-ABI-against-legacy-bytecode case: totalShares() has no code.
    const client = throwingClient(
      new Error('The contract function "totalShares" returned no data ("0x").'),
    );

    const result = await mod.readVaultCore({ client });
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe(UNAVAILABLE_REASONS.REVERT);
  });

  it("an execution revert reports revert", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = throwingClient(
      new Error('The contract function "strategies" reverted: execution reverted'),
    );

    const result = await mod.readStrategy(0, { client });
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe(UNAVAILABLE_REASONS.REVERT);
  });

  it("a shape mismatch reports decode_error rather than mis-decoding", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    // miningMetrics() answering with 2 components instead of 3 — exactly what a
    // wrong ABI transcription would produce. It must NOT be silently accepted.
    const client = fakeClient({ miningMetrics: [100n, 200n] });

    const result = await mod.readMiningMetrics({ client });
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe(UNAVAILABLE_REASONS.DECODE_ERROR);
  });

  it("rejects a malformed user address without touching the chain", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    const client = throwingClient(new Error("should never be called"));

    const result = await mod.readUserShares("0xnope", { client });
    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe(UNAVAILABLE_REASONS.INVALID_INPUT);
  });

  it("rejects an out-of-bounds vending-curve month", async () => {
    const mod = await importWithEnv({ NEXT_PUBLIC_DYNAVAULT_ADDRESS: V2_ADDR });
    for (const month of [-1, 1.5, 100_000]) {
      const result = await mod.readVendingCurve(month);
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.reason).toBe(UNAVAILABLE_REASONS.INVALID_INPUT);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ABI divergence guards — these lock the v2.1-is-not-ERC-4626 contract
// ---------------------------------------------------------------------------

describe("DYNAVAULT_ABI — the v2.1 divergences from ERC-4626", () => {
  function abiItem(name: string): (typeof DYNAVAULT_ABI)[number] | undefined {
    return DYNAVAULT_ABI.find((item) => item.name === name);
  }

  it("declares totalShares()/shares(address), NOT totalSupply()/balanceOf()", () => {
    expect(abiItem("totalShares")).toBeDefined();
    expect(abiItem("shares")).toBeDefined();
    expect(abiItem("totalSupply")).toBeUndefined();
    expect(abiItem("balanceOf")).toBeUndefined();
  });

  it("declares the NON-STANDARD 3-param Deposit event (different topic0)", () => {
    const deposit = abiItem("Deposit");
    expect(deposit).toBeDefined();
    expect(deposit?.type).toBe("event");
    // The ERC-4626 standard has 4 inputs (sender, owner, assets, shares).
    expect(deposit?.inputs).toHaveLength(3);
    expect(DYNAVAULT_DEPOSIT_EVENT_SIGNATURE).not.toBe(
      LEGACY_DEPOSIT_EVENT_SIGNATURE,
    );
  });

  it("declares Redeem (shares before assets) and drops Withdraw", () => {
    const redeem = abiItem("Redeem");
    expect(redeem?.type).toBe("event");
    expect(redeem?.inputs).toHaveLength(3);
    expect(abiItem("Withdraw")).toBeUndefined();
  });

  it("drops the ERC-4626 preview/max views the spec does not list", () => {
    expect(abiItem("previewDeposit")).toBeUndefined();
    expect(abiItem("previewRedeem")).toBeUndefined();
    expect(abiItem("maxRedeem")).toBeUndefined();
  });

  it("declares swapAndReport with the spec's suspect bytes32[] swapData, unchanged", () => {
    const swap = abiItem("swapAndReport");
    expect(swap).toBeDefined();
    expect(swap?.inputs.map((input) => input.type)).toEqual([
      "address",
      "uint256",
      "address",
      "uint256",
      "address",
      "bytes32[]",
    ]);
  });

  it("declares the owner/keeper write surface the keeper agent needs", () => {
    for (const name of [
      "addToWhitelist",
      "removeFromWhitelist",
      "setKeeper",
      "setTvlCap",
      "setPermissionDisabled",
      "rebalance",
      "payElectricity",
      "reportMiningMetrics",
      "setStrategyAllocation",
      "runMonthlyEngine",
      "curtail",
      "liftCurtailment",
      "executeTakeProfit",
    ]) {
      expect(abiItem(name), `${name} missing from DYNAVAULT_ABI`).toBeDefined();
    }
  });

  it("declares the 12 operational events from spec §4 (beyond Deposit/Redeem)", () => {
    for (const name of [
      "StrategyAdded",
      "StrategyRemoved",
      "Rebalance",
      "VaultSwapped",
      "ElectricityPaid",
      "ElecPayeeUpdated",
      "MonthlyElecCostUpdated",
      "MiningMetricsReported",
      "CurtailmentTriggered",
      "CurtailmentLifted",
      "TakeProfitExecuted",
      "MonthlyEngineRun",
    ]) {
      const event = abiItem(name);
      expect(event, `${name} missing from DYNAVAULT_ABI`).toBeDefined();
      expect(event?.type).toBe("event");
    }
  });

  it("declares the 10 owner/keeper config functions from spec §2", () => {
    for (const name of [
      "addStrategy",
      "removeStrategy",
      "setElecPayee",
      "setMonthlyElecCost",
      "setCurtailmentThresholds",
      "setHalvingMonth",
      "setTakeProfitTier",
      "resetTakeProfitTier",
      "setProductDurationMonths",
      "setMiningNoteMode",
    ]) {
      const fn = abiItem(name);
      expect(fn, `${name} missing from DYNAVAULT_ABI`).toBeDefined();
      expect(fn?.type).toBe("function");
      // Declaration only: nonpayable, no outputs (no write helper is shipped).
      if (fn?.type === "function") {
        expect(fn.stateMutability).toBe("nonpayable");
        expect(fn.outputs).toHaveLength(0);
      }
    }
  });

  it("addStrategy carries the spec's (address, uint256, bool isIdle) signature", () => {
    const fn = abiItem("addStrategy");
    expect(fn?.type).toBe("function");
    if (fn?.type === "function") {
      expect(fn.inputs.map((input) => input.type)).toEqual([
        "address",
        "uint256",
        "bool",
      ]);
    }
  });

  it("declares the view functions the new reads depend on", () => {
    for (const name of [
      "convertToShares",
      "keeper",
      "owner",
      "isCurtailed",
      "currentMonth",
      "miningNoteMode",
      "productDurationMonths",
    ]) {
      const fn = abiItem(name);
      expect(fn, `${name} missing from DYNAVAULT_ABI`).toBeDefined();
      expect(fn?.type).toBe("function");
      if (fn?.type === "function") {
        expect(fn.stateMutability).toBe("view");
      }
    }
  });

  it("miningMetrics() 3rd output is named lastReportTime, not the old guess", () => {
    const fn = abiItem("miningMetrics");
    expect(fn?.type).toBe("function");
    if (fn?.type === "function") {
      expect(fn.outputs.map((o) => o.name)).toEqual([
        "reportedHashrateTh",
        "totalBtcEarnedSats",
        "lastReportTime",
      ]);
    }
  });

  it("the legacy read ABI carries convertToShares (ERC-4626 preview bridge)", () => {
    const names = LEGACY_VAULT_READ_ABI.map((item) => item.name);
    expect(names).toContain("convertToShares");
  });

  it("the legacy read ABI carries the bridge pair totalSupply/balanceOf", () => {
    const names = LEGACY_VAULT_READ_ABI.map((item) => item.name);
    expect(names).toContain("totalSupply");
    expect(names).toContain("balanceOf");
    expect(names).toContain("paused");
    // …and none of the v2-only surface.
    expect(names).not.toContain("totalShares");
    expect(names).not.toContain("whitelist");
  });
});
