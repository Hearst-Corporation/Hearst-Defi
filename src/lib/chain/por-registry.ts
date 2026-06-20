import "server-only";

import { env } from "@/lib/env";

import { POR_REGISTRY_ABI, POR_REGISTRY_WRITE_ABI } from "./abis";
import { getPoRRegistryAddress, getPublicClient } from "./client";
import { getPublisherWalletClient } from "./publisher";

/**
 * eth_getLogs window guard — Alchemy free tier rejects ranges wider than
 * ~10 blocks. When no deploy-block is configured we tail the head of the
 * chain so dev still boots; set NEXT_PUBLIC_POR_REGISTRY_DEPLOY_BLOCK to
 * widen the window (see P1-4 audit).
 */
const FREE_TIER_BLOCK_WINDOW = 10n;

export interface OnChainAttestation {
  attestationId: bigint;
  period: bigint; // YYYYMM
  attestor: `0x${string}`;
  /** Total AUM in USD (6-decimal USDC convention) → human-readable number. */
  totalAumUsd: number;
  /** Mining output in BTC (converted from sats). */
  minedBtc: number;
  rawTotalAumUsd: bigint;
  rawMinedBtcSats: bigint;
  evidenceHash: `0x${string}`;
  evidenceCid: string;
  timestamp: Date;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

export interface FetchAttestationsOptions {
  limit?: number;
  fromBlock?: bigint | "earliest";
}

const USDC_DECIMALS = 6n;

function fromBaseUnits(raw: bigint, decimals: bigint): number {
  // Safe for typical USD AUM values; PoR pinning is informational, not balance accounting.
  const divisor = 10n ** decimals;
  const whole = raw / divisor;
  const frac = raw % divisor;
  // Avoid scientific notation while keeping precision for the UI.
  return Number(whole) + Number(frac) / Number(divisor);
}

/**
 * Reads `AttestationPublished` logs from the PoRRegistry contract.
 *
 * Never throws. Returns descending-by-id, capped at `limit` (default 12).
 *
 */
export async function fetchOnChainAttestations(
  opts: FetchAttestationsOptions = {},
): Promise<OnChainAttestation[]> {
  const addr = getPoRRegistryAddress();
  if (!addr) return [];

  const limit = opts.limit ?? 12;

  try {
    const client = getPublicClient();

    // Resolve a finite `fromBlock` to stay within Alchemy free-tier limits
    // (see P1-4 audit — `eth_getLogs` capped to ~10 blocks). Priority:
    //   1. caller-supplied opts.fromBlock (bigint only — "earliest" is downgraded)
    //   2. NEXT_PUBLIC_POR_REGISTRY_DEPLOY_BLOCK env (contract deploy block)
    //   3. fallback: latestBlock - 9 (window of 10 blocks, head of chain)
    let fromBlock: bigint;
    if (typeof opts.fromBlock === "bigint") {
      fromBlock = opts.fromBlock;
    } else if (env.NEXT_PUBLIC_POR_REGISTRY_DEPLOY_BLOCK !== undefined) {
      fromBlock = BigInt(env.NEXT_PUBLIC_POR_REGISTRY_DEPLOY_BLOCK);
    } else {
      const latest = await client.getBlockNumber();
      fromBlock =
        latest > FREE_TIER_BLOCK_WINDOW - 1n
          ? latest - (FREE_TIER_BLOCK_WINDOW - 1n)
          : 0n;
    }

    const logs = await client.getContractEvents({
      address: addr,
      abi: POR_REGISTRY_ABI,
      eventName: "AttestationPublished",
      fromBlock,
      toBlock: "latest",
    });

    const attestations: OnChainAttestation[] = [];
    for (const log of logs) {
      const args = log.args;
      if (
        args.attestationId === undefined ||
        args.period === undefined ||
        args.attestor === undefined ||
        args.totalAumUsd === undefined ||
        args.minedBtcSats === undefined ||
        args.evidenceHash === undefined ||
        args.evidenceCid === undefined
      ) {
        continue;
      }

      const block = await client
        .getBlock({ blockNumber: log.blockNumber })
        .catch(() => null);

      attestations.push({
        attestationId: args.attestationId,
        period: args.period,
        attestor: args.attestor,
        totalAumUsd: fromBaseUnits(args.totalAumUsd, USDC_DECIMALS),
        minedBtc: fromBaseUnits(args.minedBtcSats, 8n),
        rawTotalAumUsd: args.totalAumUsd,
        rawMinedBtcSats: args.minedBtcSats,
        evidenceHash: args.evidenceHash,
        evidenceCid: args.evidenceCid,
        timestamp: block
          ? new Date(Number(block.timestamp) * 1000)
          : new Date(0),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }

    attestations.sort((a, b) => {
      if (a.attestationId === b.attestationId) return 0;
      return a.attestationId > b.attestationId ? -1 : 1;
    });

    return attestations.slice(0, limit);
  } catch (err) {
    console.warn(
      "[chain/por-registry] fetchOnChainAttestations failed:",
      err,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

export interface PublishAttestationOptions {
  period: bigint;       // YYYYMM encoded as uint64
  totalAumUsd: bigint;  // 6-decimal USDC base units (uint256)
  minedBtcSats: bigint; // satoshis (uint256)
  evidenceHash: `0x${string}`; // bytes32 hash of the evidence document
  evidenceCid?: string; // optional IPFS CID for the evidence document
}

/**
 * Publishes a Proof-of-Reserves attestation to the PoRRegistry contract on
 * Base Sepolia.
 *
 * Gated on the publisher key — silently returns null (disarmed) when:
 *  - HEARST_PUBLISHER_PRIVATE_KEY is absent or malformed
 *  - NEXT_PUBLIC_POR_REGISTRY_ADDRESS is not configured
 *
 * Never throws — caller does not need to guard.
 *
 * Returns the transaction hash on success, null when disarmed or on error.
 *
 * ⚠️  Testnet-only: always targets Base Sepolia. Mainnet deployment is gated
 * on a completed Spearbit audit (ADR-006).
 */
export async function publishAttestation(
  opts: PublishAttestationOptions,
): Promise<`0x${string}` | null> {
  const contractAddr = getPoRRegistryAddress();
  if (!contractAddr) return null;

  const walletClient = getPublisherWalletClient();
  if (!walletClient) return null;

  try {
    const txHash = await walletClient.writeContract({
      address: contractAddr,
      abi: POR_REGISTRY_WRITE_ABI,
      functionName: "publish",
      args: [
        opts.period,
        opts.totalAumUsd,
        opts.minedBtcSats,
        opts.evidenceHash,
        opts.evidenceCid ?? "",
      ],
      account: walletClient.account!,
      chain: walletClient.chain,
    });

    return txHash;
  } catch (err) {
    console.warn(
      "[chain/por-registry] publishAttestation failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

