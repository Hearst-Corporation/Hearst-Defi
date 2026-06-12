/**
 * Cockpit admin unit tests (Stream M — admin-cockpit-unified).
 *
 * These tests exercise pure-logic helpers and type contracts from the cockpit
 * data module without touching the DOM or Prisma. No JSX rendering, no
 * server-only imports — all tested code is extracted inline or imported from
 * pure modules.
 *
 * Vitest include pattern: src/**\/\*.test.ts  (see vitest.config.ts)
 */

import { describe, it, expect } from "vitest";
import type {
  ActionQueueItem,
  ActionSeverity,
  VaultLiveMetric,
  InngestJob,
  InngestJobStatus,
  AuditTrailEntry,
} from "@/lib/data/cockpit";

// ---------------------------------------------------------------------------
// 1. ActionQueue — 3 P0 items produce correct severity ordering
// ---------------------------------------------------------------------------

describe("ActionQueue — P0 item ordering", () => {
  const makeItem = (
    id: string,
    severity: ActionSeverity,
    createdAt: string,
  ): ActionQueueItem => ({
    id,
    type: "multisig.sign",
    severity,
    title: `Action ${id}`,
    context: "test context",
    href: "/admin/dashboard",
    createdAt,
  });

  const items: ActionQueueItem[] = [
    makeItem("p1-a", "P1", "2026-05-26T10:00:00Z"),
    makeItem("p0-a", "P0", "2026-05-26T09:00:00Z"),
    makeItem("p0-b", "P0", "2026-05-26T08:00:00Z"),
    makeItem("p0-c", "P0", "2026-05-26T07:00:00Z"),
  ];

  // Sort helper mirrors the one in cockpit.ts
  const order: Record<ActionSeverity, number> = { P0: 0, P1: 1, P2: 2 };
  const sorted = [...items].sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  it("first 3 items are P0", () => {
    expect(sorted[0]?.severity).toBe("P0");
    expect(sorted[1]?.severity).toBe("P0");
    expect(sorted[2]?.severity).toBe("P0");
  });

  it("P0 items ordered newest-first within severity", () => {
    // p0-a (09:00) comes before p0-b (08:00) comes before p0-c (07:00)
    expect(sorted[0]?.id).toBe("p0-a");
    expect(sorted[1]?.id).toBe("p0-b");
    expect(sorted[2]?.id).toBe("p0-c");
  });

  it("P1 item is last", () => {
    expect(sorted[3]?.severity).toBe("P1");
  });

  it("all 3 P0 rows have correct type", () => {
    const p0Items = sorted.filter((i) => i.severity === "P0");
    expect(p0Items).toHaveLength(3);
    for (const item of p0Items) {
      expect(item.type).toBe("multisig.sign");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. LiveOps — Inngest error status recognised correctly
// ---------------------------------------------------------------------------

describe("LiveOps — Inngest job status", () => {
  const makeJob = (id: string, status: InngestJobStatus): InngestJob => ({
    id,
    name: `Job ${id}`,
    status,
    lastRunAt: null,
    errorMsg: status === "err" ? "last run failed" : null,
  });

  it("err status job has non-null errorMsg", () => {
    const job = makeJob("oracle", "err");
    expect(job.errorMsg).not.toBeNull();
    expect(job.status).toBe("err");
  });

  it("ok status job has null errorMsg", () => {
    const job = makeJob("rebalance", "ok");
    expect(job.errorMsg).toBeNull();
    expect(job.status).toBe("ok");
  });

  it("unknown status job has null lastRunAt", () => {
    const job = makeJob("proof-sync", "unknown");
    expect(job.lastRunAt).toBeNull();
  });

  it("pending status is distinct from err", () => {
    const pending = makeJob("distrib", "pending");
    expect(pending.status).not.toBe("err");
  });

  const jobs = [
    makeJob("r", "ok"),
    makeJob("d", "err"),
    makeJob("o", "pending"),
    makeJob("p", "unknown"),
  ];

  it("filters to only error jobs", () => {
    const errJobs = jobs.filter((j) => j.status === "err");
    expect(errJobs).toHaveLength(1);
    expect(errJobs[0]?.id).toBe("d");
  });

  it("four jobs have correct status distribution", () => {
    const statuses = jobs.map((j) => j.status);
    expect(statuses).toContain("ok");
    expect(statuses).toContain("err");
    expect(statuses).toContain("pending");
    expect(statuses).toContain("unknown");
  });
});

// ---------------------------------------------------------------------------
// 5. AuditTrail — wallet truncation helper (extracted inline for unit test)
// ---------------------------------------------------------------------------

describe("AuditTrail — wallet truncation", () => {
  // Mirror of truncateWallet from audit-trail-rolling.tsx (pure function)
  function truncateWallet(addr: string): string {
    if (addr.startsWith("0x") && addr.length >= 10) {
      return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    }
    return addr.length > 12 ? `${addr.slice(0, 10)}…` : addr;
  }

  it("truncates a 42-char ETH address to 0x…xxxx form", () => {
    // addr is 42 chars: slice(0,6) = "0xAbCd", slice(-4) = "Ef12"
    const addr = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    const result = truncateWallet(addr);
    expect(result).toBe("0xAbCd…Ef12");
  });

  it("short address returned as-is", () => {
    const addr = "0xAbCd";
    expect(truncateWallet(addr)).toBe("0xAbCd");
  });

  it("non-hex string truncated to 10 chars + ellipsis when > 12", () => {
    const addr = "admin-wallet-long-name";
    const result = truncateWallet(addr);
    expect(result).toBe("admin-wall…");
  });

  it("short non-hex string returned as-is", () => {
    expect(truncateWallet("admin")).toBe("admin");
  });
});

// ---------------------------------------------------------------------------
// 6. VaultMetric — live metric shape integrity
// ---------------------------------------------------------------------------

describe("VaultLiveMetric — shape", () => {
  const mockMetric: VaultLiveMetric = {
    vaultId: "yield",
    vaultName: "Hearst Yield Vault",
    tvlUsdc: 42_500_000,
    miningMarginScore: 72,
    riskScore: 38,
    oracleDelayMs: 300_000,
    btcPosture: "neutral",
    status: "live",
    href: "/admin/dashboard",
    hasTimelineData: true,
  };

  it("oracleDelayMs < 6h means oracle is not stale", () => {
    const threshold = 6 * 60 * 60 * 1000;
    expect((mockMetric.oracleDelayMs ?? Infinity) < threshold).toBe(true);
  });

  it("miningMarginScore >= 15 means not in red zone", () => {
    expect(mockMetric.miningMarginScore).toBeGreaterThanOrEqual(15);
  });

  it("riskScore <= 45 means success colour band", () => {
    expect(mockMetric.riskScore).toBeLessThanOrEqual(45);
  });
});

// ---------------------------------------------------------------------------
// 7. AuditTrailEntry type contract
// ---------------------------------------------------------------------------

describe("AuditTrailEntry — type contract", () => {
  const entry: AuditTrailEntry = {
    id: "cluabcdefgh",
    occurredAt: "2026-05-26T10:00:00.000Z",
    actorWallet: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
    action: "vault.approve",
    entityType: "VaultDeployment",
    entityId: "cluabcdefgh",
  };

  it("occurredAt is a valid ISO date string", () => {
    const d = new Date(entry.occurredAt);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it("actorWallet starts with 0x for ETH addresses", () => {
    expect(entry.actorWallet.startsWith("0x")).toBe(true);
  });

  it("action is a non-empty string", () => {
    expect(entry.action.length).toBeGreaterThan(0);
  });
});
