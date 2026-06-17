/**
 * DATA ISOLATION tests — a user must NEVER read another user's rows.
 *
 * The authoritative per-user query layer at MVP lives in
 * `src/lib/agents/user-context.ts`:
 *   - loadUserAgentProfile(userId, agentName)         → UserAgentProfile (unique by pair)
 *   - loadUserMemory(userId, "scenario-narrative")    → ScenarioRun  (where userId)
 *   - loadUserMemory(userId, "investor-memo")         → ScenarioRun + BacktestRun (where userId)
 *   - loadUserMemory(userId, "cockpit-chat")          → AgentMemory + CockpitChat (where userId)
 *
 * ReportExport / Feedback / LlmRun are written with a userId column but, at
 * MVP, are NOT exposed through any per-user READ loader in src/lib/** — they
 * are admin-aggregate or write-only surfaces. See the report at the end of the
 * squad run; this suite covers every model that DOES have a scoped reader.
 *
 * Harness: mock `@/lib/db` with an in-memory store keyed by userId, then assert
 * that every loader's `where: { userId }` clause is honoured and that user A's
 * call returns ONLY A's rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    userAgentProfile: { findUnique: vi.fn() },
    scenarioRun: { findMany: vi.fn() },
    backtestRun: { findMany: vi.fn() },
    agentMemory: { findMany: vi.fn() },
    cockpitChat: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  loadUserAgentProfile,
  loadUserMemory,
} from "@/lib/agents/user-context";

const mockProfileFind = vi.mocked(prisma.userAgentProfile.findUnique);
const mockScenarioFind = vi.mocked(prisma.scenarioRun.findMany);
const mockBacktestFind = vi.mocked(prisma.backtestRun.findMany);
const mockMemoryFind = vi.mocked(prisma.agentMemory.findMany);
const mockChatFind = vi.mocked(prisma.cockpitChat.findMany);

const USER_A = "user_a";
const USER_B = "user_b";

// ---------------------------------------------------------------------------
// In-memory fixtures: two rows per model, one owned by A and one by B.
// Every mock implementation enforces the `where: { userId }` filter itself, so
// a loader that FORGETS to scope would surface the other user's row and the
// assertion would fail loudly.
// ---------------------------------------------------------------------------

const profiles = [
  { userId: USER_A, agentName: "scenario-narrative", tone: "concise-A" },
  { userId: USER_B, agentName: "scenario-narrative", tone: "concise-B" },
];

const scenarioRuns = [
  { userId: USER_A, preset: "base", confidence: "high", ranAt: new Date("2026-05-20") },
  { userId: USER_B, preset: "btc_bear", confidence: "low", ranAt: new Date("2026-05-21") },
];

const backtestRuns = [
  { userId: USER_A, backtestKey: "bear_2022_A", ranAt: new Date("2026-05-19") },
  { userId: USER_B, backtestKey: "etf_halving_2024_B", ranAt: new Date("2026-05-18") },
];

const agentMemories = [
  {
    userId: USER_A,
    agentName: "cockpit-chat",
    active: true,
    kind: "fact",
    content: "Fact A",
    updatedAt: new Date("2026-05-22"),
  },
  {
    userId: USER_B,
    agentName: "cockpit-chat",
    active: true,
    kind: "fact",
    content: "Fact B",
    updatedAt: new Date("2026-05-22"),
  },
];

const cockpitChats = [
  { userId: USER_A, title: "Chat A", updatedAt: new Date("2026-05-22") },
  { userId: USER_B, title: "Chat B", updatedAt: new Date("2026-05-22") },
];

function scopeByUser<T extends { userId: string }>(
  rows: T[],
  args: { where?: { userId?: string } },
): T[] {
  const wanted = args.where?.userId;
  // A loader that omits `where.userId` would pass `wanted === undefined` and
  // leak BOTH users' rows — caught by the cross-tenant assertions below.
  return rows.filter((r) => r.userId === wanted);
}

beforeEach(() => {
  vi.clearAllMocks();

  mockProfileFind.mockImplementation((async (args: {
    where: { userId_agentName: { userId: string; agentName: string } };
  }) => {
    const { userId, agentName } = args.where.userId_agentName;
    return (
      profiles.find((p) => p.userId === userId && p.agentName === agentName) ??
      null
    );
  }) as never);

  mockScenarioFind.mockImplementation((async (args: {
    where?: { userId?: string };
  }) => scopeByUser(scenarioRuns, args) as never) as never);

  mockBacktestFind.mockImplementation((async (args: {
    where?: { userId?: string };
  }) => scopeByUser(backtestRuns, args) as never) as never);

  mockMemoryFind.mockImplementation((async (args: {
    where?: { userId?: string; agentName?: string; active?: boolean };
  }) => {
    const wanted = args.where?.userId;
    return agentMemories.filter(
      (r) =>
        r.userId === wanted &&
        (args.where?.agentName === undefined ||
          r.agentName === args.where.agentName) &&
        (args.where?.active === undefined || r.active === args.where.active),
    ) as never;
  }) as never);

  mockChatFind.mockImplementation((async (args: {
    where?: { userId?: string };
  }) => scopeByUser(cockpitChats, args) as never) as never);
});

// ---------------------------------------------------------------------------
// UserAgentProfile
// ---------------------------------------------------------------------------

describe("isolation — loadUserAgentProfile (UserAgentProfile)", () => {
  it("queries with the exact (userId, agentName) compound key", async () => {
    await loadUserAgentProfile(USER_A, "scenario-narrative");
    expect(mockProfileFind).toHaveBeenCalledWith({
      where: { userId_agentName: { userId: USER_A, agentName: "scenario-narrative" } },
      include: { template: true },
    });
  });

  it("A gets A's profile, B gets B's — never crossed", async () => {
    expect((await loadUserAgentProfile(USER_A, "scenario-narrative"))?.tone).toBe("concise-A");
    expect((await loadUserAgentProfile(USER_B, "scenario-narrative"))?.tone).toBe("concise-B");
  });

  it("returns null for a user with no profile (no fallback to another user)", async () => {
    expect(await loadUserAgentProfile("user_c", "scenario-narrative")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ScenarioRun (via scenario-narrative memory)
// ---------------------------------------------------------------------------

describe("isolation — ScenarioRun (loadUserMemory:scenario-narrative)", () => {
  it("scopes the findMany by userId", async () => {
    await loadUserMemory(USER_A, "scenario-narrative");
    expect(mockScenarioFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_A } }),
    );
  });

  it("A's memory contains only A's scenario, never B's", async () => {
    const memA = await loadUserMemory(USER_A, "scenario-narrative");
    expect(memA).toContain("preset=base"); // A's row
    expect(memA).not.toContain("preset=btc_bear"); // B's row must not leak

    const memB = await loadUserMemory(USER_B, "scenario-narrative");
    expect(memB).toContain("preset=btc_bear");
    expect(memB).not.toContain("preset=base");
  });
});

// ---------------------------------------------------------------------------
// ScenarioRun + BacktestRun (via investor-memo memory)
// ---------------------------------------------------------------------------

describe("isolation — ScenarioRun + BacktestRun (loadUserMemory:investor-memo)", () => {
  it("scopes BOTH findMany calls by userId", async () => {
    await loadUserMemory(USER_A, "investor-memo");
    expect(mockScenarioFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_A } }),
    );
    expect(mockBacktestFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_A } }),
    );
  });

  it("A's memo memory never includes B's backtest key", async () => {
    const memA = await loadUserMemory(USER_A, "investor-memo");
    expect(memA).toContain("bear_2022_A");
    expect(memA).not.toContain("etf_halving_2024_B");

    const memB = await loadUserMemory(USER_B, "investor-memo");
    expect(memB).toContain("etf_halving_2024_B");
    expect(memB).not.toContain("bear_2022_A");
  });
});

// ---------------------------------------------------------------------------
// CockpitChat (via cockpit-chat memory)
// ---------------------------------------------------------------------------

describe("isolation — CockpitChat + AgentMemory (loadUserMemory:cockpit-chat)", () => {
  it("scopes both findMany calls by userId", async () => {
    await loadUserMemory(USER_A, "cockpit-chat");
    expect(mockMemoryFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_A, agentName: "cockpit-chat", active: true } }),
    );
    expect(mockChatFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_A } }),
    );
  });

  it("A only sees 'Chat A' / 'Fact A', B only sees 'Chat B' / 'Fact B'", async () => {
    const memA = await loadUserMemory(USER_A, "cockpit-chat");
    expect(memA).toContain("Chat A");
    expect(memA).toContain("Fact A");
    expect(memA).not.toContain("Chat B");
    expect(memA).not.toContain("Fact B");

    const memB = await loadUserMemory(USER_B, "cockpit-chat");
    expect(memB).toContain("Chat B");
    expect(memB).toContain("Fact B");
    expect(memB).not.toContain("Chat A");
    expect(memB).not.toContain("Fact A");
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant repetition — loop both users many times, assert no bleed
// ---------------------------------------------------------------------------

describe("isolation — repeated cross-tenant reads stay clean", () => {
  it("10 interleaved A/B reads never surface the other tenant's data", async () => {
    for (let i = 0; i < 10; i++) {
      const a = await loadUserMemory(USER_A, "investor-memo");
      const b = await loadUserMemory(USER_B, "investor-memo");
      expect(a, `iteration ${i}: A`).not.toContain("_B");
      expect(b, `iteration ${i}: B`).not.toContain("_A");
    }
  });
});
