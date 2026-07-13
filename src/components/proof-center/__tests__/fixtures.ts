import type { OnChainEvent } from "@/lib/chain/event-logger";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { CustodySnapshot } from "@/lib/data/custody";

export function freshAttestation(): OnChainAttestation {
  return {
    attestationId: 1n,
    period: 202605n,
    attestor: "0x1111111111111111111111111111111111111111",
    totalAumUsd: 25_000_000,
    minedBtc: 12.3456,
    rawTotalAumUsd: 25_000_000_000_000n,
    rawMinedBtcSats: 1_234_560_000n,
    evidenceHash: "0xabc",
    evidenceCid: "ipfs://QmTest",
    timestamp: new Date(),
    txHash: "0xdef",
    blockNumber: 123n,
  };
}

export function freshEvent(): OnChainEvent {
  return {
    eventId: 42n,
    kind: "Distribution",
    contextHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    publisher: "0x1111111111111111111111111111111111111111",
    timestamp: new Date("2026-05-01T12:00:00Z"),
    payloadCid: "",
    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    blockNumber: 9_001n,
  };
}

export function zeroReservesCustody(): CustodySnapshot {
  return {
    provenance: "manual",
    configured: false,
    asOf: new Date().toISOString(),
    accountsCount: 0,
    totalUsdcReserves: 0,
    totalBtcReserves: 0,
    accounts: [],
  };
}
