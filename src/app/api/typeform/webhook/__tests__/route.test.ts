import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { validateTypeformHmac } from "../route";
import { parseTypeformPayload } from "@/lib/agents/qualification";

function sign(secret: string, body: string): string {
  const digest = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  return `sha256=${digest}`;
}

describe("validateTypeformHmac", () => {
  it("accepts a valid sha256=<base64> signature", () => {
    const secret = "test-secret";
    const body = '{"form_response":{"token":"abc"}}';
    expect(validateTypeformHmac(secret, body, sign(secret, body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const secret = "test-secret";
    const body = '{"form_response":{"token":"abc"}}';
    expect(validateTypeformHmac(secret, body + "x", sign(secret, body))).toBe(false);
  });

  it("rejects a wrong secret (invalid signature)", () => {
    const body = '{"form_response":{"token":"abc"}}';
    expect(validateTypeformHmac("correct-secret", body, sign("wrong-secret", body))).toBe(false);
  });

  it("rejects a missing header (empty string)", () => {
    expect(validateTypeformHmac("secret", "{}", "")).toBe(false);
  });

  it("accepts a raw base64 digest without sha256= prefix (lenient mode)", () => {
    // The implementation intentionally falls back to the raw value when the
    // sha256= prefix is absent — both the prefixed and raw forms work.
    const secret = "test-secret";
    const body = "{}";
    const raw = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(validateTypeformHmac(secret, body, raw)).toBe(true);
  });
});

describe("parseTypeformPayload", () => {
  // The parser joins answers to question titles via definition.fields.
  // TypeformAnswer.field carries {id?, ref?, type?} — NOT title.
  // Title lookup: answer.field.ref → definition.fields[].ref → fields[].title.
  // Title matching: parser uses title.includes(TITLE_ROUTES[].match), so titles
  // must contain the exact match strings defined in qualification.ts.
  it("parses a full qualification payload via definition.fields", () => {
    const payload = {
      form_response: {
        definition: {
          fields: [
            { ref: "q1", title: "What describes your platform?" },       // match: "describes your platform"
            { ref: "q2", title: "Assets under management?" },            // match: "assets under management"
            { ref: "q3", title: "Are client funds sitting unused?" },    // match: "sitting unused"
            { ref: "q4", title: "Do you offer yield or reward products?" }, // match: "yield or reward products"
            { ref: "q5", title: "What type of yield product suits clients?" }, // match: "type of yield product"
            { ref: "q6", title: "Preferred vault size for first allocation?" }, // match: "vault size"
            { ref: "q7", title: "What is your launch timeline?" },       // match: "launch timeline"
          ],
        },
        answers: [
          { field: { ref: "q1" }, choice: { label: "Crypto exchange / OTC desk" } },
          { field: { ref: "q2" }, choice: { label: "$10M – $50M" } },
          { field: { ref: "q3" }, choice: { label: "A mix of both" } },
          { field: { ref: "q4" }, choice: { label: "Yes, we're live" } },
          { field: { ref: "q5" }, choice: { label: "Balanced risk / return" } },
          { field: { ref: "q6" }, choice: { label: "$500K – $1M" } },
          { field: { ref: "q7" }, choice: { label: "ASAP" } },
          { type: "email", email: "lp@fund.io" },
        ],
      },
    };

    const result = parseTypeformPayload(payload);
    expect(result.email).toBe("lp@fund.io");
    expect(result.answers.platformType).toBe("exchange");
    expect(result.answers.aum).toBe("10_50m");
    expect(result.answers.fundsUsage).toBe("mix");
    expect(result.answers.yieldStatus).toBe("live");
    expect(result.answers.yieldType).toBe("balanced");
    expect(result.answers.vaultSize).toBe("500k_1m");
    expect(result.answers.timeline).toBe("asap");
  });

  it("returns undefined fields and null email for empty payload", () => {
    const payload = {
      form_response: {
        definition: { fields: [] },
        answers: [],
      },
    };
    const result = parseTypeformPayload(payload);
    expect(result.answers.platformType).toBeUndefined();
    expect(result.answers.aum).toBeUndefined();
    expect(result.email).toBeNull();
  });
});
