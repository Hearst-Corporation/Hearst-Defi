import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Force the in-memory fallback path (no Upstash configured).
vi.mock("@/lib/rate-limit", () => ({ getRedis: () => null }));

import { publishNav, consumeNav } from "@/lib/llm/nav-channel";

describe("nav-channel (in-memory fallback)", () => {
  it("round-trips a whitelisted destination", async () => {
    await publishNav("user-1", "portfolio");
    const dest = await consumeNav("user-1");
    expect(dest?.route).toBe("/portfolio");
  });

  it("is single-fire (read-and-clear)", async () => {
    await publishNav("user-2", "vaults");
    expect((await consumeNav("user-2"))?.route).toBe("/vaults");
    expect(await consumeNav("user-2")).toBeNull();
  });

  it("drops a non-whitelisted destination at publish", async () => {
    await publishNav("user-3", "admin");
    expect(await consumeNav("user-3")).toBeNull();
  });

  it("accepts a whitelisted admin destination key", async () => {
    await publishNav("user-4", "admin-vaults");
    expect((await consumeNav("user-4"))?.route).toBe("/admin/vaults");
  });

  it("carries product workspace objective and autostart metadata", async () => {
    await publishNav("user-product", {
      destinationKey: "admin-product-workspace",
      objective: "Créer une offre Defensive avec notes de calcul",
      autostart: true,
    });
    expect(await consumeNav("user-product")).toEqual({
      route: "/admin/product-workspace",
      label: "Admin Product Workspace",
      objective: "Créer une offre Defensive avec notes de calcul",
      autostart: true,
    });
  });

  it("carries mixed-intent secondary Scenario Lab metadata", async () => {
    await publishNav("user-product-mixed", {
      destinationKey: "admin-product-workspace",
      objective: "Créer un produit Defensive puis simuler un stress test",
      autostart: true,
      intentKind: "mixed_product_creation_simulation",
      secondaryDestinationKey: "admin-scenario-lab",
      secondaryHint: "Scenario Lab validation requested",
    });
    expect(await consumeNav("user-product-mixed")).toEqual({
      route: "/admin/product-workspace",
      label: "Admin Product Workspace",
      objective: "Créer un produit Defensive puis simuler un stress test",
      autostart: true,
      intentKind: "mixed_product_creation_simulation",
      secondaryRoute: "/admin/scenario-lab",
      secondaryLabel: "Admin Scenario Lab",
      secondaryHint: "Scenario Lab validation requested",
    });
  });

  it("isolates channels per user", async () => {
    await publishNav("user-A", "proof-center");
    expect(await consumeNav("user-B")).toBeNull();
    expect((await consumeNav("user-A"))?.route).toBe("/proof-center");
  });
});
