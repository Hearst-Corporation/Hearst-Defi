import "server-only";

import { InferenceClient } from "@huggingface/inference";

import { env } from "@/lib/env";

/**
 * Hugging Face Inference client — mirror of `openai.ts`.
 *
 * Scope: the small specialised models the OpenAI provider does NOT serve —
 * zero-shot NLI classification for the SEMANTIC compliance guard (a SECOND
 * screen behind the keyword guard in `forbidden-words.ts`). Not a chat backend:
 * generation stays on OpenAI (ADR-011). HF here = cheap encoder-only models for
 * paraphrase-robust compliance detection.
 *
 * Token resolution precedence: HF_TOKEN ?? HUGGINGFACE_API_KEY. Configuration
 * is sourced exclusively from the validated env (`@/lib/env`). HF is OPTIONAL
 * (env marks both names `.optional()`): the semantic guard is a best-effort
 * second screen that fails open when HF is unavailable (`HF_AVAILABLE` / the
 * try-catch in `semantic-guard.ts`). So a missing token throws at import only at
 * NORMAL RUNTIME (to surface a real prod misconfiguration). During `next build`
 * (NEXT_PHASE === "phase-production-build") OR under test (NODE_ENV === "test",
 * e.g. Vitest with no HF secret) it yields a stub that throws on first USE — the
 * module loads, `HF_AVAILABLE` stays false, and every importer (chat-agent,
 * route guards, …) degrades gracefully instead of crashing at load. Same
 * deferral contract as `openai.ts`.
 */

const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";
/** Vitest/CI without an HF secret: defer the missing-token error to first use so
 *  module import succeeds and the fail-open semantic guard can skip HF.
 *  `VITEST` is Vitest's own reliable marker — `NODE_ENV` alone is not: a
 *  parent shell that already exports `NODE_ENV=development` is inherited
 *  as-is (Vitest only sets it when unset), so `NODE_ENV === "test"` can miss. */
const IS_TEST = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

/** Resolved HF token, or null when neither env var is set. */
const HF_TOKEN_RESOLVED: string | null =
  env.HF_TOKEN?.trim() || env.HUGGINGFACE_API_KEY?.trim() || null;

/**
 * Returns a Proxy-backed InferenceClient that throws a clear error the first
 * time any property is touched — lets module import succeed during `next build`
 * while ensuring any runtime call fails loudly with context.
 */
function buildPlaceholderClient(reason: string): InferenceClient {
  const throwStub = (): never => {
    throw new Error(reason);
  };
  const handler: ProxyHandler<object> = {
    get(_target, prop): unknown {
      if (typeof prop === "symbol") return undefined;
      return new Proxy(throwStub, handler);
    },
    apply(): never {
      return throwStub();
    },
  };
  return new Proxy({}, handler) as InferenceClient;
}

function createHuggingFaceClient(): InferenceClient {
  if (!HF_TOKEN_RESOLVED) {
    const reason =
      "HF_TOKEN (or HUGGINGFACE_API_KEY) is not configured. Set it in the " +
      "environment to use Hugging Face inference features.";
    if (IS_BUILD_PHASE || IS_TEST) {
      return buildPlaceholderClient(reason);
    }
    throw new Error(reason);
  }
  return new InferenceClient(HF_TOKEN_RESOLVED);
}

/** True when an HF token is configured — lets callers skip HF gracefully. */
export const HF_AVAILABLE: boolean = HF_TOKEN_RESOLVED !== null;

/** The Hugging Face Inference client (encoder-only / zero-shot tasks). */
export const huggingface: InferenceClient = createHuggingFaceClient();

/** Zero-shot NLI model id — `HF_ZEROSHOT_MODEL` env (multilingual FR+EN). */
export const HF_ZEROSHOT_MODEL: string = env.HF_ZEROSHOT_MODEL;
