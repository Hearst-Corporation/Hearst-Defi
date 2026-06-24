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

describe("chatOutputViolation — yield education (BUG 1) is allowed", () => {
  it("does NOT block a generic 'how does yield work' answer", () => {
    const answer =
      "Le yield correspond au rendement généré par une stratégie ou un produit financier, souvent exprimé en APY. Il peut provenir de frais, d’intérêts, de récompenses ou de revenus de protocole selon la structure. Il varie dans le temps, dépend des risques, et n’est pas garanti.";
    expect(chatOutputViolation(answer, true)).toBeNull();
  });

  it("does NOT block a per-source breakdown (mining / USDC base / réserve)", () => {
    const answer =
      "Le rendement provient de plusieurs sources : le cashflow du mining contribue environ 6,2 %, le yield USDC de base environ 4,8 %, et la réserve stable environ 4,5 %. Le rendement annualisé cible reste une fourchette de 8 à 15 %, et n’est pas garanti.";
    expect(chatOutputViolation(answer, true)).toBeNull();
  });

  it("STILL blocks a headline single-point claim in an otherwise educational answer", () => {
    const answer =
      "Le yield est le rendement d’un produit. Le rendement annualisé de ce vault est de 11 %.";
    expect(chatOutputViolation(answer, true)).toBe("single_point_apy");
  });

  it("STILL blocks a forbidden-words claim in an educational answer", () => {
    expect(
      chatOutputViolation("Le yield est le rendement. Ici il est garanti.", true),
    ).toBe("forbidden_words");
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

  it("flags a single-point APY hidden by an INCIDENTAL numeric range (P1)", () => {
    // P1: a range elsewhere in the sentence (farms, years, multiples) must NOT
    // excuse a single-point APY percentage. Only a range that itself carries a
    // `%` (a genuine fourchette) is compliant.
    expect(
      chatOutputViolation("Sur 8 à 15 fermes partenaires, l'APY ressort à 11 %.", true),
    ).toBe("single_point_apy");
    expect(
      chatOutputViolation("Entre 2024 et 2026, l'APY est de 11 %.", true),
    ).toBe("single_point_apy");
    expect(
      chatOutputViolation("L'APY est de 11 %, soit 3-4 fois le livret A.", true),
    ).toBe("single_point_apy");
    expect(
      chatOutputViolation("L'APY est de 11 % sur 5 à 7 ans.", true),
    ).toBe("single_point_apy");
  });

  it("still accepts a genuine percentage fourchette (no P1 false positive)", () => {
    expect(chatOutputViolation("APY: 8 % à 15 %.", true)).toBeNull();
    expect(chatOutputViolation("APY entre 8 % et 15 % cible.", true)).toBeNull();
    expect(
      chatOutputViolation("L'APY se situe dans la fourchette cible.", true),
    ).toBeNull();
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
