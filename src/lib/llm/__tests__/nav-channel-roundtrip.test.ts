import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// No Redis in this test → publishNav/consumeNav use the in-process memNav Map,
// exactly like local dev when UPSTASH_REDIS_* is unset. This proves the channel
// round-trips a workspace directive within one process.
vi.mock("@/lib/rate-limit", () => ({ getRedis: () => null }));

import { publishNav, consumeNav } from "@/lib/llm/nav-channel";

describe("nav-channel round-trip (memNav, no Redis)", () => {
  it("a published workspace directive is consumed once with its objective + autostart", async () => {
    const userId = "admin-roundtrip";
    await publishNav(userId, {
      destinationKey: "admin-product-workspace",
      objective: "Créer un vault défensif",
      autostart: true,
      intentKind: "product_creation",
    });

    const first = await consumeNav(userId);
    expect(first).not.toBeNull();
    expect(first?.route).toBe("/admin/product-workspace");
    expect(first?.objective).toBe("Créer un vault défensif");
    expect(first?.autostart).toBe(true);

    // Read-and-clear: a second consume returns nothing (single fire).
    const second = await consumeNav(userId);
    expect(second).toBeNull();
  });

  it("carries the Scenario Lab secondary when present", async () => {
    const userId = "admin-roundtrip-2";
    await publishNav(userId, {
      destinationKey: "admin-product-workspace",
      objective: "Créer un vault BTC Plus et le stresser",
      autostart: true,
      intentKind: "mixed_product_creation_simulation",
      secondaryDestinationKey: "admin-scenario-lab",
      secondaryHint: "Scenario Lab validation requested",
    });
    const dest = await consumeNav(userId);
    expect(dest?.route).toBe("/admin/product-workspace");
    expect(dest?.secondaryRoute).toBe("/admin/scenario-lab");
  });
});
