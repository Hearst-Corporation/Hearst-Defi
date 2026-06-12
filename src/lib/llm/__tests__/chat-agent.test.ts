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

  // BUG B1 — repro: a stream that yields one chunk then HANGS forever (never
  // returns). Without an internal abort the turn (and nav) would deadlock the
  // route. With a short injected timeout the stream ends and nav resolves.
  it("aborts a hanging upstream stream via internal timeout and settles nav", async () => {
    const hangingClient: StreamingChatClient = {
      chat: {
        completions: {
          create: async (_params, options) =>
            (async function* () {
              yield textChunk("Un instant");
              // Stall forever unless the injected AbortSignal fires.
              await new Promise<void>((_resolve, reject) => {
                const signal = options?.signal;
                if (signal) {
                  if (signal.aborted) {
                    reject(new Error("aborted"));
                    return;
                  }
                  signal.addEventListener(
                    "abort",
                    () => reject(new Error("aborted")),
                    { once: true },
                  );
                }
              });
            })(),
        },
      },
    };

    const { stream, nav } = runChatAgent(hangingClient, "gpt-4.1", MSGS, {
      timeoutMs: 30,
    });
    // Must resolve (not hang). readAll completing IS the assertion the stream
    // ended; the partial text streamed before the stall is preserved.
    const text = await readAll(stream);
    expect(text).toContain("Un instant");
    expect(await nav).toBeNull();
  });

  // BUG B2 — repro: tool-call-only completion with NO text content. The bubble
  // must not be empty — a short FR fallback sentence is emitted, and nav still
  // resolves the chosen destination.
  it("emits a fallback sentence when the model returns a tool call with no text", async () => {
    const client = fakeClient([
      toolChunk(0, { name: "navigate", arguments: '{"destination":"portfolio"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toContain(BLOCK_SENTINEL);
    const dest = await nav;
    expect(dest?.route).toBe("/portfolio");
  });

  it("resolves `final` with the answer text for persistence (compliant)", async () => {
    const client = fakeClient([textChunk("Réponse compliant.")]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    expect(await final).toEqual({ text: "Réponse compliant.", blocked: false });
  });

  it("resolves `final` blocked=true with empty text on a non-compliant answer", async () => {
    const client = fakeClient([textChunk("Le rendement est garanti.")]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    expect(await final).toEqual({ text: "", blocked: true });
  });
});
