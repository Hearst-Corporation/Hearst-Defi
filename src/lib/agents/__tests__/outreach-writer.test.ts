import { describe, expect, it } from "vitest";

import {
  OutreachDraftSchema,
  draftColdEmail,
  type OutreachAudience,
} from "../outreach-writer";
import type { LlmClientLike, LlmParams, LlmResponse } from "@/lib/llm/client";

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

// ---------------------------------------------------------------------------
// draftColdEmail — audience framing in the system prompt
//
// We inject a mock LLM client that captures the LlmParams it receives so we
// can assert on the system prompt content without hitting the real OpenAI API.
// Prisma writes go to the local SQLite dev.db (vitest.setup.ts).
// ---------------------------------------------------------------------------

/** Builds a minimal LlmClientLike mock that captures the last call's params
 *  and returns a valid outreach draft JSON so the agent's parse+guard passes.
 *  `bodyText` overrides the returned body so tests can simulate a model that
 *  drops (or keeps) the CTA link. */
function makeMockClient(
  capture: { params: LlmParams | null },
  bodyText = "Test body content that is long enough.",
) {
  const mockResponse: LlmResponse = {
    id: "mock-id",
    model: "gpt-4.1",
    content: [
      {
        type: "text",
        text: JSON.stringify({ subject: "Test subject", body: bodyText }),
      },
    ],
    usage: { input_tokens: 10, output_tokens: 20 },
  };

  const client: LlmClientLike = {
    messages: {
      create: async (params: LlmParams): Promise<LlmResponse> => {
        capture.params = params;
        return mockResponse;
      },
    },
  };
  return client;
}

const BASE_PROSPECT = {
  email: "alice@wealth.example",
  firstName: "Alice",
  lastName: "Dupont",
  company: "Alpha WM",
  title: "Managing Director",
};

const TYPEFORM_URL = "https://connect.hearst.app/apply";

describe("draftColdEmail — audience framing in system prompt", () => {
  it("distributor audience: system prompt contains distributor-partnership framing", async () => {
    const capture: { params: LlmParams | null } = { params: null };
    const client = makeMockClient(capture);

    await draftColdEmail(
      { prospect: BASE_PROSPECT, typeformUrl: TYPEFORM_URL, audience: "distributor" },
      { client },
    );

    const systemText =
      typeof capture.params?.system === "string"
        ? capture.params.system
        : (capture.params?.system ?? [])
            .map((b) => (b.type === "text" ? b.text : ""))
            .join("\n");

    // Must signal the distributor path with explicit markers.
    expect(systemText).toMatch(/DISTRIBUTOR/i);
    // Distribution-partnership angle must be present.
    expect(systemText).toMatch(/distribution partnership|their clients|their own clients/i);
    // The subscriber-direct objective phrase is absent in the distributor path:
    // the subscriber prompt says "qualified INSTITUTIONAL INVESTOR who could
    // allocate to the vault directly" — that phrase must not appear here.
    expect(systemText).not.toMatch(/INSTITUTIONAL INVESTOR who could allocate to the vault directly/i);
    // The subscriber CTA framing ("qualify themselves") is also absent.
    expect(systemText).not.toMatch(/invite the prospect to qualify themselves/i);
  });

  it("subscriber audience (default): system prompt retains direct-investor framing", async () => {
    const capture: { params: LlmParams | null } = { params: null };
    const client = makeMockClient(capture);

    // Omitting audience entirely → should default to subscriber.
    await draftColdEmail(
      { prospect: BASE_PROSPECT, typeformUrl: TYPEFORM_URL },
      { client },
    );

    const systemText =
      typeof capture.params?.system === "string"
        ? capture.params.system
        : (capture.params?.system ?? [])
            .map((b) => (b.type === "text" ? b.text : ""))
            .join("\n");

    // The subscriber path targets a direct institutional investor.
    expect(systemText).toMatch(/INSTITUTIONAL INVESTOR/i);
    // Must invite the prospect to qualify themselves via the form.
    expect(systemText).toMatch(/qualify themselves/i);
    // Must NOT contain the distributor-specific partnership framing.
    expect(systemText).not.toMatch(/distribution partnership/i);
    expect(systemText).not.toMatch(/their own clients/i);
  });
});

// ---------------------------------------------------------------------------
// draftColdEmail — CTA backstop
//
// The system prompt asks the model to embed the qualification URL verbatim, but
// a prompt is not a guarantee. draftColdEmail must deterministically repair a
// body that drops the link so no cold email ever ships as a dead-end.
// ---------------------------------------------------------------------------

describe("draftColdEmail — CTA link backstop", () => {
  it("appends the CTA URL when the model drops it from the body", async () => {
    const capture: { params: LlmParams | null } = { params: null };
    // Simulate a model that produced a body WITHOUT the qualification link.
    const client = makeMockClient(capture, "A short note about Hearst Connect.");

    const draft = await draftColdEmail(
      { prospect: BASE_PROSPECT, typeformUrl: TYPEFORM_URL },
      { client },
    );

    expect(draft.body).toContain(TYPEFORM_URL);
  });

  it("does not duplicate the CTA URL when the model already embedded it", async () => {
    const capture: { params: LlmParams | null } = { params: null };
    const bodyWithCta = `Hello — here is the form: ${TYPEFORM_URL}`;
    const client = makeMockClient(capture, bodyWithCta);

    const draft = await draftColdEmail(
      { prospect: BASE_PROSPECT, typeformUrl: TYPEFORM_URL },
      { client },
    );

    // The URL must appear exactly once — the backstop must not re-append it.
    const occurrences = draft.body.split(TYPEFORM_URL).length - 1;
    expect(occurrences).toBe(1);
  });
});
