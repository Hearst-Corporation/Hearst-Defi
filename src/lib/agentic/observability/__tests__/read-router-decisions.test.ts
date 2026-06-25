import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getRedisMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/rate-limit", () => ({
  getRedis: () => getRedisMock(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getRouterObservabilitySummary } from "@/lib/agentic/observability/read-router-decisions";
import { recordRouterDecisionSafe } from "@/lib/agentic/observability/record-router-decision";
import { __resetRouterDecisionMemBuffer } from "@/lib/agentic/observability/store";
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";

const classify = (m: string) =>
  classifyAgenticIntent(m, { navProfile: "lp", isAdmin: false });

beforeEach(() => {
  __resetRouterDecisionMemBuffer();
  getRedisMock.mockReturnValue(null);
  vi.clearAllMocks();
});
afterEach(() => __resetRouterDecisionMemBuffer());

describe("getRouterObservabilitySummary — state + stats", () => {
  it("state 'empty' when storage present but no traces", async () => {
    const s = await getRouterObservabilitySummary();
    expect(s.storage).toBe("memory");
    expect(s.state).toBe("empty");
    expect(s.recent).toHaveLength(0);
    expect(s.stats.total).toBe(0);
    expect(s.safetyNote).toMatch(/no prompts/i);
    expect(s.privacyMode).toMatch(/metadata-only/i);
  });

  it("state 'enabled' once a trace exists, with stats", async () => {
    await recordRouterDecisionSafe({
      decision: classify("va dans les vaults"),
      outcome: "nav_fast_path",
      turnId: "t1",
    });
    await recordRouterDecisionSafe({
      decision: classify("déploie ce produit"),
      outcome: "dangerous_refusal",
      turnId: "t2",
    });
    const s = await getRouterObservabilitySummary();
    expect(s.state).toBe("enabled");
    expect(s.recent.length).toBe(2);
    expect(s.stats.total).toBe(2);
    expect(s.stats.navigationFastPaths).toBe(1);
    expect(s.stats.dangerousRefusals).toBe(1);
  });
});
