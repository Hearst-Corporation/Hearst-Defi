import { describe, expect, it } from "vitest";

import {
  BLOCK_SENTINEL,
  chatOutputViolation,
  guardChatStream,
} from "@/lib/llm/output-guard";

// ---------------------------------------------------------------------------
// chatOutputViolation — pure classifier
// ---------------------------------------------------------------------------

describe("chatOutputViolation — forbidden vocabulary", () => {
  it("flags a bare French guarantee claim", () => {
    expect(chatOutputViolation("Le rendement est garanti.", true)).toBe(
      "forbidden_words",
    );
    expect(chatOutputViolation("C'est un placement sans risque.", true)).toBe(
      "forbidden_words",
    );
  });

  it("flags an embedded English claim", () => {
    expect(chatOutputViolation("This yield is risk-free.", true)).toBe(
      "forbidden_words",
    );
  });

  it("does NOT flag the required 'non garanti' disclaimers", () => {
    expect(chatOutputViolation("Ce rendement n'est pas garanti.", true)).toBeNull();
    expect(
      chatOutputViolation("Projection conditionnelle, sans garantie de résultat.", true),
    ).toBeNull();
  });
});

describe("chatOutputViolation — single-point APY", () => {
  it("flags a single-point APY", () => {
    expect(chatOutputViolation("L'APY est de 11 %.", true)).toBe(
      "single_point_apy",
    );
  });

  it("does NOT flag an APY range", () => {
    expect(chatOutputViolation("L'APY cible est de 8 à 15 %.", true)).toBeNull();
    expect(chatOutputViolation("APY entre 8 et 15 %.", true)).toBeNull();
    expect(chatOutputViolation("Fourchette cible 9.4-12.8% annualisé d'APY.", true))
      .toBeNull();
    expect(chatOutputViolation("L'APY oscille entre 8 % et 15 %.", true)).toBeNull();
  });

  it("flags a single-point APY even when the sentence contains a bare 'à'", () => {
    // BUG #2: a bare 'à' must NOT count as a numeric range marker.
    expect(chatOutputViolation("L'APY est à 11 %.", true)).toBe(
      "single_point_apy",
    );
    expect(
      chatOutputViolation(
        "Pour répondre à votre question, l'APY est de 11 %.",
        true,
      ),
    ).toBe("single_point_apy");
    expect(chatOutputViolation("L'APY ressort déjà à 11 %.", true)).toBe(
      "single_point_apy",
    );
  });

  it("flags a single-point APY even with a second incidental percentage", () => {
    // Two percentages, but the APY itself is a single point.
    expect(
      chatOutputViolation("L'APY est de 11 % avec un uptime de 99 %.", true),
    ).toBe("single_point_apy");
  });

  it("does NOT flag an incidental percentage without APY", () => {
    expect(chatOutputViolation("L'uptime des fleets est de 99 %.", true)).toBeNull();
  });

  it("does not flag an incomplete sentence mid-stream (range may still complete)", () => {
    // No terminator, not final → the trailing fragment is not yet judged.
    expect(chatOutputViolation("L'APY cible est de 8", false)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// guardChatStream — streaming wrapper
// ---------------------------------------------------------------------------

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(ctrl) {
      for (const c of chunks) ctrl.enqueue(enc.encode(c));
      ctrl.close();
    },
  });
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

describe("guardChatStream", () => {
  it("passes a compliant answer through unchanged (full text, no sentinel)", async () => {
    const chunks = [
      "Target 8 à 15 % annualisé, ",
      "distributions mensuelles en USDC, ",
      "lock-up souple 60 jours. Ce rendement n'est pas garanti.",
    ];
    const out = await readAll(guardChatStream(streamFromChunks(chunks)));
    expect(out).toBe(chunks.join(""));
    expect(out).not.toContain(BLOCK_SENTINEL);
  });

  it("blocks a forbidden claim and never emits it", async () => {
    const chunks = [
      "Bonne question. ",
      "Le rendement est garanti",
      " à 12 % par an.",
    ];
    const out = await readAll(guardChatStream(streamFromChunks(chunks)));
    expect(out).toContain(BLOCK_SENTINEL);
    expect(out).not.toContain("garanti à 12");
  });

  it("blocks a single-point APY claim", async () => {
    const chunks = ["D'accord. ", "L'APY est de 11 %.", " Voilà."];
    const out = await readAll(guardChatStream(streamFromChunks(chunks)));
    expect(out).toContain(BLOCK_SENTINEL);
  });
});
