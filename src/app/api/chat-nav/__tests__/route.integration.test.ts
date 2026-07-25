import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration test for the nav-channel single-fire cycle through GET /api/chat-nav.
 *
 * Unlike the sibling unit test (route.test.ts), this drives the FULL contract the
 * client `<ChatNavBridge>` depends on, exercising the REAL nav-channel store:
 *   1. publishNav(user) → first GET returns the directive verbatim;
 *   2. a SECOND GET returns { route: null } — read-and-clear / single fire;
 *   3. the channel is per-user scoped — a directive for user A never leaks to B;
 *   4. an expired (TTL-elapsed) directive is never returned (and is cleared).
 *
 * The store used is the in-memory fallback (getRedis() → null), which is the
 * deterministic backend in tests. requireAuth is mocked so we can pin the userId.
 */

vi.mock("server-only", () => ({}));
// Force the in-memory fallback store (no Upstash) so the cycle is deterministic.
vi.mock("@/lib/rate-limit", () => ({ getRedis: () => null }));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

import { GET } from "@/app/api/chat-nav/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { publishNav } from "@/lib/llm/nav-channel";

const mockRequireAuth = vi.mocked(requireAuth);

const USER_A = "chat-nav-integration-user-a";
const USER_B = "chat-nav-integration-user-b";

/** Run GET as a specific authenticated user. */
async function getAs(userId: string): Promise<Response> {
  mockRequireAuth.mockResolvedValue({ userId });
  return GET();
}

describe("GET /api/chat-nav — single-fire nav-channel cycle (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockRequireAuth.mockResolvedValue({ userId: USER_A });
  });

  it("publish → GET returns the directive once, a second GET clears it (read-and-delete)", async () => {
    await publishNav(USER_A, { destinationKey: "portfolio" });

    const first = await getAs(USER_A);
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      route: "/portfolio",
      label: expect.any(String),
    });

    // Single-fire: the SAME directive must NOT be re-served on the next poll.
    const second = await getAs(USER_A);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({ route: null });
  });

  it("carries the full directive payload (objective / autostart / intentKind)", async () => {
    // The Scenario Lab route was retired, so a "admin-scenario-lab" secondary key
    // no longer resolves and the channel drops it — the payload carries only the
    // primary Product Workspace metadata.
    await publishNav(USER_A, {
      destinationKey: "admin-vaults-new",
      objective: "Créer un vault Defensive puis valider en stress test",
      autostart: true,
      intentKind: "mixed_product_creation_simulation",
      secondaryDestinationKey: "admin-scenario-lab",
      secondaryHint: "Scenario Lab validation requested",
    });

    const res = await getAs(USER_A);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      route: "/admin/vaults/new",
      label: expect.any(String),
      objective: "Créer un vault Defensive puis valider en stress test",
      autostart: true,
      intentKind: "mixed_product_creation_simulation",
    });

    // Cleared after the single read.
    await expect((await getAs(USER_A)).json()).resolves.toEqual({ route: null });
  });

  it("is per-user scoped — a directive published for A never reaches B", async () => {
    await publishNav(USER_A, { destinationKey: "vaults" });

    // B polls first and sees NOTHING (the directive belongs to A's channel).
    const bRes = await getAs(USER_B);
    expect(bRes.status).toBe(200);
    await expect(bRes.json()).resolves.toEqual({ route: null });

    // A still gets its own directive (B's poll did not consume it).
    const aRes = await getAs(USER_A);
    await expect(aRes.json()).resolves.toEqual({
      route: "/vaults",
      label: expect.any(String),
    });
  });

  it("drops an unknown / non-whitelisted destination key (publish is a no-op)", async () => {
    // normalizeDirective resolves the key against the whitelist; an unknown key
    // is dropped at publish time, so the channel stays empty.
    await publishNav(USER_A, { destinationKey: "definitely-not-a-route" });

    const res = await getAs(USER_A);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ route: null });
  });

  it("never returns an expired directive (TTL elapsed → cleared, route null)", async () => {
    vi.useFakeTimers();
    try {
      await publishNav(USER_A, { destinationKey: "portfolio" });

      // Advance past the 90s TTL. The in-memory consume path deletes the entry
      // and treats it as expired → null.
      vi.advanceTimersByTime(91_000);

      const res = await getAs(USER_A);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ route: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 401 when the request is unauthenticated", async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error("Authentication required"));

    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Authentication required",
    });
  });
});
