import { describe, it, expect } from "vitest";

import {
  parseTypeformPayload,
  type TypeformWebhookPayload,
} from "@/lib/agents/qualification";

/** Builds a Typeform-shaped payload from (title, choiceLabel) pairs. */
function payload(
  pairs: Array<[title: string, type: string, value: string]>,
): TypeformWebhookPayload {
  const fields = pairs.map(([title], i) => ({
    ref: `ref_${i}`,
    title,
    type: "multiple_choice",
  }));
  const answers = pairs.map(([, type, value], i) => {
    const base = { field: { ref: `ref_${i}`, type }, type };
    if (type === "choice") return { ...base, type: "choice", choice: { label: value } };
    if (type === "email") return { ...base, email: value };
    if (type === "text") return { ...base, text: value };
    return base;
  });
  return { form_response: { definition: { fields }, answers } };
}

describe("parseTypeformPayload", () => {
  it("routes each choice to the right enum via its question title", () => {
    const parsed = parseTypeformPayload(
      payload([
        ["Which best describes your platform?", "choice", "Crypto Exchange"],
        ["Approximate assets under management or custody?", "choice", "$50M – $250M"],
        ["Are user funds mostly sitting unused or actively earning returns?", "choice", "Mostly sitting unused"],
        ["Do you currently offer yield or reward products?", "choice", "In progress"],
        ["What type of yield product interests you most?", "choice", "Balanced yield portfolio"],
        ["Estimated first 3–6 months vault size?", "choice", "$1M – $5M"],
        ["Target launch timeline?", "choice", "1 - 3 months"],
        ["First name", "text", "Ada"],
        ["Email", "email", "ada@firm.com"],
      ]),
    );

    expect(parsed.answers.platformType).toBe("exchange");
    expect(parsed.answers.aum).toBe("50_250m");
    expect(parsed.answers.fundsUsage).toBe("idle");
    expect(parsed.answers.yieldStatus).toBe("in_progress");
    expect(parsed.answers.yieldType).toBe("balanced");
    expect(parsed.answers.vaultSize).toBe("1_5m");
    expect(parsed.answers.timeline).toBe("1_3m");
    expect(parsed.firstName).toBe("Ada");
    expect(parsed.email).toBe("ada@firm.com");
  });

  it("disambiguates 'Not sure yet' by question (aum vs vault size)", () => {
    const parsed = parseTypeformPayload(
      payload([
        ["Approximate assets under management or custody?", "choice", "Not sure yet"],
        ["Estimated first 3–6 months vault size?", "choice", "Not sure yet"],
      ]),
    );
    expect(parsed.answers.aum).toBe("unsure");
    expect(parsed.answers.vaultSize).toBe("unsure");
  });

  it("maps $10M – $50M to 10_50m (not 50_250m)", () => {
    const parsed = parseTypeformPayload(
      payload([
        ["Approximate assets under management or custody?", "choice", "$10M – $50M"],
      ]),
    );
    expect(parsed.answers.aum).toBe("10_50m");
  });

  it("normalises email to lowercase", () => {
    const parsed = parseTypeformPayload(
      payload([["Email", "email", "Ada@Firm.COM"]]),
    );
    expect(parsed.email).toBe("ada@firm.com");
  });

  it("never throws on an empty / malformed payload", () => {
    expect(parseTypeformPayload({})).toEqual({
      answers: {},
      email: null,
      firstName: null,
      lastName: null,
      phone: null,
      website: null,
    });
  });
});
