import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Redis seam (v0 fallback). Default: no Redis.
const getRedisMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/rate-limit", () => ({
  getRedis: () => getRedisMock(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Durable store seam: a fake prisma so the DB-first path is exercised in-process.
const { created, createMock, deleteManyMock } = vi.hoisted(() => {
  const created: unknown[] = [];
  return {
    created,
    createMock: vi.fn(async ({ data }: { data: unknown }) => {
      created.push(data);
      return data;
    }),
    deleteManyMock: vi.fn(async () => ({ count: 0 })),
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    agenticRouterDecisionTrace: {
      create: createMock,
      deleteMany: deleteManyMock,
    },
  },
}));

import { recordRouterDecisionSafe } from "@/lib/agentic/observability/record-router-decision";
import {
  readTracesWithFallback,
  __resetRouterDecisionMemBuffer,
} from "@/lib/agentic/observability/store";
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";

const classify = (m: string) =>
  classifyAgenticIntent(m, { navProfile: "lp", isAdmin: false });

const WIDE = { window: "7d" as const, limit: 200, cutoffMs: 0 };

beforeEach(() => {
  __resetRouterDecisionMemBuffer();
  getRedisMock.mockReturnValue(null);
  created.length = 0;
  createMock.mockImplementation(async ({ data }: { data: unknown }) => {
    created.push(data);
    return data;
  });
  vi.clearAllMocks();
});
afterEach(() => __resetRouterDecisionMemBuffer());

describe("recordRouterDecisionSafe — durable-first, never blocking", () => {
  it("writes durably (prisma.create) with a Date createdAt", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "turn_1",
      chatId: "chat_1",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const data = created[0] as Record<string, unknown>;
    expect(data.outcome).toBe("nav_fast_path");
    expect(data.routeKey).toBe("vaults");
    expect(data.createdAt).toBeInstanceOf(Date);
  });

  it("falls back to memory when the durable insert throws (never throws)", async () => {
    createMock.mockRejectedValue(new Error("db down"));
    await expect(
      recordRouterDecisionSafe({
        decision: classify("déploie ce produit"),
        outcome: "dangerous_refusal",
        turnId: "turn_2",
      }),
    ).resolves.toBeUndefined();
    const res = await readTracesWithFallback(WIDE);
    expect(res.traces.some((t) => t.outcome === "dangerous_refusal")).toBe(true);
    expect(["redis_fallback", "memory_fallback"]).toContain(res.storage);
  });

  it("records an unknown trace when the decision is undefined", async () => {
    await recordRouterDecisionSafe({
      decision: undefined,
      outcome: "unknown",
      turnId: "turn_u",
    });
    const data = created[0] as Record<string, unknown>;
    expect(data.kind).toBe("unknown");
    expect(data.outcome).toBe("unknown");
  });

  it("never persists user-text fields (normalizedInput / reason)", async () => {
    const d = classify("explique comment fonctionne le yield");
    await recordRouterDecisionSafe({
      decision: d,
      outcome: "educational_llm",
      turnId: "turn_e",
    });
    const blob = JSON.stringify(created);
    expect(blob).not.toContain(d.normalizedInput);
    expect(blob).not.toContain(d.reason);
  });
});
