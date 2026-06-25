// src/lib/onchain/vault.ts
//
// Real viem helpers for ERC-20 approve + ERC-4626 deposit against the
// Hearst Yield Vault deployed on Base Sepolia.
//
// Design contracts:
//  - All addresses are resolved from NEXT_PUBLIC_* env vars (public, not secret).
//  - Every function requires a connected WalletClient (from Privy's
//    `getEthereumProvider` / `createWalletClient`). No WalletClient = explicit
//    error thrown — never a fake txHash.
//  - `publicClient` is caller-supplied for `waitForTransactionReceipt`; callers
//    that can't supply one get a typed `ConfigError` rather than a silent fail.
//  - ABI is declared inline — no imports from `contracts/out/`.

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type Abi,
  type Hex,
  type WalletClient,
  type PublicClient,
  type Address,
} from "viem";
import { getDeployment } from "@/lib/chain/deployments";
// Privy's EIP1193Provider uses `on(eventName: string, ...)` which is structurally
// narrower than viem's generic-overloaded signature. Bridging via `unknown` is the
// only safe cast — we never use the `on`/`removeListener` methods ourselves, and
// the `request` method matches exactly. See vault.ts: walletClientFromProvider.
type ViemCompatibleProvider = Parameters<typeof custom>[0];
import { baseSepolia } from "viem/chains";

// ---------------------------------------------------------------------------
// Addresses — from NEXT_PUBLIC_* env (public, safe in browser bundles)
// ---------------------------------------------------------------------------

const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Resolves the vault address from env, trying the canonical name first then
 * the legacy alias.  Exported for unit-testing without module re-import.
 *
 * Canonical: NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS
 * Legacy alias: NEXT_PUBLIC_HEARST_VAULT_ADDRESS
 */
/** Validate + normalise a raw env string into an Address, or null. */
function normaliseAddress(raw: string | undefined): Address | null {
  if (!raw) return null;
  const t = raw.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(t) ? (t as Address) : null;
}

export function resolveVaultAddress(
  env: Record<string, string | undefined> = process.env,
): Address | null {
  return normaliseAddress(
    env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS ??
      env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS,
  );
}

/**
 * The deployed ERC-4626 vault address.
 *
 * IMPORTANT: read `process.env.NEXT_PUBLIC_*` TEXTUALLY here. Next/Turbopack
 * only inlines NEXT_PUBLIC_* vars into the client bundle when accessed as a
 * literal `process.env.NEXT_PUBLIC_FOO` expression. Going through the indirect
 * `resolveVaultAddress(env)` param (where `env` is a variable) is NOT statically
 * substituted, so the browser saw `undefined` → VAULT_ADDRESS=null → the invest
 * flow showed "Configuration pending" forever. The literal reads below fix that.
 * `resolveVaultAddress` stays exported for unit tests (they inject a fake env).
 */
export const VAULT_ADDRESS: Address | null =
  normaliseAddress(process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS) ??
  normaliseAddress(process.env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS);
const VAULT_DEPLOYMENT = getDeployment("vault");

/** The USDC token address on Base Sepolia. */
export const USDC_ADDRESS: Address =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export function isVaultStale(): boolean {
  return VAULT_DEPLOYMENT.meta.stale;
}

/** USDC has 6 decimals on all chains. */
const USDC_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Minimal ABIs (inline — no contracts/out imports)
// ---------------------------------------------------------------------------

const ERC20_ABI = [
  {
    name: "approve",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ERC4626_ABI = [
  {
    name: "deposit",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "previewDeposit",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "asset",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "balanceOf",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // redeem(shares, receiver, owner) — burns `shares`, sends underlying USDC to
    // `receiver`. The exit path mirror of deposit. Gated by whenNotPaused on-chain.
    name: "redeem",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "maxRedeem",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "previewRedeem",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    // totalAssets() → total USDC (6-decimal) managed by the vault.
    name: "totalAssets",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // convertToAssets(shares) → USDC assets for 1e18 shares — used to derive NAV per share.
    name: "convertToAssets",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Typed error classes — callers distinguish config vs chain vs contract errors
// ---------------------------------------------------------------------------

export class ConfigError extends Error {
  readonly code = "CONFIG_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ChainError extends Error {
  readonly code = "CHAIN_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "ChainError";
  }
}

/** Shared helper for write-and-wait-receipt flow. */
async function writeContractAndAwaitReceipt(
  walletClient: WalletClient,
  params: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
  },
): Promise<Hex> {
  const account = walletClient.account;
  if (!account) {
    throw new ConfigError("WalletClient has no account. Reconnect your wallet.");
  }

  const txHash = await walletClient.writeContract({
    ...params,
    account,
    chain: baseSepolia,
  });

  const publicClient = getBrowserPublicClient();
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return txHash;
}

// ---------------------------------------------------------------------------
// Public client factory (client-side) — not server-only; used in "use client"
// components. Separate from src/lib/chain/client.ts which is server-only.
// ---------------------------------------------------------------------------

function buildPublicClientBrowser(): PublicClient {
  const rpc =
    process.env.NEXT_PUBLIC_CHAIN_RPC_URL?.trim() || "https://sepolia.base.org";
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpc, { timeout: 10_000, retryCount: 2 }),
  }) as PublicClient;
}

// Lazily instantiated once per browser session.
let _cachedPublicClient: PublicClient | null = null;
export function getBrowserPublicClient(): PublicClient {
  if (!_cachedPublicClient) {
    _cachedPublicClient = buildPublicClientBrowser();
  }
  return _cachedPublicClient;
}

// ---------------------------------------------------------------------------
// Wallet client factory from a Privy / EIP-1193 provider
// ---------------------------------------------------------------------------

export function walletClientFromProvider(
  // `unknown` accepts both viem's EIP1193Provider and Privy's narrower variant
  // (whose `.on` signature differs in ways that are irrelevant at runtime).
  // We do NOT expose `any` — callers that pass an unexpected shape will discover
  // it at `writeContract` time from viem's own runtime checks.
  provider: unknown,
  address: Address,
): WalletClient {
  const viemProvider = provider as ViemCompatibleProvider;
  return createWalletClient({
    account: address,
    chain: baseSepolia,
    transport: custom(viemProvider),
  });
}

// ---------------------------------------------------------------------------
// Chain guard — verifies the wallet is on Base Sepolia before transacting
// ---------------------------------------------------------------------------

export async function assertBaseSepolia(walletClient: WalletClient): Promise<void> {
  const chainId = await walletClient.getChainId();
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new ChainError(
      `Wallet is on chain ${chainId}. Switch to Base Sepolia (84532) before transacting.`,
    );
  }
}

// ---------------------------------------------------------------------------
// ERC-20 approve
// ---------------------------------------------------------------------------

export interface ApproveUsdcOpts {
  walletClient: WalletClient;
  /** USDC amount in whole dollars (integer). Internally converted to 6-decimal units. */
  amountUsdc: number;
}

export interface ApproveUsdcResult {
  txHash: Hex;
}

/**
 * Sends an ERC-20 `approve(vault, amount)` on behalf of the connected wallet.
 *
 * Throws `ConfigError` if NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (or legacy
 * alias NEXT_PUBLIC_HEARST_VAULT_ADDRESS) is unset.
 * Throws `ChainError`  if the wallet is not on Base Sepolia.
 * Throws the underlying viem/RPC error for any contract-level rejection.
 */
export async function approveUsdc(opts: ApproveUsdcOpts): Promise<ApproveUsdcResult> {
  if (!VAULT_ADDRESS) {
    throw new ConfigError(
      "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS is not configured. " +
        "Set NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (or legacy NEXT_PUBLIC_HEARST_VAULT_ADDRESS) " +
        "to enable on-chain transactions.",
    );
  }

  await assertBaseSepolia(opts.walletClient);

  const amount = parseUnits(String(opts.amountUsdc), USDC_DECIMALS);

  const txHash = await writeContractAndAwaitReceipt(opts.walletClient, {
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [VAULT_ADDRESS, amount],
  });

  return { txHash };
}

// ---------------------------------------------------------------------------
// ERC-4626 deposit
// ---------------------------------------------------------------------------

export interface DepositToVaultOpts {
  walletClient: WalletClient;
  /** USDC amount in whole dollars (integer). */
  amountUsdc: number;
  /** Receiver of the vault shares — usually the same as the connected wallet. */
  receiver: Address;
}

export interface DepositToVaultResult {
  txHash: Hex;
  amountUsdc: number;
}

/**
 * Calls `vault.deposit(assets, receiver)`.
 * Assumes the caller has already approved a sufficient USDC allowance.
 *
 * Throws `ConfigError` if NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (or legacy
 * alias NEXT_PUBLIC_HEARST_VAULT_ADDRESS) is unset.
 * Throws `ChainError`  if the wallet is not on Base Sepolia.
 */
export async function depositToVault(
  opts: DepositToVaultOpts,
): Promise<DepositToVaultResult> {
  if (!VAULT_ADDRESS) {
    throw new ConfigError(
      "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS is not configured. " +
        "Set NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS (or legacy NEXT_PUBLIC_HEARST_VAULT_ADDRESS) " +
        "to enable on-chain transactions.",
    );
  }

  await assertBaseSepolia(opts.walletClient);

  const assets = parseUnits(String(opts.amountUsdc), USDC_DECIMALS);

  const txHash = await writeContractAndAwaitReceipt(opts.walletClient, {
    address: VAULT_ADDRESS,
    abi: ERC4626_ABI,
    functionName: "deposit",
    args: [assets, opts.receiver],
  });

  return { txHash, amountUsdc: opts.amountUsdc };
}


// ---------------------------------------------------------------------------
// ERC-4626 redeem (withdrawal exit path)
// ---------------------------------------------------------------------------

/**
 * Max shares `owner` can redeem right now (0 when paused, capped by balance).
 * Returns 0n if the vault address is not configured.
 */
export async function readMaxRedeem(owner: Address): Promise<bigint> {
  if (!VAULT_ADDRESS) return 0n;
  const publicClient = getBrowserPublicClient();
  return publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: ERC4626_ABI,
    functionName: "maxRedeem",
    args: [owner],
  });
}

/**
 * Preview the USDC assets returned for redeeming `shares` (whole-dollar,
 * truncated). Returns 0 if the vault address is not configured.
 */
export async function previewRedeemUsdc(shares: bigint): Promise<number> {
  if (!VAULT_ADDRESS) return 0;
  const publicClient = getBrowserPublicClient();
  const assets = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: ERC4626_ABI,
    functionName: "previewRedeem",
    args: [shares],
  });
  return Number(assets / BigInt(10 ** USDC_DECIMALS));
}

export interface RedeemFromVaultOpts {
  walletClient: WalletClient;
  /**
   * Vault shares to redeem (raw 18-decimal share units). Pass the value from
   * readVaultShares()/readMaxRedeem() — never a whole-dollar number.
   */
  shares: bigint;
  /** Receiver of the underlying USDC — usually the connected wallet. */
  receiver: Address;
  /** Share owner whose shares are burned — the connected wallet. */
  owner: Address;
}

export interface RedeemFromVaultResult {
  txHash: Hex;
  /** USDC assets received, whole-dollar (truncated), from the receipt preview. */
  assetsUsdc: number;
}

/**
 * Calls `vault.redeem(shares, receiver, owner)` — the ERC-4626 exit path. Burns
 * the caller's vault shares and returns the underlying USDC.
 *
 * Throws `ConfigError` if the vault address is unset.
 * Throws `ChainError`  if the wallet is not on Base Sepolia.
 */
export async function redeemFromVault(
  opts: RedeemFromVaultOpts,
): Promise<RedeemFromVaultResult> {
  if (!VAULT_ADDRESS) {
    throw new ConfigError(
      "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS is not configured. " +
        "Set it (or legacy NEXT_PUBLIC_HEARST_VAULT_ADDRESS) to enable redemptions.",
    );
  }

  await assertBaseSepolia(opts.walletClient);

  const account = opts.walletClient.account;
  if (!account) {
    throw new ConfigError("WalletClient has no account. Reconnect your wallet.");
  }

  // Quote the USDC out before redeeming so the confirmation can show a figure.
  const assetsUsdc = await previewRedeemUsdc(opts.shares);

  const txHash = await writeContractAndAwaitReceipt(opts.walletClient, {
    address: VAULT_ADDRESS,
    abi: ERC4626_ABI,
    functionName: "redeem",
    args: [opts.shares, opts.receiver, opts.owner],
  });

  return { txHash, assetsUsdc };
}

// ---------------------------------------------------------------------------
// Read-only NAV helpers — caller supplies a ReadContractClient so these work
// in BOTH server components (pass getPublicClient() from src/lib/chain/client.ts)
// AND browser components (pass getBrowserPublicClient()).
//
// We use a structural interface rather than viem's `PublicClient` to avoid the
// dual-viem-version collision that surfaces when @walletconnect/utils pins an
// older viem alongside ours. Both createPublicClient instances satisfy this shape.
// ---------------------------------------------------------------------------

/**
 * Minimal structural type for a viem client that can call readContract.
 * Params/result stay deliberately loose (not viem's generic ReadContractParameters)
 * to dodge the dual-viem-version collision documented above — call sites cast the
 * awaited result to the concrete return type (e.g. `as Promise<bigint>`).
 */
type ReadContractArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};
type ReadContractClient = {
  readContract: (params: ReadContractArgs) => Promise<unknown>;
};

/** 1e18 share units — ERC-4626 shares use 18 decimals. */
const ONE_SHARE = BigInt(10 ** 18);

/**
 * Total USDC assets under management in the vault (6-decimal raw value).
 * Returns null when the vault address is not configured.
 *
 * @param client - A viem PublicClient. From a Server Component pass
 *   `getPublicClient()` (src/lib/chain/client.ts); from a browser context
 *   pass `getBrowserPublicClient()`.
 */
async function readTotalAssets(client: ReadContractClient): Promise<bigint | null> {
  if (!VAULT_ADDRESS) return null;
  return client.readContract({
    address: VAULT_ADDRESS,
    abi: ERC4626_ABI,
    functionName: "totalAssets",
    args: [],
  }) as Promise<bigint>;
}

/**
 * NAV per share, expressed as a 6-decimal USDC raw value (e.g. 1_000_000n = 1.000000 USDC).
 * Derived from `convertToAssets(1e18)` — the canonical ERC-4626 way to get price-per-share.
 * Returns null when the vault address is not configured.
 *
 * @param client - A viem PublicClient. From a Server Component pass
 *   `getPublicClient()` (src/lib/chain/client.ts); from a browser context
 *   pass `getBrowserPublicClient()`.
 */
export async function readNavPerShare(client: ReadContractClient): Promise<bigint | null> {
  if (!VAULT_ADDRESS) return null;
  return client.readContract({
    address: VAULT_ADDRESS,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: [ONE_SHARE],
  }) as Promise<bigint>;
}

/**
 * Format a raw 6-decimal USDC NAV value (from readNavPerShare) as a display
 * string, e.g. 1_000_000n → "1.0000".
 */
export function formatNavPerShare(raw: bigint): string {
  const whole = raw / BigInt(10 ** USDC_DECIMALS);
  const frac = raw % BigInt(10 ** USDC_DECIMALS);
  return `${whole.toString()}.${frac.toString().padStart(USDC_DECIMALS, "0").slice(0, 4)}`;
}
