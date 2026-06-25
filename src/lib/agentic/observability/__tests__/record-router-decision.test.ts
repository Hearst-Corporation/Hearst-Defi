import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// getRedis is the single backend seam. Default: no Redis (in-memory fallback).
const getRedisMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/rate-limit", () => ({
  getRedis: () => getRedisMock(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { recordRouterDecisionSafe } from "@/lib/agentic/observability/record-router-decision";
import {
  getObservabilityStorage,
  readRecentRouterDecisionTraces,
  __resetRouterDecisionMemBuffer,
} from "@/lib/agentic/observability/store";
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";

const classify = (m: string) =>
  classifyAgenticIntent(m, { navProfile: "lp", isAdmin: false });

beforeEach(() => {
  __resetRouterDecisionMemBuffer();
  getRedisMock.mockReturnValue(null);
  vi.clearAllMocks();
});

afterEach(() => {
  __resetRouterDecisionMemBuffer();
});

describe("recordRouterDecisionSafe — non-blocking + in-memory fallback", () => {
  it("records a decision into the in-memory buffer when Redis is absent", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "turn_1",
      chatId: "chat_1",
    });
    const recent = await readRecentRouterDecisionTraces();
    expect(recent).toHaveLength(1);
    expect(recent[0]?.outcome).toBe("nav_fast_path");
    expect(recent[0]?.routeKey).toBe("vaults");
  });

  it("storage mode is 'memory' with no Redis, 'redis' when configured", () => {
    expect(getObservabilityStorage()).toBe("memory");
    getRedisMock.mockReturnValue({});
    expect(getObservabilityStorage()).toBe("redis");
  });

  it("newest-first ordering", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "turn_a",
    });
    await recordRouterDecisionSafe({
      decision: classify("déploie ce produit"),
      outcome: "dangerous_refusal",
      turnId: "turn_b",
    });
    const recent = await readRecentRouterDecisionTraces();
    expect(recent[0]?.outcome).toBe("dangerous_refusal");
    expect(recent[1]?.outcome).toBe("nav_fast_path");
  });

  it("NEVER throws when Redis append fails (best-effort)", async () => {
    getRedisMock.mockReturnValue({
      lpush: vi.fn().mockRejectedValue(new Error("redis down")),
      ltrim: vi.fn(),
      expire: vi.fn(),
    });
    await expect(
      recordRouterDecisionSafe({
        decision: classify("va dans les vaults"),
        outcome: "nav_fast_path",
        turnId: "turn_x",
      }),
    ).resolves.toBeUndefined();
    // Still mirrored into memory so the admin view is not blank.
    const recent = await readRecentRouterDecisionTraces();
    expect(recent.length).toBeGreaterThan(0);
  });

  it("records an unknown trace when the decision is undefined", async () => {
    await recordRouterDecisionSafe({
      decision: undefined,
      outcome: "unknown",
      turnId: "turn_u",
    });
    const recent = await readRecentRouterDecisionTraces();
    expect(recent[0]?.kind).toBe("unknown");
    expect(recent[0]?.outcome).toBe("unknown");
  });

  it("never persists user-text fields even end-to-end", async () => {
    const d = classify("explique comment fonctionne le yield");
    await recordRouterDecisionSafe({
      decision: d,
      outcome: "educational_llm",
      turnId: "turn_e",
    });
    const recent = await readRecentRouterDecisionTraces();
    const blob = JSON.stringify(recent);
    expect(blob).not.toContain(d.normalizedInput);
    expect(blob).not.toContain(d.reason);
  });
});
