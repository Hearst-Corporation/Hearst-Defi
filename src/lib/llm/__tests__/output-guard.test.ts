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

describe("chatOutputViolation — product education is allowed (compliant phrasing)", () => {
  it("does NOT block a generic 'how do the products work' answer", () => {
    const answer =
      "Les produits Hearst sont des structures d’investissement qui organisent une stratégie, ses paramètres, ses risques, son statut et ses documents. Un produit peut rester en draft, être préparé pour revue, puis passer par des garde-fous avant toute mise en ligne. Je peux expliquer le fonctionnement général et les risques, mais pas recommander un investissement personnalisé.";
    expect(chatOutputViolation(answer, true)).toBeNull();
  });

  it("does NOT block a product lineup that keeps every target as a range / qualitative", () => {
    const answer =
      "Hearst propose plusieurs vaults : le Yield Vault vise une fourchette de 8 à 15 % cible, le Defensive a un profil plus prudent, et le BTC Plus offre une exposition BTC plus offensive. Les rendements ne sont pas garantis.";
    expect(chatOutputViolation(answer, true)).toBeNull();
  });

  it("does NOT block an allocation breakdown for a product", () => {
    const answer =
      "Le Yield Vault répartit son allocation cible : mining 60 %, BTC tactique 25 %, USDC base 10 %, réserve stable 5 %.";
    expect(chatOutputViolation(answer, true)).toBeNull();
  });

  it("STILL blocks a single-point target for a secondary vault (the model must not phrase it this way)", () => {
    // The guard is correct here — this is why the PROMPT was fixed to keep every
    // vault target a range / qualitative rather than weakening the guard.
    expect(
      chatOutputViolation("Le Defensive vise un rendement annualisé d’environ 6 %.", true),
    ).toBe("single_point_apy");
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

  // --- Streaming APY leak (audit P1) -------------------------------------
  // A single-point APY sentence LONGER than the 64-char SETTLE window used to
  // leak its misleading prefix ("…, net de frais …, est de ") to the user before
  // the "11 %" reached the scan window. The sentence-boundary hold-back must keep
  // that prefix UN-emitted: the consumer sees the block sentinel, never the lead-in.
  it("does not leak the misleading prefix of a long single-point APY sentence", async () => {
    // One sentence, > 64 chars (the SETTLE window), ending in a single-point
    // claim with the yield keyword within detection range of the %. Streamed one
    // char per chunk to maximise the chance of an early SETTLE-window flush.
    const sentence =
      "Pour être tout à fait précis avec vous aujourd'hui, le rendement est de 11 %.";
    expect(sentence.length).toBeGreaterThan(64);
    const chunks = [...sentence]; // one char per chunk
    const out = await readAll(guardChatStream(streamFromChunks(chunks)));
    // The claim is blocked…
    expect(out).toContain(BLOCK_SENTINEL);
    // …and NONE of the misleading prefix reached the consumer. Nothing of the
    // sentence may appear before the sentinel — the whole yield sentence was held
    // until validated, then blocked.
    const beforeSentinel = out.slice(0, out.indexOf(BLOCK_SENTINEL));
    expect(beforeSentinel).not.toContain("Pour être tout à fait précis");
    expect(beforeSentinel).not.toContain("le rendement");
  });

  it("still streams a long COMPLIANT yield sentence (range) in full", async () => {
    // A long (>64 char) sentence that resolves to a RANGE must NOT be held/blocked.
    const sentence =
      "Pour être tout à fait précis avec vous aujourd'hui, le rendement se situe entre 8 et 15 %.";
    expect(sentence.length).toBeGreaterThan(64);
    const chunks = [...sentence];
    const out = await readAll(guardChatStream(streamFromChunks(chunks)));
    expect(out).not.toContain(BLOCK_SENTINEL);
    expect(out).toBe(sentence);
  });

  it("holds a yield sentence split across chunks until it completes as a range", async () => {
    // The yield keyword arrives, THEN the range — split so the keyword is settled
    // before the range. The hold-back must wait for the sentence boundary, so the
    // full compliant sentence streams and nothing is blocked.
    const chunks = [
      "Pour répondre précisément : le rendement annualisé du vault ",
      "se situe historiquement ",
      "entre 8 et 15 % selon les conditions de marché.",
    ];
    const out = await readAll(guardChatStream(streamFromChunks(chunks)));
    expect(out).not.toContain(BLOCK_SENTINEL);
    expect(out).toBe(chunks.join(""));
  });
});

// ---------------------------------------------------------------------------
// Educational-context invariance (Agentic Router Stabilization lot).
//
// The educational read-only steering added in the chat route is PROMPT-ONLY:
// it appends a directive to the system message. The output guard has NO intent
// parameter — its signature is `chatOutputViolation(text, final?)` — so an
// "educational" turn CANNOT relax it. These tests pin that invariant: the same
// forbidden / single-point claims stay blocked, and the same compliant
// educational answers (ranges, source breakdowns) stay allowed, with no third
// argument available to change the verdict.
// ---------------------------------------------------------------------------
describe("chatOutputViolation — uniform regardless of educational context", () => {
  it("the classifier exposes no intent/context parameter (cannot be relaxed)", () => {
    // arity is (text, final?) — exactly 1 required param, 1 optional.
    expect(chatOutputViolation.length).toBe(1);
  });

  it("STILL blocks a guaranteed-return claim", () => {
    expect(chatOutputViolation("Le vault rend un rendement garanti.", true)).toBe(
      "forbidden_words",
    );
  });

  it("STILL blocks a 'sans risque' claim", () => {
    expect(chatOutputViolation("Ce produit est sans risque.", true)).toBe(
      "forbidden_words",
    );
  });

  it("STILL blocks a single-point headline APY", () => {
    expect(chatOutputViolation("L'APY du vault est de 11 %.", true)).toBe(
      "single_point_apy",
    );
  });

  it("ALLOWS a compliant range in an educational answer", () => {
    expect(
      chatOutputViolation(
        "Le rendement cible se situe dans une fourchette de 8 à 15 %.",
        true,
      ),
    ).toBeNull();
  });

  it("ALLOWS an honest per-source breakdown in an educational answer", () => {
    expect(
      chatOutputViolation(
        "Le yield provient du mining (~6,2 %), de la base USDC (~4,8 %) et de la réserve (~4,5 %).",
        true,
      ),
    ).toBeNull();
  });
});
