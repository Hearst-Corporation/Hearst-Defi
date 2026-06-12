import { describe, expect, it } from "vitest";

import { CHAT_MODES, isChatMode } from "@/lib/llm/chat-modes";

describe("chat modes", () => {
  it("allows the three cockpit chat personas", () => {
    expect(CHAT_MODES).toEqual(["normal", "review", "admin"]);
    expect(isChatMode("normal")).toBe(true);
    expect(isChatMode("review")).toBe(true);
    expect(isChatMode("admin")).toBe(true);
  });

  it("rejects unknown mode values", () => {
    expect(isChatMode("deploy")).toBe(false);
    expect(isChatMode(null)).toBe(false);
  });
});
