import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runChatAgent, type StreamingChatClient } from "@/lib/llm/chat-agent";
import { BLOCK_SENTINEL } from "@/lib/llm/output-guard";

type Chunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

function textChunk(content: string): Chunk {
  return { choices: [{ delta: { content } }] };
}

function toolChunk(
  index: number,
  fn: { name?: string; arguments?: string },
): Chunk {
  return { choices: [{ delta: { tool_calls: [{ index, function: fn }] } }] };
}

function fakeClient(
  chunks: Chunk[],
  opts?: { throwOnCreate?: boolean },
): StreamingChatClient {
  return {
    chat: {
      completions: {
        create: async () => {
          if (opts?.throwOnCreate) throw new Error("upstream down");
          return (async function* () {
            for (const c of chunks) yield c;
          })();
        },
      },
    },
  };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  out += dec.decode();
  return out;
}

const MSGS = [
  { role: "system" as const, content: "sys" },
  { role: "user" as const, content: "hi" },
];

describe("runChatAgent", () => {
  it("streams a text-only answer and resolves nav=null", async () => {
    const client = fakeClient([
      textChunk("Target 8 à 15 % annualisé, "),
      textChunk("distributions mensuelles."),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toBe("Target 8 à 15 % annualisé, distributions mensuelles.");
    expect(await nav).toBeNull();
  });

  it("captures a navigate tool call (fragmented args) and resolves the destination", async () => {
    const client = fakeClient([
      textChunk("Voici votre portefeuille. "),
      toolChunk(0, { name: "navigate", arguments: '{"desti' }),
      toolChunk(0, { arguments: 'nation":"portfolio"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toBe("Voici votre portefeuille. ");
    const dest = await nav;
    expect(dest?.route).toBe("/portfolio");
  });

  it("ignores an unknown navigate destination", async () => {
    const client = fakeClient([
      textChunk("D'accord. "),
      toolChunk(0, { name: "navigate", arguments: '{"destination":"admin"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    expect(await nav).toBeNull();
  });

  it("does NOT navigate when the answer is non-compliant (blocked)", async () => {
    const client = fakeClient([
      textChunk("Le rendement est garanti. "),
      toolChunk(0, { name: "navigate", arguments: '{"destination":"portfolio"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toContain(BLOCK_SENTINEL);
    expect(await nav).toBeNull();
  });

  it("surfaces an upstream create() failure as an error sentinel, nav=null", async () => {
    const client = fakeClient([], { throwOnCreate: true });
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toContain("\x00ERROR:");
    expect(await nav).toBeNull();
  });
});
