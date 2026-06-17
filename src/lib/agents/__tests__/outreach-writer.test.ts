import { describe, expect, it } from "vitest";

import { OutreachDraftSchema } from "../outreach-writer";

describe("OutreachDraftSchema", () => {
  it("accepts a well-formed draft", () => {
    const result = OutreachDraftSchema.safeParse({
      subject: "Institutional USDC yield — quick intro",
      body: "Hello, a short note about Hearst Connect…",
    });
    expect(result.success).toBe(true);
  });

  it("trims and rejects an empty subject", () => {
    const result = OutreachDraftSchema.safeParse({ subject: "   ", body: "ok" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing body", () => {
    const result = OutreachDraftSchema.safeParse({ subject: "hi" });
    expect(result.success).toBe(false);
  });

  it("rejects non-string fields", () => {
    const result = OutreachDraftSchema.safeParse({ subject: 1, body: 2 });
    expect(result.success).toBe(false);
  });
});
