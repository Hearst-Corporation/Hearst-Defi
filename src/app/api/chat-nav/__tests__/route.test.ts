import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({ getRedis: () => null }));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { GET } from "@/app/api/chat-nav/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { publishNav } from "@/lib/llm/nav-channel";

const mockRequireAuth = vi.mocked(requireAuth);

describe("GET /api/chat-nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: "chat-nav-user" });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValueOnce(new Error("Authentication required"));

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Authentication required",
    });
  });

  it("returns null when no navigation is pending", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ route: null });
  });

  it("returns Product Workspace metadata once and then clears it", async () => {
    // A retired secondary key ("admin-scenario-lab") no longer resolves in the
    // whitelist, so the channel drops it — the directive carries the primary
    // Product Workspace metadata only.
    await publishNav("chat-nav-user", {
      destinationKey: "admin-vaults-new",
      objective: "Créer un produit Defensive puis simuler un stress test",
      autostart: true,
      intentKind: "mixed_product_creation_simulation",
      secondaryDestinationKey: "admin-scenario-lab",
      secondaryHint: "Scenario Lab validation requested",
    });

    const first = await GET();
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      route: "/admin/vaults/new",
      label: "Admin — New vault",
      objective: "Créer un produit Defensive puis simuler un stress test",
      autostart: true,
      intentKind: "mixed_product_creation_simulation",
    });

    const second = await GET();
    await expect(second.json()).resolves.toEqual({ route: null });
  });
});
