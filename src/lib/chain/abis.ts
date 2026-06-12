/**
 * Hand-written ABIs for the Phase 2 Hearst contracts.
 *
 * Source of truth: `/contracts/src/EventLogger.sol` and `/contracts/src/PoRRegistry.sol`.
 * Re-export only what the Proof Center reads (events + view functions).
 *
 * NOTE: kept const-asserted so viem can fully type the args/return values.
 */

export const EVENT_LOGGER_ABI = [
  {
    type: "event",
    name: "HearstEvent",
    inputs: [
      { name: "eventId", type: "uint256", indexed: true },
      { name: "kind", type: "uint8", indexed: true },
      { name: "contextHash", type: "bytes32", indexed: true },
      { name: "publisher", type: "address", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
      { name: "payloadCid", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "lastEventId",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "publisher",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "logEvent",
    inputs: [
      { name: "kind", type: "uint8" },
      { name: "contextHash", type: "bytes32" },
      { name: "payloadCid", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Write-side ABI subset — just `logEvent`.
 * Kept separate so viem can const-type the read ABI without mixing readonly tuples.
 */
export const EVENT_LOGGER_WRITE_ABI = [
  {
    type: "function",
    name: "logEvent",
    inputs: [
      { name: "kind", type: "uint8" },
      { name: "contextHash", type: "bytes32" },
      { name: "payloadCid", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const POR_REGISTRY_ABI = [
  {
    type: "event",
    name: "AttestationPublished",
    inputs: [
      { name: "attestationId", type: "uint256", indexed: true },
      { name: "period", type: "uint64", indexed: true },
      { name: "attestor", type: "address", indexed: true },
      { name: "totalAumUsd", type: "uint256", indexed: false },
      { name: "minedBtcSats", type: "uint256", indexed: false },
      { name: "evidenceHash", type: "bytes32", indexed: false },
      { name: "evidenceCid", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "lastAttestationId",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "publisher",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    // Auto-generated getter for `mapping(uint256 => Attestation) public attestations`.
    // Solidity flattens the struct into a tuple, dropping nested mappings (none here).
    type: "function",
    name: "attestations",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "timestamp", type: "uint64" },
      { name: "totalAumUsd", type: "uint256" },
      { name: "minedBtcSats", type: "uint256" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "evidenceCid", type: "string" },
      { name: "attestor", type: "address" },
    ],
    stateMutability: "view",
  },
] as const;

/**
 * Write-side ABI subset for PoRRegistry — just `publish`.
 * Kept separate (same pattern as EVENT_LOGGER_WRITE_ABI) so viem can
 * const-type the write call without merging into the read ABI tuple.
 */
export const POR_REGISTRY_WRITE_ABI = [
  {
    type: "function",
    name: "publish",
    inputs: [
      { name: "period", type: "uint64" },
      { name: "totalAumUsd", type: "uint256" },
      { name: "minedBtcSats", type: "uint256" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "evidenceCid", type: "string" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * EventKind enum mirror — order MUST match `EventLogger.sol`.
 */
export const EVENT_KIND_LABELS = [
  "Rebalance",
  "Distribution",
  "ModeChange",
  "GuardrailBreach",
  "TriggerArmed",
  "AttestationPublished",
] as const;

export type EventKind = (typeof EVENT_KIND_LABELS)[number];
