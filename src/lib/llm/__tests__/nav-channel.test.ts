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

  it("isolates channels per user", async () => {
    await publishNav("user-A", "proof-center");
    expect(await consumeNav("user-B")).toBeNull();
    expect((await consumeNav("user-A"))?.route).toBe("/proof-center");
  });
});
