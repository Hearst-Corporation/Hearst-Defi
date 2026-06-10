import "server-only";

import { createWalletClient, http, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { env } from "@/lib/env";

import { EVENT_KIND_LABELS, EVENT_LOGGER_ABI, EVENT_LOGGER_WRITE_ABI, type EventKind } from "./abis";
import { getEventLoggerAddress, getHearstPublisherAddress, getPublicClient } from "./client";

/**
 * eth_getLogs window guard — Alchemy free tier rejects ranges wider than
 * ~10 blocks. When no deploy-block is configured we tail the head of the
 * chain so dev still boots; set NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK to
 * widen the window (see P1-4 audit).
 */
const FREE_TIER_BLOCK_WINDOW = 10n;

export type { EventKind };

export interface OnChainEvent {
  eventId: bigint;
  kind: EventKind;
  contextHash: `0x${string}`;
  publisher: `0x${string}`;
  timestamp: Date;
  payloadCid: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

function labelKind(raw: number): EventKind {
  const label = EVENT_KIND_LABELS[raw];
  // Unknown enum values shouldn't reach us if the on-chain enum stays in sync,
  // but fall back deterministically rather than throwing.
  return label ?? "Rebalance";
}

export interface FetchEventsOptions {
  limit?: number;
  fromBlock?: bigint | "earliest";
}

/**
 * Reads `HearstEvent` logs from the EventLogger contract.
 *
 * Filters events by the authorized HEARST_PUBLISHER address to prevent
 * spoofed events from unknown publishers.
 *
 * Never throws: if the contract address is not configured or the RPC call
 * fails, returns an empty list so the Proof Center can fall back to off-chain
 * mocks.
 */
export async function fetchOnChainEvents(
  opts: FetchEventsOptions = {},
): Promise<OnChainEvent[]> {
  const addr = getEventLoggerAddress();
  if (!addr) return [];

  const authorizedPublisher = getHearstPublisherAddress();

  const limit = opts.limit ?? 50;

  try {
    const client = getPublicClient();

    // Resolve a finite `fromBlock` to stay within Alchemy free-tier limits
    // (see P1-4 audit — `eth_getLogs` capped to ~10 blocks). Priority:
    //   1. caller-supplied opts.fromBlock (bigint only — "earliest" is downgraded)
    //   2. NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK env (contract deploy block)
    //   3. fallback: latestBlock - 9 (window of 10 blocks, head of chain)
    let fromBlock: bigint;
    if (typeof opts.fromBlock === "bigint") {
      fromBlock = opts.fromBlock;
    } else if (env.NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK !== undefined) {
      fromBlock = BigInt(env.NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK);
    } else {
      const latest = await client.getBlockNumber();
      fromBlock =
        latest > FREE_TIER_BLOCK_WINDOW - 1n
          ? latest - (FREE_TIER_BLOCK_WINDOW - 1n)
          : 0n;
    }

    const logs = await client.getContractEvents({
      address: addr,
      abi: EVENT_LOGGER_ABI,
      eventName: "HearstEvent",
      fromBlock,
      toBlock: "latest",
    });

    const events: OnChainEvent[] = [];
    for (const log of logs) {
      const args = log.args;
      if (
        args.eventId === undefined ||
        args.kind === undefined ||
        args.contextHash === undefined ||
        args.publisher === undefined ||
        args.timestamp === undefined ||
        args.payloadCid === undefined
      ) {
        continue;
      }

      // Filter: only accept events from the authorized publisher
      if (
        authorizedPublisher &&
        args.publisher.toLowerCase() !== authorizedPublisher.toLowerCase()
      ) {
        continue;
      }

      events.push({
        eventId: args.eventId,
        kind: labelKind(Number(args.kind)),
        contextHash: args.contextHash,
        publisher: args.publisher,
        timestamp: new Date(Number(args.timestamp) * 1000),
        payloadCid: args.payloadCid,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }

    events.sort((a, b) => {
      // Descending by eventId (most recent first).
      if (a.eventId === b.eventId) return 0;
      return a.eventId > b.eventId ? -1 : 1;
    });

    return events.slice(0, limit);
  } catch (err) {
    console.warn("[chain/event-logger] fetchOnChainEvents failed:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

function getRpcUrlForWrite(): string {
  const url = process.env.NEXT_PUBLIC_CHAIN_RPC_URL;
  if (!url || url.trim().length === 0) return "https://sepolia.base.org";
  return url;
}

export interface WriteRebalanceEventOptions {
  eventId: string;    // DB RebalanceEvent id (used as context hash input)
  ruleId: string;
  payloadCid?: string; // optional IPFS CID — empty string if not available
}

/**
 * Writes a Rebalance event to the EventLogger contract on Base Sepolia.
 *
 * Silently returns null when:
 *  - chain is not configured (no contract address in env)
 *  - HEARST_PUBLISHER_PRIVATE_KEY is not set (not a signing environment)
 *
 * Never throws — caller does not need to guard.
 */
export async function writeRebalanceEvent(
  opts: WriteRebalanceEventOptions,
): Promise<`0x${string}` | null> {
  const contractAddr = getEventLoggerAddress();
  if (!contractAddr) return null;

  const privateKey = process.env.HEARST_PUBLISHER_PRIVATE_KEY;
  if (!privateKey) return null;

  // Guard the key format up front so a misconfigured env var (missing 0x,
  // wrong length, whitespace) is rejected explicitly rather than throwing
  // inside privateKeyToAccount. 0x + 64 hex chars = 66 chars total.
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey.trim())) {
    console.warn(
      "[chain/event-logger] HEARST_PUBLISHER_PRIVATE_KEY is malformed — on-chain write skipped",
    );
    return null;
  }

  try {
    const account = privateKeyToAccount(privateKey.trim() as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(getRpcUrlForWrite()),
    });

    // EventKind.Rebalance = 0 (mirrors the on-chain enum order in abis.ts)
    const kindRebalance = 0;
    const contextHash = keccak256(toBytes(`${opts.eventId}:${opts.ruleId}`));
    const payloadCid = opts.payloadCid ?? "";

    const txHash = await walletClient.writeContract({
      address: contractAddr,
      abi: EVENT_LOGGER_WRITE_ABI,
      functionName: "logEvent",
      args: [kindRebalance, contextHash, payloadCid],
    });

    return txHash;
  } catch (err) {
    console.warn("[chain/event-logger] writeRebalanceEvent failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
