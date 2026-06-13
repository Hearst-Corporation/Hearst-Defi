import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PRODUCT_CHAT_EVENT_PREFIX,
  withProductChatStreamEvents,
} from "@/lib/llm/product-chat-stream";

function streamFromText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

describe("withProductChatStreamEvents", () => {
  it("adds progressive product chart events for admin product workspace intents", async () => {
    const out = await readAll(
      withProductChatStreamEvents({
        stream: streamFromText("Je cadre le produit puis je construis les hypothèses."),
        message: "Créer un nouveau produit Defensive",
        navProfile: "admin",
      }),
    );

    expect(out).toContain(PRODUCT_CHAT_EVENT_PREFIX);
    expect(out).toContain('"type":"product_chart"');
    expect(out).toContain('"title":"Capital Stack"');
    expect(out).toContain("Je cadre le produit");
  });

  it("does not add chart events for LP chats", async () => {
    const out = await readAll(
      withProductChatStreamEvents({
        stream: streamFromText("Voici le portefeuille."),
        message: "Créer un nouveau produit Defensive",
        navProfile: "lp",
      }),
    );

    expect(out).toBe("Voici le portefeuille.");
  });

  it("does not add chart events for pure simulation intents", async () => {
    const out = await readAll(
      withProductChatStreamEvents({
        stream: streamFromText("Je lance Scenario Lab."),
        message: "simuler un scénario BTC bear",
        navProfile: "admin",
      }),
    );

    expect(out).toBe("Je lance Scenario Lab.");
  });
});
