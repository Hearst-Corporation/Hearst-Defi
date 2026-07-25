import { describe, expect, it } from "vitest";

import {
  buildOperatingKpis,
  resolveOperatingReadiness,
  worstTone,
} from "@/lib/admin/dashboard-operating-view";
import type { AdminProofStatus } from "@/lib/data/admin-overview";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROOF_BASE: AdminProofStatus = {
  lastMiningAttestationAt: new Date("2026-07-01T00:00:00Z"),
  miningFreshness: "live",
  attestationsCount: 3,
  proofsTotal: 7,
  custodyConfigured: true,
  custodyProvenance: "live",
  custodyReservesUsdc: 1_250_000,
};

function readiness(overrides: {
  proof?: Partial<AdminProofStatus>;
  operatorQueueCount?: number | null;
  auditEntryCount?: number | null;
  vaultMode?: "v2" | "legacy" | "not_configured";
}) {
  // NB: `in` checks, not `??` — a deliberate `null` (read failed) must reach
  // the resolver instead of being swallowed by a nullish default.
  return resolveOperatingReadiness({
    proof: { ...PROOF_BASE, ...overrides.proof },
    operatorQueueCount:
      "operatorQueueCount" in overrides
        ? (overrides.operatorQueueCount ?? null)
        : 0,
    auditEntryCount:
      "auditEntryCount" in overrides ? (overrides.auditEntryCount ?? null) : 5,
    vaultMode: overrides.vaultMode ?? "v2",
  });
}

function factor(view: ReturnType<typeof resolveOperatingReadiness>, id: string) {
  const f = view.factors.find((x) => x.id === id);
  if (!f) throw new Error(`factor ${id} missing`);
  return f;
}

// ---------------------------------------------------------------------------
// Custody — the outage branch is its own honest state (TOP6)
// ---------------------------------------------------------------------------

describe("custody factor", () => {
  it("a custody outage reads Unreachable/alert — NEVER 'Manual'", () => {
    const view = readiness({
      proof: { custodyProvenance: "unavailable", custodyReservesUsdc: null },
    });
    const custody = factor(view, "custody");
    expect(custody.status).toBe("Unreachable");
    expect(custody.tone).toBe("alert");
    expect(custody.detail).toContain("could not be reached");
    expect(custody.detail).toContain("no reserve figure was read");
    // An outage anywhere makes the whole posture an alert (worst tone wins).
    expect(view.posture).toBe("alert");
  });

  it("a live read stays 'Live read' / ok", () => {
    const custody = factor(readiness({}), "custody");
    expect(custody.status).toBe("Live read");
    expect(custody.tone).toBe("ok");
  });

  it("a genuinely manual snapshot stays 'Manual' / watch", () => {
    const custody = factor(
      readiness({ proof: { custodyProvenance: "manual" } }),
      "custody",
    );
    expect(custody.status).toBe("Manual");
    expect(custody.tone).toBe("watch");
  });

  it("not configured stays idle", () => {
    const custody = factor(
      readiness({
        proof: { custodyConfigured: false, custodyProvenance: "manual" },
      }),
      "custody",
    );
    expect(custody.status).toBe("Not configured");
    expect(custody.tone).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// Queue / audit — null (read failed) is NOT 0 (measured empty)
// ---------------------------------------------------------------------------

describe("queue and audit factors with unreadable counts", () => {
  it("null queue count reads Unavailable/idle — never 'Clear'", () => {
    const view = readiness({ operatorQueueCount: null });
    const queue = factor(view, "queue");
    expect(queue.status).toBe("Unavailable");
    expect(queue.status).not.toBe("Clear");
    expect(queue.tone).toBe("idle");
    expect(queue.detail).toContain("database error");
  });

  it("null audit count reads Unavailable/idle — never 'Empty'", () => {
    const view = readiness({ auditEntryCount: null });
    const audit = factor(view, "audit");
    expect(audit.status).toBe("Unavailable");
    expect(audit.status).not.toBe("Empty");
    expect(audit.tone).toBe("idle");
  });

  it("a measured zero still reads Clear / Empty (distinct from null)", () => {
    const view = readiness({ operatorQueueCount: 0, auditEntryCount: 0 });
    expect(factor(view, "queue").status).toBe("Clear");
    expect(factor(view, "audit").status).toBe("Empty");
  });

  it("queue above the hand-tuned watch threshold turns watch", () => {
    const view = readiness({ operatorQueueCount: 4 });
    expect(factor(view, "queue").tone).toBe("watch");
    expect(factor(readiness({ operatorQueueCount: 3 }), "queue").tone).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// KPI strip — unavailable reads are '—' + stale, never fabricated
// ---------------------------------------------------------------------------

describe("buildOperatingKpis", () => {
  it("custody outage cell is '—' + stale + alert, sublabel says unreachable", () => {
    const kpis = buildOperatingKpis({
      proof: {
        ...PROOF_BASE,
        custodyProvenance: "unavailable",
        custodyReservesUsdc: null,
      },
      operatorQueueCount: 2,
      investorCount: 3,
      investedCapitalUsdc: 100_000,
    });
    const custody = kpis.find((k) => k.label === "Custody reserves")!;
    expect(custody.value).toBe("—");
    expect(custody.provenance).toBe("stale");
    expect(custody.alert).toBe(true);
    expect(custody.sublabel).toContain("unreachable");
    expect(custody.sublabel).not.toContain("manually");
  });

  it("unreadable queue cell is '—' + stale — never '0 · nothing pending'", () => {
    const kpis = buildOperatingKpis({
      proof: PROOF_BASE,
      operatorQueueCount: null,
      investorCount: 3,
      investedCapitalUsdc: 100_000,
    });
    const queue = kpis.find((k) => k.label === "Operator queue")!;
    expect(queue.value).toBe("—");
    expect(queue.value).not.toBe("0");
    expect(queue.provenance).toBe("stale");
    expect(queue.sublabel).toContain("database read failed");
  });

  it("a measured queue keeps the live provenance and real count", () => {
    const kpis = buildOperatingKpis({
      proof: PROOF_BASE,
      operatorQueueCount: 0,
      investorCount: 3,
      investedCapitalUsdc: 100_000,
    });
    const queue = kpis.find((k) => k.label === "Operator queue")!;
    expect(queue.value).toBe("0");
    expect(queue.provenance).toBe("live");
    expect(queue.sublabel).toBe("nothing pending");
  });
});

// ---------------------------------------------------------------------------
// worstTone
// ---------------------------------------------------------------------------

describe("worstTone", () => {
  it("alert beats watch beats idle beats ok", () => {
    expect(worstTone(["ok", "idle", "watch", "alert"])).toBe("alert");
    expect(worstTone(["ok", "idle", "watch"])).toBe("watch");
    expect(worstTone(["ok", "idle"])).toBe("idle");
    expect(worstTone(["ok"])).toBe("ok");
  });
});
