# Deterministic Intent Router v2 — active state

v2 promotes the router from **shadow** (v1, see
[`DETERMINISTIC_INTENT_ROUTER_V1.md`](./DETERMINISTIC_INTENT_ROUTER_V1.md)) to
**active, non-shadow control** in the cockpit-chat route. The classifier is still
a **pure function** (`src/lib/agentic/intent-router.ts`, no I/O, no DB, no LLM); it
only produces a typed `AgenticIntentDecision`. What changed is that the route now
*acts* on that decision — navigation, dangerous refusal, and an educational
read-only prompt hint — instead of only logging it.

> Source of truth for behaviour: `src/app/api/cockpit-chat/route.ts` (the wiring),
> `src/lib/agentic/*` (the classifier), `src/lib/llm/output-guard.ts` +
> `src/lib/agents/apy-range.ts` + `src/lib/agents/forbidden-words.ts` (the guard).

## Active paths (in order, all BEFORE the LLM)

The route classifies the message once (`classifyAgenticIntent`) and then resolves,
in this order:

1. **Navigation fast-path** — when the router returns `kind === "navigation"` with
   `confidence ≥ 0.7` and a whitelisted `routeKey`, the route publishes nav and
   returns immediately (no LLM, no tool). Negation can never reach here (a negated
   nav is flipped to `cancellation` inside the router).
2. **Dangerous refusal** — when `actionPolicy === "refuse_autonomous"` **or**
   `prohibitedAutonomousAction === true` (deploy / go-live / sign / governance /
   migrate / change-core / send / source), the route returns a fixed refusal
   ack. **No LLM, no tool, no write, no HITL token minted, no nav publish.**
3. **Educational read-only steering** — when `isEducationalReadOnly(decision)` is
   true (kinds `product_explanation` / `yield_explanation` / `risk_explanation` /
   `education`, plus read-only `reporting_request` / `vault_readiness`), the route
   appends `buildEducationalReadOnlyDirective(kind)` to the **system prompt**
   before calling the LLM. See "Educational hint" below.
4. **Legacy nav fallback** — the existing regex resolver
   (`resolveNavFallbackDestinationKey`) remains the safety net when the router
   does not drive a high-confidence nav. **Gated on `!decision.negated`** so a
   negated nav-verb message ("ne montre pas les vaults", "n'ouvre pas le
   portefeuille") — which the legacy regex still resolves because it ignores
   negation — never publishes nav. The router is the source of truth for negation.

Unknown / off-script messages fall through to the LLM (`runChatAgent`) as before.

## Educational hint — consumed (prompt), NOT a guard relaxation

`isEducationalReadOnly(decision)` is the lever. When true, the route appends a
short directive (`buildEducationalReadOnlyDirective`) to `messages[0]` (the system
prompt). The directive steers the model toward the compliant educational register:
factual / qualitative, **APY always a range**, honest per-source breakdowns are
legitimate, **forbidden words and personalized advice stay forbidden**.

**Why prompt, not guard.** The output-side compliance guard (`chatOutputViolation`
→ forbidden words + single-point APY) is the last line of defence on the streamed
answer. It is **text-only and has no intent parameter** — by design it *cannot* be
relaxed per-intent. The educational hint only ever makes the answer **more**
compliant. A model slip during an "educational" turn is still blocked by the guard.
This mirrors the guard's existing `hasSourceAttribution` exemption (a per-source
"mining ~6,2 %" breakdown is not the headline APY) without weakening anything.

- `educationalReadOnly === true` covers all 4 educational kinds (the earlier
  `_educationalHint = (kind === "education")` placeholder missed yield/product/risk).
- The directive is skipped in **review** mode (its facilitator prompt is
  self-contained) and clamped to `MAX_ENRICHED_SYSTEM_LEN`.

## Dangerous intents — behaviour

`deploy / go-live / sign-tx / execute-governance / migrate / change-formula /
change-model / send / source` are classified with `prohibitedAutonomousAction` (or
`requires_human_gate` for send/source) and **refused before the LLM**. A **negated**
dangerous intent ("ne déploie pas") becomes a `cancellation` — still never a
positive action, the router never emits an `allow_*` policy for a dangerous rule.
No financial / custodial / on-chain action is reachable from the chat (ADR-012 /
ADR-017). Writes that ARE allowed (draft-only) stay behind the two-step HITL token
flow, untouched by this lot.

## Legacy fallback — intact

The legacy regex nav resolver and the deterministic outreach/product-workspace/
canvas short-circuits are unchanged except for the negation gate on (4). If the
router throws or is unavailable, the route degrades to the legacy nav path (the
`try/catch` around `classifyAgenticIntent` sets `agenticDecision = undefined`).

## Non-goals (this lot)

- **No** Crew Runtime, **no** CrewAI / LangChain / external agent framework.
- **No** tool-registry split, chat-engine / context-composer extraction.
- **No** Prisma schema change, **no** DB migration.
- **No** markAsLive / vault workflow / outreach runtime / product-draft activation.
- **No** guard relaxation — the educational hint is prompt-only.

## QA (the five canonical phrases)

| Input | Expected |
| --- | --- |
| `va dans les vaults` | nav fast-path → vaults (no LLM) |
| `ne va pas dans vaults` | cancellation → no nav, falls to LLM |
| `déploie ce produit` | refusal before LLM → no tool/write/nav |
| `explique-moi comment marchent les produits` | educational steering → compliant answer, not blocked |
| `explique comment fonctionne le yield` | educational steering → compliant answer (PASS) |

Plus the negation defence-in-depth phrases the legacy regex used to leak:
`ne montre pas les vaults`, `n'ouvre pas le portefeuille` → no nav publish.

## Tests

- `src/lib/agentic/__tests__/intent-router.test.ts` — classifier, incl. negated
  nav-verb never navigates.
- `src/app/api/cockpit-chat/__tests__/route.router-stabilization.test.ts` —
  route-level: negation guard, educational directive in system prompt, dangerous
  refusal (no LLM / no nav).
- `src/lib/llm/__tests__/prompts.test.ts` — `buildEducationalReadOnlyDirective`
  (reinforces, never exempts).
- `src/lib/llm/__tests__/output-guard.test.ts` — guard uniform regardless of
  educational context (no intent parameter; forbidden / single-point still blocked).
