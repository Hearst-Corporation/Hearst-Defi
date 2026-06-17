/**
 * Unit tests for src/lib/governance/routing.ts
 *
 * We test computeRoutingDecision (pure) and routeForTransaction (async, mocked
 * DB). No "use server" — importing from routing.ts is fine in test context
 * because server-only is aliased to a no-op in vitest.config.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/governance/allowlist-queries", () => ({
  findAllowlistEntryByAddress: vi.fn(),
  getActiveAllowlistEntries: vi.fn(),
  mapRow: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { findAllowlistEntryByAddress } from "@/lib/governance/allowlist-queries";
import { computeRoutingDecision, routeForTransaction } from "../routing";
import type { AllowlistEntry } from "@/lib/governance/allowlist";
import type { ProposalActionType } from "../routing";

// ── Fixtures ───────────────────────────────────────────────────────────────

const ALLOWLISTED_ENTRY: AllowlistEntry = {
  id: "entry_001",
  address: "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
  label: "Coinbase Custody Vault",
  category: "custody",
  addedBy: "0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef",
  addedAt: new Date("2026-01-01T00:00:00Z"),
  notes: null,
  riskScore: 5,
  active: true,
};

const ADDRESS_ON_LIST = ALLOWLISTED_ENTRY.address;
const ADDRESS_OFF_LIST = "0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef";

// ── beforeEach ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── computeRoutingDecision (pure) ──────────────────────────────────────────

describe("computeRoutingDecision — emergencyShutdown", () => {
  it("returns 5/5 + 0h + notifyBoard=true regardless of allowlist and amount", () => {
    const result = computeRoutingDecision({
      actionType: "emergencyShutdown",
      estimatedAmountUsdc: 50_000,
      allowlistEntry: ALLOWLISTED_ENTRY,
    });

    expect(result.policy.approveQuorum).toBe(5);
    expect(result.policy.cancelQuorum).toBe(2);
    expect(result.policy.timelockHours).toBe(0);
    expect(result.policy.notifyBoard).toBe(true);
    expect(result.isAllowlisted).toBe(false);
    expect(result.allowlistEntry).toBeNull();
  });

  it("emergency: ignores a present allowlistEntry", () => {
    const result = computeRoutingDecision({
      actionType: "emergencyShutdown",
      allowlistEntry: ALLOWLISTED_ENTRY,
    });
    expect(result.policy.approveQuorum).toBe(5);
  });
});

describe("computeRoutingDecision — allowlisted address", () => {
  it("returns 2/3 + 0h + notifyBoard=false for a known-trusted address", () => {
    const result = computeRoutingDecision({
      actionType: "updateFees",
      estimatedAmountUsdc: 500_000,
      allowlistEntry: ALLOWLISTED_ENTRY,
    });

    expect(result.policy.approveQuorum).toBe(2);
    expect(result.policy.cancelQuorum).toBe(2);
    expect(result.policy.timelockHours).toBe(0);
    expect(result.policy.notifyBoard).toBe(false);
    expect(result.isAllowlisted).toBe(true);
    expect(result.allowlistEntry).toEqual(ALLOWLISTED_ENTRY);
  });

  it("allowlisted takes priority over large amount", () => {
    const result = computeRoutingDecision({
      actionType: "sweepFees",
      estimatedAmountUsdc: 10_000_000,
      allowlistEntry: ALLOWLISTED_ENTRY,
    });
    expect(result.policy.approveQuorum).toBe(2);
    expect(result.policy.notifyBoard).toBe(false);
  });
});

describe("computeRoutingDecision — unallowlisted small amount", () => {
  it("returns 3/5 + 12h + notifyBoard=false for amount < 100k", () => {
    const result = computeRoutingDecision({
      actionType: "updateCaps",
      estimatedAmountUsdc: 50_000,
      allowlistEntry: null,
    });

    expect(result.policy.approveQuorum).toBe(3);
    expect(result.policy.cancelQuorum).toBe(2);
    expect(result.policy.timelockHours).toBe(12);
    expect(result.policy.notifyBoard).toBe(false);
    expect(result.isAllowlisted).toBe(false);
  });

  it("99_999 is still small amount (boundary -1)", () => {
    const result = computeRoutingDecision({
      actionType: "pause",
      estimatedAmountUsdc: 99_999,
      allowlistEntry: null,
    });
    expect(result.policy.approveQuorum).toBe(3);
    expect(result.policy.timelockHours).toBe(12);
  });

  it("100_000 falls into sensitive path (boundary exact)", () => {
    const result = computeRoutingDecision({
      actionType: "pause",
      estimatedAmountUsdc: 100_000,
      allowlistEntry: null,
    });
    expect(result.policy.approveQuorum).toBe(4);
    expect(result.policy.timelockHours).toBe(24);
    expect(result.policy.notifyBoard).toBe(true);
  });
});

describe("computeRoutingDecision — unallowlisted large / unknown amount", () => {
  it("returns 4/5 + 24h + notifyBoard=true for large amount", () => {
    const result = computeRoutingDecision({
      actionType: "deploy",
      estimatedAmountUsdc: 1_000_000,
      allowlistEntry: null,
    });

    expect(result.policy.approveQuorum).toBe(4);
    expect(result.policy.cancelQuorum).toBe(2);
    expect(result.policy.timelockHours).toBe(24);
    expect(result.policy.notifyBoard).toBe(true);
    expect(result.isAllowlisted).toBe(false);
  });

  it("returns 4/5 + 24h when estimatedAmountUsdc is undefined (unknown)", () => {
    const result = computeRoutingDecision({
      actionType: "rotateSigners",
      estimatedAmountUsdc: undefined,
      allowlistEntry: null,
    });

    expect(result.policy.approveQuorum).toBe(4);
    expect(result.policy.timelockHours).toBe(24);
    expect(result.policy.notifyBoard).toBe(true);
  });
});

// ── routeForTransaction (async) ────────────────────────────────────────────

describe("routeForTransaction — DB integration (mocked)", () => {
  it("resolves allowlisted entry → 2/3 fast path", async () => {
    vi.mocked(findAllowlistEntryByAddress).mockResolvedValue(ALLOWLISTED_ENTRY);

    const result = await routeForTransaction({
      targetAddress: ADDRESS_ON_LIST,
      actionType: "sweepFees",
      estimatedAmountUsdc: 200_000,
    });

    expect(findAllowlistEntryByAddress).toHaveBeenCalledWith(ADDRESS_ON_LIST);
    expect(result.policy.approveQuorum).toBe(2);
    expect(result.isAllowlisted).toBe(true);
  });

  it("resolves unknown address → sensitive path", async () => {
    vi.mocked(findAllowlistEntryByAddress).mockResolvedValue(null);

    const result = await routeForTransaction({
      targetAddress: ADDRESS_OFF_LIST,
      actionType: "updateFees",
      estimatedAmountUsdc: 500_000,
    });

    expect(result.policy.approveQuorum).toBe(4);
    expect(result.policy.timelockHours).toBe(24);
    expect(result.policy.notifyBoard).toBe(true);
  });

  it("skips DB lookup for emergencyShutdown", async () => {
    const result = await routeForTransaction({
      targetAddress: ADDRESS_ON_LIST,
      actionType: "emergencyShutdown",
    });

    // DB should NOT be queried for emergency shutdown
    expect(findAllowlistEntryByAddress).not.toHaveBeenCalled();
    expect(result.policy.approveQuorum).toBe(5);
    expect(result.policy.notifyBoard).toBe(true);
  });

  it("small amount + unknown address → medium 3/5 path", async () => {
    vi.mocked(findAllowlistEntryByAddress).mockResolvedValue(null);

    const result = await routeForTransaction({
      targetAddress: ADDRESS_OFF_LIST,
      actionType: "pause",
      estimatedAmountUsdc: 25_000,
    });

    expect(result.policy.approveQuorum).toBe(3);
    expect(result.policy.timelockHours).toBe(12);
    expect(result.policy.notifyBoard).toBe(false);
  });
});

// ── reason strings ─────────────────────────────────────────────────────────

describe("computeRoutingDecision — reason strings", () => {
  it("emergency reason mentions board notification", () => {
    const { reason } = computeRoutingDecision({
      actionType: "emergencyShutdown",
      allowlistEntry: null,
    });
    expect(reason).toMatch(/5\/5/);
    expect(reason).toMatch(/board/i);
  });

  it("allowlisted reason includes entry label and category", () => {
    const { reason } = computeRoutingDecision({
      actionType: "deploy",
      allowlistEntry: ALLOWLISTED_ENTRY,
    });
    expect(reason).toMatch(/Coinbase Custody Vault/);
    expect(reason).toMatch(/custody/);
  });

  it("small amount reason includes formatted amount", () => {
    const { reason } = computeRoutingDecision({
      actionType: "updateCaps",
      estimatedAmountUsdc: 50_000,
      allowlistEntry: null,
    });
    expect(reason).toMatch(/50,000/);
    expect(reason).toMatch(/100k/);
  });

  it("sensitive reason mentions board notification", () => {
    const { reason } = computeRoutingDecision({
      actionType: "rotateSigners",
      estimatedAmountUsdc: undefined,
      allowlistEntry: null,
    });
    expect(reason).toMatch(/board/i);
  });
});

// ── all action types compile ───────────────────────────────────────────────

describe("computeRoutingDecision — all non-emergency action types", () => {
  const nonEmergencyActions: ProposalActionType[] = [
    "deploy",
    "pause",
    "unpause",
    "updateFees",
    "updateCaps",
    "rotateSigners",
    "sweepFees",
  ];

  it.each(nonEmergencyActions)(
    "%s with allowlisted address → 2/3 quorum",
    (actionType) => {
      const result = computeRoutingDecision({ actionType, allowlistEntry: ALLOWLISTED_ENTRY });
      expect(result.policy.approveQuorum).toBe(2);
    },
  );
});
