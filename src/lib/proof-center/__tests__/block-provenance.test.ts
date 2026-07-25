/**
 * Honesty locks for the Series 1 block-provenance rules (pure module,
 * extracted from hub-data in E5). The core invariant: ABSENCE of a source is
 * "stale" (claims nothing) — never "manual" (claims a human keyed data in),
 * never "live". Row count is not freshness.
 */

import { describe, expect, it } from "vitest";

import {
  attestationBlockProvenance,
  buildSeries1Proof,
  compositeFreshness,
  coverageBlockProvenance,
  custodyBlockProvenance,
  eventBlockProvenance,
  isStale,
} from "@/lib/proof-center/block-provenance";
import type { CoverageView } from "@/lib/engine/coverage-view";
import type { CustodySnapshot } from "@/lib/data/custody";
import type { OnChainAttestation } from "@/lib/chain/por-registry";

const FRESH_ISO = new Date().toISOString();
const OLD_ISO = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

function attestation(timestamp: Date): OnChainAttestation {
  return { timestamp } as unknown as OnChainAttestation;
}

function custody(partial: Partial<CustodySnapshot>): CustodySnapshot {
  return {
    provenance: "live",
    configured: true,
    asOf: FRESH_ISO,
    accountsCount: 1,
    totalUsdcReserves: 100,
    accounts: [],
    ...partial,
  } as unknown as CustodySnapshot;
}

describe("isStale", () => {
  it("null / unparseable / old are stale; fresh is not", () => {
    expect(isStale(null)).toBe(true);
    expect(isStale("not-a-date")).toBe(true);
    expect(isStale(OLD_ISO)).toBe(true);
    expect(isStale(FRESH_ISO)).toBe(false);
  });
});

describe("eventBlockProvenance — row count is not freshness", () => {
  it("no rows → stale (never manual)", () => {
    expect(eventBlockProvenance(0, null)).toBe("stale");
  });
  it("rows but aged newest → stale", () => {
    expect(eventBlockProvenance(3, OLD_ISO)).toBe("stale");
  });
  it("rows with fresh newest → live", () => {
    expect(eventBlockProvenance(3, FRESH_ISO)).toBe("live");
  });
});

describe("attestationBlockProvenance — absence claims nothing", () => {
  it("no attestation → stale, NEVER manual", () => {
    expect(attestationBlockProvenance(null, false)).toBe("stale");
    expect(attestationBlockProvenance(null, true)).toBe("stale");
  });
  it("aged attestation → stale even when verified", () => {
    expect(
      attestationBlockProvenance(attestation(new Date(Date.now() - 25 * 3600 * 1000)), true),
    ).toBe("stale");
  });
  it("fresh + verified → attested; fresh + unverified → oracle", () => {
    expect(attestationBlockProvenance(attestation(new Date()), true)).toBe("attested");
    expect(attestationBlockProvenance(attestation(new Date()), false)).toBe("oracle");
  });
});

describe("custodyBlockProvenance", () => {
  it("no snapshot → stale (never manual)", () => {
    expect(custodyBlockProvenance(null)).toBe("stale");
  });
  it("upstream outage ('unavailable') → stale, not manual", () => {
    expect(custodyBlockProvenance(custody({ provenance: "unavailable" }))).toBe("stale");
  });
  it("live + configured + fresh → live; aged live → stale", () => {
    expect(custodyBlockProvenance(custody({}))).toBe("live");
    expect(custodyBlockProvenance(custody({ asOf: OLD_ISO }))).toBe("stale");
  });
});

describe("coverageBlockProvenance — pending is not manual (E5 lock)", () => {
  const view = (provenance: string): CoverageView =>
    ({ provenance }) as unknown as CoverageView;

  it("live / estimated pass through", () => {
    expect(coverageBlockProvenance(view("live"))).toBe("live");
    expect(coverageBlockProvenance(view("estimated"))).toBe("estimated");
  });
  it("invalid → stale", () => {
    expect(coverageBlockProvenance(view("invalid"))).toBe("stale");
  });
  it("pending → stale, NEVER manual", () => {
    expect(coverageBlockProvenance(view("pending"))).toBe("stale");
  });
  it("missing view → stale", () => {
    expect(coverageBlockProvenance(undefined as unknown as CoverageView)).toBe("stale");
  });
});

describe("compositeFreshness — worst source wins", () => {
  it("no contributing source → stale, never live", () => {
    expect(compositeFreshness([])).toBe("stale");
    expect(compositeFreshness([null, null])).toBe("stale");
  });
  it("all fresh → live; one stale poisons the composite", () => {
    expect(compositeFreshness([FRESH_ISO, FRESH_ISO])).toBe("live");
    expect(compositeFreshness([FRESH_ISO, OLD_ISO])).toBe("stale");
  });
});

describe("buildSeries1Proof — cold platform claims nothing", () => {
  it("all-empty inputs: every block is stale + non-present, zero fabrication", () => {
    const blocks = buildSeries1Proof({
      coverage: undefined as unknown as CoverageView,
      attestation: null,
      attestationVerified: false,
      custody: null,
      onChainEvents: [],
      distributions: [],
    });

    expect(blocks).toHaveLength(7);
    for (const block of blocks) {
      expect(block.provenance).toBe("stale");
      expect(block.state).not.toBe("present");
      expect(block.evidenceCount).toBe(0);
      expect(block.lastUpdated).toBeNull();
    }
  });
});
