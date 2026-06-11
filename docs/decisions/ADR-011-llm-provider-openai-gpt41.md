# ADR-011 — LLM provider: OpenAI GPT-4.1 (single model, supersedes ADR-007)

**Status**: Accepted
**Date**: 2026-06-11
**Deciders**: Founder (Adrien) + Eng
**Supersedes**: ADR-007 (Kimi K2.6 via Hypercli)

## Context

ADR-007 (2026-05-26) pinned every LLM call — the 4 structured agents and the
cockpit chat — to **Kimi K2.6 via Hypercli** (OpenAI-compatible endpoint). In
practice Hypercli/Kimi underperformed for this workload and is being retired.

Two findings drove the switch:

1. **Hypercli is no longer used / unreliable.** Operationally dropped.
2. **An A/B replay of the 4 agents' real prompts** (system + injected
   methodology v1.0 + user prompt) on Kimi K2.6 vs GPT-4.1 vs GPT-4o-mini,
   through the production pipeline (`extractJson` → Zod `.strict()` →
   forbidden-words → assumption-citation), showed:

   | Model | full pipeline pass | schema valid | avg latency |
   |---|---|---|---|
   | **GPT-4.1** | **4/4** | 4/4 | **~5 s** |
   | Kimi K2.6 | 3/4 | 4/4 | **~52 s** |
   | GPT-4o-mini | 3/4 (leaked a forbidden word) | 4/4 | ~6 s |

3. **Thinking-model integration trap (the decisive bug).** Kimi K2.6 is a
   reasoning model: it returns the JSON in `message.content` **and** a large
   `reasoning_content` (6k–28k chars) that **shares the completion-token
   budget**. With the agents' `max_tokens` of 1024/4096 **and the full
   methodology injected**, the reasoning consumed the entire budget and
   `message.content` came back **empty** → `JSON.parse("")` → every agent
   failed. The production wrapper reads only `message.content`, so the agents
   were latent-broken / fragile on this model. GPT-4.1 has no such channel.

## Decision

**OpenAI GPT-4.1 is the single LLM provider for every LLM call in this
codebase** (4 agents + cockpit chat + review-document generator). No
abstraction/multi-provider layer is introduced — the swap is "hard" by
deliberate choice (simplicity over portability).

Concretely:

1. The shared client (`src/lib/llm/kimi.ts`) now constructs an OpenAI client
   from `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`, `OPENAI_ORG_ID`) and
   no longer points at Hypercli. The historical export names `kimi` /
   `KIMI_MODEL` are kept as **legacy aliases** that resolve to OpenAI /
   `OPENAI_MODEL` (default `gpt-4.1`) — to avoid churn across import sites.
2. All four agent model constants (`*_MODEL`) are `"gpt-4.1"`; `LlmRun.model`
   records `gpt-4.1`. The cockpit-chat allowlist is `[OPENAI_MODEL]`.
3. Cost tracking uses **GPT-4.1 list pricing** ($2.00 / $8.00 per MTOK),
   computed locally in `client.ts` (replaces `estimateKimiCostUsd`).
4. The `HYPERCLI_*` env vars are **deprecated** but kept optional so legacy
   `.env` files and `env.test.ts` don't break; no code path reads them.
5. All guardrails (Zod outputs, forbidden-words linter, assumption-citation,
   PTAI, APY range, disclaimers verbatim) are provider-agnostic and unchanged.
6. The `cache_control: "ephemeral"` shim is still ignored by the wrapper, but
   OpenAI applies **automatic prompt caching** for prompts >1024 tokens, so
   the re-sent methodology block is partially cached at no code cost.

## Consequences

### Positive
- **~10× lower latency** on the agents (5 s vs 52 s), no reasoning-budget trap.
- **Best compliance adherence** of the three candidates (4/4 in the A/B).
- **Western-vendor data-governance** posture, more defensible for the
  institutional Cayman structure than a Chinese provider.
- Migration was cheap: the codebase already used the `openai@6.x` SDK.

### Negative / risks
- **Single-vendor dependency on OpenAI** (re-lock, by choice). Switching again
  is still one file (`kimi.ts`) + the model constants.
- **Higher per-token list price** than Kimi's headline rate; offset by far
  fewer wasted/empty calls and OpenAI auto prompt-caching. Reconcile against
  the first OpenAI invoice; if billing deviates >10 % from `LlmRun.costUsd`,
  update the pricing constants in `client.ts`.
- **GPT-4o-mini is NOT adopted** for any compliance-bound output: in the A/B it
  leaked a forbidden word ("certain"). Mini may only be used for cheap internal
  steps (routing/classification), never the final investor-facing answer.

## Non-decisions (out of scope)
- No provider-abstraction layer / multi-vendor fallback (explicitly rejected in
  favour of a hard swap; revisit only if OpenAI reliability becomes a problem).
- OpenAI **strict structured outputs** (`response_format: json_schema`) are not
  wired here; the prompt + `extractJson` pipeline is unchanged. Adopting strict
  mode would guarantee 100 % schema validity and is a clean P2 follow-up.
- `n=1` per agent in the A/B (indicative, not a variance study).
