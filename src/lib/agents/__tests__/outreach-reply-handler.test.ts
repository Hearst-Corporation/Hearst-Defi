/**
 * Tests for src/lib/agents/outreach-reply-handler.ts
 *
 * The LLM classify call is exercised with an injected client stub (no network).
 * The pure action mapping (`actionForIntent`) is covered exhaustively.
 */

import { describe, expect, it } from "vitest";

import {
  actionForIntent,
  classifyReply,
  REPLY_INTENTS,
  type ReplyIntent,
} from "@/lib/agents/outreach-reply-handler";
import type { LlmClientLike, LlmResponse } from "@/lib/llm/client";

// ---------------------------------------------------------------------------
// actionForIntent — pure mapping
// ---------------------------------------------------------------------------

describe("actionForIntent", () => {
  it("interested → promote + qualify + stop cadence, no suppress", () => {
    const o = actionForIntent("interested");
    expect(o).toMatchObject({
      promote: true,
      qualify: true,
      stopCadence: true,
      suppress: false,
      action: "qualify",
    });
  });

  it("unsubscribe and bounce → suppress + stop", () => {
    for (const intent of ["unsubscribe", "bounce"] as ReplyIntent[]) {
      const o = actionForIntent(intent);
      expect(o.suppress).toBe(true);
      expect(o.stopCadence).toBe(true);
      expect(o.action).toBe("suppress");
    }
  });

  it("not_now / question / other → stop cadence, no suppress, no promote", () => {
    for (const intent of ["not_now", "question", "other"] as ReplyIntent[]) {
      const o = actionForIntent(intent);
      expect(o).toMatchObject({
        suppress: false,
        promote: false,
        qualify: false,
        stopCadence: true,
        action: "stop",
      });
    }
  });

  it("auto_reply → no action, cadence keeps running", () => {
    expect(actionForIntent("auto_reply")).toMatchObject({
      suppress: false,
      stopCadence: false,
      action: "none",
    });
  });

  it("covers every declared intent", () => {
    for (const intent of REPLY_INTENTS) {
      expect(() => actionForIntent(intent)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// classifyReply — with an injected LLM client (no network)
// ---------------------------------------------------------------------------

/** Builds a stub LlmClientLike that returns a fixed JSON text block. */
function stubClient(json: string): LlmClientLike {
  const response: LlmResponse = {
    id: "test-id",
    model: "gpt-4.1",
    content: [{ type: "text", text: json }],
    usage: { input_tokens: 20, output_tokens: 20 },
  };
  return { messages: { create: async () => response } };
}

describe("classifyReply", () => {
  it("parses a clean classification and clamps confidence", async () => {
    const client = stubClient(
      '{"intent":"interested","confidence":150,"summary":"Wants a call next week."}',
    );
    const r = await classifyReply(
      { fromEmail: "a@b.com", subject: "Re: hi", body: "Sounds great, let's talk." },
      { client },
    );
    expect(r.intent).toBe("interested");
    expect(r.confidence).toBe(100); // clamped from 150
    expect(r.summary).toContain("call");
  });

  it("strips a markdown fence around the JSON", async () => {
    const client = stubClient(
      '```json\n{"intent":"unsubscribe","confidence":95,"summary":"Asked to be removed."}\n```',
    );
    const r = await classifyReply(
      { fromEmail: "x@y.com", subject: null, body: "remove me from your list" },
      { client },
    );
    expect(r.intent).toBe("unsubscribe");
    expect(r.confidence).toBe(95);
  });

  it("throws on an invalid intent", async () => {
    const client = stubClient('{"intent":"maybe","confidence":50,"summary":"x"}');
    await expect(
      classifyReply({ fromEmail: "x@y.com", subject: null, body: "..." }, { client }),
    ).rejects.toThrow(/invalid output/);
  });
});
