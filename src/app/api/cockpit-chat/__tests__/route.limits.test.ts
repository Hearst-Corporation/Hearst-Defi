import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Inbound-guard tests for POST /api/cockpit-chat — the two abuse limits the
 * handler enforces BEFORE any LLM work:
 *   - 413 when the body-size guard (assertBodySize) rejects an oversized payload;
 *   - 429 when the per-user rate limiter (assertRateLimit) is tripped.
 *
 * route.ts catches each guard's throw and returns the matching status:
 *   assertBodySize → 413 (route.ts step 0)
 *   assertRateLimit → 429 (route.ts step 2)
 * We drive the (mocked) guards to throw and assert the route's existing
 * behaviour. The kill-switch (503) is checked first, so we also pin ordering:
 * 413 fires before auth/rate-limit; 429 fires only after auth succeeds.
 *
 * No runtime file is modified — only the @/lib/rate-limit seam is mocked.
 */

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({ role: "investor" }),
}));

// The two guards under test. Default: both pass; individual tests override.
vi.mock("@/lib/rate-limit", () => ({
  assertBodySize: vi.fn().mockResolvedValue(undefined),
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: { CHAT_MASTER_AGENT: true },
}));

vi.mock("@/lib/llm/openai", () => ({
  openai: {},
  LLM_MODEL: "gpt-4.1",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminChatMode: { findUnique: vi.fn() },
    cockpitChat: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    cockpitMessage: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    llmRun: { create: vi.fn() },
    navTrace: { create: vi.fn() },
  },
}));

vi.mock("@/lib/agents/user-context", () => ({
  loadUserAgentProfile: vi.fn().mockResolvedValue(null),
  loadUserMemory: vi.fn().mockResolvedValue(null),
  buildUserContextSystemBlock: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/llm/chat-context", () => ({
  buildPortfolioContextBlock: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/llm/admin-context", () => ({
  buildAdminContextBlock: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/lib/llm/chat-agent", () => ({
  runChatAgent: vi.fn(),
}));

vi.mock("@/lib/llm/nav-channel", () => ({
  publishNav: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/cockpit-chat/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";
import { runChatAgent } from "@/lib/llm/chat-agent";

const mockRequireAuth = vi.mocked(requireAuth);
const mockAssertBodySize = vi.mocked(assertBodySize);
const mockAssertRateLimit = vi.mocked(assertRateLimit);
const mockRunChatAgent = vi.mocked(runChatAgent);

const USER_ID = "limits-test-user";

function makeChatRequest(message: string): NextRequest {
  return new Request("http://localhost/api/cockpit-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }) as NextRequest;
}

describe("POST /api/cockpit-chat — body-size guard (413)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    mockAssertBodySize.mockResolvedValue(undefined);
    mockAssertRateLimit.mockResolvedValue(undefined);
  });

  it("returns 413 when the body-size guard rejects an oversized payload", async () => {
    mockAssertBodySize.mockRejectedValueOnce(
      new Error("Request body too large. Max 1048576 bytes (1 MB)."),
    );

    const res = await POST(makeChatRequest("hello"));
    expect(res.status).toBe(413);

    const body = await res.json();
    expect(body.error).toContain("too large");

    // 413 fires at step 0 — before auth, rate-limit, or any LLM work.
    expect(mockRequireAuth).not.toHaveBeenCalled();
    expect(mockAssertRateLimit).not.toHaveBeenCalled();
    expect(mockRunChatAgent).not.toHaveBeenCalled();
  });

  it("falls back to a generic 413 message when the guard throws a non-Error", async () => {
    mockAssertBodySize.mockImplementationOnce(async () => {
      throw "boom";
    });

    const res = await POST(makeChatRequest("hello"));
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("Request too large");
  });
});

describe("POST /api/cockpit-chat — rate-limit guard (429)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    mockAssertBodySize.mockResolvedValue(undefined);
    mockAssertRateLimit.mockResolvedValue(undefined);
  });

  it("returns 429 with a Retry-After header when the per-user limiter is tripped", async () => {
    mockAssertRateLimit.mockRejectedValueOnce(new Error("Rate limit exceeded"));

    const res = await POST(makeChatRequest("hello"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");

    const text = await res.text();
    expect(text).toContain("Too many requests");

    // 429 fires only after auth succeeds and before any LLM work; it is keyed
    // on the authenticated userId.
    expect(mockRequireAuth).toHaveBeenCalled();
    expect(mockAssertRateLimit).toHaveBeenCalledWith(
      `cockpit-chat:${USER_ID}`,
      expect.any(Number),
      expect.any(Number),
    );
    expect(mockRunChatAgent).not.toHaveBeenCalled();
  });

  it("the rate-limit check runs AFTER auth (an unauthenticated request 401s first)", async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error("Authentication required"));

    const res = await POST(makeChatRequest("hello"));
    expect(res.status).toBe(401);
    // Auth failed → rate-limit was never consulted (no bucket spent).
    expect(mockAssertRateLimit).not.toHaveBeenCalled();
  });
});
