import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
// brief.ts imports draft.ts (→ prisma) for persistGeneratedBrief; this test
// only exercises the stream/guard, so stub the DB layer to avoid pulling in the
// Prisma client at import (and the unrelated sqlite/postgres provider mismatch).
vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  runProductWorkspaceBrief,
  buildBriefSystemPrompt,
  type BriefStreamClient,
} from "@/lib/product-workspace/brief";

/** Builds a fake streaming client that yields the given content chunks. */
function fakeClient(chunks: string[]): BriefStreamClient {
  return {
    chat: {
      completions: {
        create: async () => ({
          async *[Symbol.asyncIterator]() {
            for (const c of chunks) {
              yield { choices: [{ delta: { content: c } }] };
            }
          },
        }),
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
  return out + dec.decode();
}

describe("buildBriefSystemPrompt", () => {
  it("embeds the objective and inferred vault, and the compliance rules", () => {
    const prompt = buildBriefSystemPrompt("Créer un vault Defensive");
    expect(prompt).toContain("Créer un vault Defensive");
    expect(prompt).toContain("Vault inféré:");
    expect(prompt).toContain("fourchette"); // APY-as-range rule
    expect(prompt).toContain("garantie"); // forbidden-words rule listed
  });
});

describe("runProductWorkspaceBrief", () => {
  it("streams the brief token-by-token and resolves final with the full text", async () => {
    const { stream, final } = runProductWorkspaceBrief(
      fakeClient(["Objectif reformulé. ", "Vault HDV. ", "Fourchette 8 à 12 % cible."]),
      "gpt-4.1",
      "Créer un vault Defensive",
    );
    const streamed = await readAll(stream);
    const full = await final;

    expect(full).toBe("Objectif reformulé. Vault HDV. Fourchette 8 à 12 % cible.");
    expect(streamed).toContain("Objectif reformulé.");
    expect(streamed).toContain("Fourchette 8 à 12 % cible.");
  });

  it("blocks a non-compliant brief (single-point APY) via the compliance guard", async () => {
    const { stream } = runProductWorkspaceBrief(
      fakeClient(["Ce vault délivre un APY de 11 % chaque mois, sans risque."]),
      "gpt-4.1",
      "Créer un vault Defensive",
    );
    const streamed = await readAll(stream);
    // The guard emits the \x00ERROR: sentinel and never lets the bad span through.
    expect(streamed).toContain("\x00ERROR:");
    expect(streamed).not.toContain("APY de 11 %");
  });

  it("closes gracefully on an upstream error and resolves final to empty", async () => {
    const erroringClient: BriefStreamClient = {
      chat: {
        completions: {
          create: async () => {
            throw new Error("upstream down");
          },
        },
      },
    };
    const { stream, final } = runProductWorkspaceBrief(
      erroringClient,
      "gpt-4.1",
      "Créer un vault Defensive",
    );
    const streamed = await readAll(stream);
    const full = await final;
    expect(full).toBe("");
    expect(streamed).toBe("");
  });
});
