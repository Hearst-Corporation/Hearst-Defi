import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Fake @upstash/redis-like client. The real client AUTO-DESERIALIZES JSON on
// read: a value stored as the JSON string '{"destinationKey":"vaults"}' comes
// back from getdel() as an already-parsed OBJECT. consumeNav() used to type the
// result as `string` and JSON.parse it unconditionally — which threw on the
// object and silently dropped EVERY navigation whenever Upstash was configured
// (i.e. in production). These tests pin the tolerant read.
const store = new Map<string, unknown>();
const fakeRedis = {
  set: (key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve("OK");
  },
  getdel: (key: string) => {
    const v = store.get(key);
    store.delete(key);
    if (typeof v === "string") {
      try {
        return Promise.resolve(JSON.parse(v)); // Upstash auto-deserialize
      } catch {
        return Promise.resolve(v);
      }
    }
    return Promise.resolve(v ?? null);
  },
};
vi.mock("@/lib/rate-limit", () => ({ getRedis: () => fakeRedis }));

import { publishNav, consumeNav } from "@/lib/llm/nav-channel";

afterEach(() => store.clear());

describe("nav-channel (Upstash auto-deserialize round-trip)", () => {
  it("consumes a directive even when getdel returns a parsed object (regression)", async () => {
    await publishNav("u1", "vaults");
    const consumed = await consumeNav("u1");
    expect(consumed).toEqual({ route: "/vaults", label: "Produits / Vaults" });
  });

  it("preserves workspace objective + autostart through the object round-trip", async () => {
    await publishNav("u2", {
      destinationKey: "admin-product-workspace",
      objective: "Cadrer un vault défensif",
      autostart: true,
    });
    const consumed = await consumeNav("u2");
    expect(consumed?.route).toBe("/admin/product-workspace");
    expect(consumed?.objective).toBe("Cadrer un vault défensif");
    expect(consumed?.autostart).toBe(true);
  });

  it("is single-fire (getdel removes the key)", async () => {
    await publishNav("u3", "portfolio");
    expect((await consumeNav("u3"))?.route).toBe("/portfolio");
    expect(await consumeNav("u3")).toBeNull();
  });

  it("opens a NEW whitelisted sub-page (portfolio-distributions)", async () => {
    await publishNav("u4", "portfolio-distributions");
    expect((await consumeNav("u4"))?.route).toBe("/portfolio/distributions");
  });
});
