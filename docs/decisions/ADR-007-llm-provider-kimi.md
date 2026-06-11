# ADR-007 — LLM provider: Kimi K2.6 via Hypercli (single model, no Anthropic SDK)

> **⚠️ SUPERSEDED by [ADR-011](./ADR-011-llm-provider-openai-gpt41.md) (2026-06-11).**
> Hypercli/Kimi was retired (latency + a thinking-model trap that returned empty
> `content`); the single provider is now **OpenAI GPT-4.1**. The "no Anthropic
> SDK" stance still holds. The text below is kept for historical record.

**Status**: Superseded by ADR-011
**Date**: 2026-05-26
**Deciders**: Founder (Adrien) + Eng

## Context

Earlier docs (CLAUDE.md, `/docs/spec/09-agents.mdx`, roadmap snapshot, multiple
in-code comments) advertised a split-model Anthropic SDK setup:

- Sonnet 4.6 for the three "ops" agents — Scenario Narrative, Mining Health,
  Risk Explanation.
- Opus 4.7 for the Investor Memo agent.
- Native Anthropic **prompt caching** on methodology / glossary / disclaimers.

The horizon audit on 2026-05-26 (`docs/audit/horizon-2026-05-26.html`) revealed
this is **not** what the code does:

- `package.json` has **no `@anthropic-ai/sdk`** dependency.
- `src/lib/agents/client.ts` uses the **`openai@6.x` SDK** pointed at
  `HYPERCLI_BASE_URL` with `HYPERCLI_API_KEY`.
- All four agents call the **single model `kimi-k2.6`** (env
  `HYPERCLI_DEFAULT_MODEL`).
- `cache_control: { type: "ephemeral" }` is accepted in `SystemTextBlock` for
  forward compatibility but **silently ignored** by the Kimi endpoint (no
  native prompt caching). `LlmRun.cacheReadInputTokens` is always `NULL`.
- Cost tracking is **indicative only** at Kimi rates ($0.60 / $2.50 per MTOK).

So the doc described an aspirational architecture; the runtime is single-model
Kimi-via-Hypercli. This drift has been live for weeks and was missed by the
last snapshot.

## Decision

**Kimi K2.6 via Hypercli is the canonical LLM provider for all four agents and
for every LLM call in this codebase. The Anthropic SDK is not adopted.**

Concretely:

1. **No `@anthropic-ai/sdk`** is added to `package.json`. The OpenAI SDK
   pointed at Hypercli stays the single LLM client.
2. **All four agents** (`scenario-narrative`, `mining-health`,
   `risk-explanation`, `investor-memo`) run on `kimi-k2.6`. Model pinning is
   centralised in `client.ts`; per-agent model overrides are not added.
3. The `cache_control` shim stays for forward compatibility but is treated as
   **a no-op**. No code path may assume prompt-cache hits. Documentation must
   not claim native caching.
4. Cost tracking persists to `LlmRun` at the **published Kimi rates**.
   Reconciliation against the first Hypercli invoice is a P1 item (see
   `LlmRun` fields `inputTokens`, `outputTokens`, `costUsd`).
5. All four agent **guardrails** (Zod-validated outputs, forbidden-words
   linter, "must cite assumption", PTAI for projections, APY range) are
   provider-agnostic and **unchanged**.
6. The split-model claims (Sonnet/Opus) are **purged from every doc and code
   comment** (this ADR ships that cleanup in the same commit).

## Consequences

### Positive

- **Doc and runtime are now aligned.** No more fiction between
  `CLAUDE.md` / spec / comments and what actually runs.
- **Single model, simpler ops.** No model-routing logic, no per-agent SDK
  choice, no two-vendor billing.
- **Lower running cost.** Kimi pricing is roughly an order of magnitude under
  Anthropic per output token at the headline list rate; budget envelope for
  daily crons (mining-health, risk-daily) and the monthly memo stays small.
- **Forward portability preserved.** All agents go through `client.ts`, so a
  future switch (back to Anthropic, to a multi-vendor fallback, to Vercel AI
  SDK) is one file.

### Negative / risks

- **No native prompt caching.** Methodology / disclaimer blocks (~1.5-2 k
  tokens) are re-sent on every call. Acceptable at current volume; revisit if
  the monthly cost crosses budget.
- **Single-vendor dependency on Hypercli.** If Hypercli is down or rate-limits,
  every agent is down. Mitigations: P1 add a circuit breaker + a structured
  fallback (engine-only output, no narrative) — already partly in place via
  the `graceful degradation` pattern in `scenario-narrative.ts`.
- **Cost figures are indicative.** First Hypercli invoice closes the loop; if
  actual billing deviates >10 % from `LlmRun.costUsd`, update
  `src/lib/agents/cost.ts` constants.
- **Model capability ceiling.** Kimi K2.6 is the only ceiling — if memo quality
  is judged insufficient by LPs, re-open this ADR. The cost of switching is
  bounded (one file, four agents).

## Non-decisions (explicitly out of scope)

- **Vercel AI SDK** is not adopted in this ADR. The OpenAI SDK + raw client
  pattern is enough; revisit if streaming UX becomes a hard requirement (P1).
- **Langfuse / Helicone** observability is **not** decided here. Tracked as a
  separate horizon recommendation (P1).
- **Streaming output** for the Investor Memo (currently synchronous, ~3 min)
  is a UX decision tracked separately. ADR-007 does not block adding streaming
  later — it stays on Kimi via OpenAI SDK streaming.

## Cleanup shipped with this ADR

The following stale "Sonnet 4.6 / Opus 4.7 / Anthropic SDK" references were
purged in the same change-set:

- `CLAUDE.md` (stack section + agents layer + agent-dev sub-agent description)
- `docs/spec/09-agents.mdx` (4 agent headings + stack section)
- `docs/roadmap.json` (2 item labels)
- `docs/roadmap-status-2026-05-26.md` (livré section)
- `docs/user-guide.md`
- `src/lib/inngest/functions/investor-memo-monthly.ts`
- `src/lib/inngest/functions/mining-health-daily.ts`
- `src/lib/inngest/functions/risk-daily.ts`
- `src/lib/inngest/functions/__tests__/mining-health-daily.test.ts`
- `src/app/admin/scenario-lab/actions.ts`
- `src/app/admin/investor-memo/actions.ts`
- `src/app/admin/investor-memo/metadata.ts`
- `src/app/admin/investor-memo/page.tsx`
- `src/components/scenario/output-panel.tsx`
- `src/components/memo/memo-shell.tsx`
- `src/__tests__/integration/scenario-lab.integration.test.ts`
