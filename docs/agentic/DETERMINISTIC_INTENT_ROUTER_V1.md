# Deterministic Intent Router v1

> **Superseded by v2 (active).** The router is now wired NON-SHADOW in the
> cockpit-chat route — see [`DETERMINISTIC_INTENT_ROUTER_V2.md`](./DETERMINISTIC_INTENT_ROUTER_V2.md)
> for the live active paths (nav fast-path, dangerous refusal, educational
> prompt steering, negation-gated legacy fallback). This v1 doc is kept for the
> classifier/pipeline reference; the "Next step" below has been delivered in v2.

The first real brick of the agentic core: **a rule/regex classifier that decides
what a user message wants BEFORE the LLM**, so simple, critical, and repeatable
intents are handled deterministically instead of by a model.

It is a **pure function** (`src/lib/agentic/intent-router.ts`) — no I/O, no DB, no
LLM call, no side effects. It only produces a typed `AgenticIntentDecision`; the
chat layer decides what to do with it. **It never executes anything.**

```ts
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";

const decision = classifyAgenticIntent("explique comment fonctionne le yield", {
  navProfile: "lp",
  isAdmin: false,
});
// → { kind: "yield_explanation", actionPolicy: "allow_readonly", requiresLLM: true, … }
```

## Why it exists

- The Master Agent did too much: even "go to vaults" or "ne va pas dans vaults"
  went through model-shaped paths.
- Compliance false-positives (yield/products) and dangerous asks (deploy/send)
  need **deterministic, testable** handling, not a probabilistic one.
- It is the seam the future layers plug into: **Chat / Router / Canvas / Tool
  Boundary / Human Gate / Crews.** This is the Router.

## Pipeline

```
raw message
  → normalize (intent-router-normalize.ts)   lowercase, accent-strip, apostrophes→space
  → negation  (intent-router-negation.ts)     FR∪EN negation tokens
  → rules     (intent-router-rules.ts)        priority-ordered tiers
  → decision  (intent-router.ts)              typed AgenticIntentDecision
```

### Normalization

NFD decomposition + combining-mark strip (`é→e`), FR/EN apostrophes → space
(`n'ouvre` → `n ouvre`, `explique-moi` → `explique moi`), lowercase, non-alnum →
single space, trim. The original text is kept too (the legacy nav resolver matches
the raw message).

### Negation

Token-exact FR∪EN negation set: `ne n pas jamais sans aucun aucune ni / not no
never without dont don`. Any negation token present ⇒ the router will **never emit
a positive navigation/action**. A negated positive intent becomes `cancellation`
(or `unknown` for a negated education question). This closes
`ne va pas dans vaults`, `don't open outreach`, `ne déploie pas ce vault`.

## Priority (first match wins)

| # | Tier | Example | Result |
|---|------|---------|--------|
| 0 | empty | `""` | `unknown` / needs_clarification |
| 1 | standalone cancellation | `annule`, `non`, `stop` | `cancellation` |
| 2 | standalone confirmation | `oui`, `go`, `vas y` | `confirmation` (requiresExistingPendingAction) |
| 3 | **DANGEROUS** | `déploie`, `mets en ligne`, `signe la transaction`, `execute governance`, `migrate database`, `change formula` | `deploy_request` → `refuse_autonomous`, **prohibited**, critical |
| 4 | send / source | `envoie aux prospects`, `source des prospects` | `send_request` / `source_request` → `requires_human_gate`, **prohibited** |
| 5 | outreach setup / draft | `lance une campagne outreach`, `crée un draft de campagne … cold` | `outreach_setup` (canvas) / `outreach_draft` (draft-only HITL) |
| 6 | vault readiness / product draft | `vérifie si ce vault est prêt` / `crée un draft de vault` | `vault_readiness` (read-only) / `product_draft` (canvas, HITL) |
| 7 | reporting | `génère un brief` | `reporting_request` (read-only) |
| 8 | navigation | `go to vaults`, `va dans le portefeuille` | `navigation` → `allow_navigation` + routeKey |
| 9 | education | `explique comment fonctionne le yield`, `explique les produits` | `*_explanation` → `allow_readonly` |
| 10 | unknown | anything else | `unknown` → LLM |

The **DANGEROUS tier is first among content rules on purpose**: a critical intent
is caught and refused even if it also contains a nav/education word.

## Categories → action policy

| kind | actionPolicy | requiresHumanGate | prohibitedAutonomousAction |
|------|--------------|-------------------|----------------------------|
| navigation | allow_navigation | no | no |
| education / yield_explanation / product_explanation / risk_explanation | allow_readonly | no | no |
| reporting_request | allow_readonly | no | no |
| vault_readiness | allow_readonly | no | no |
| outreach_setup | allow_canvas | no | no |
| outreach_draft / product_draft | allow_draft_only / allow_canvas | **yes** | no |
| send_request / source_request | requires_human_gate | **yes** | **yes** |
| deploy_request (deploy/go-live/sign/governance/migrate/change-core) | refuse_autonomous | yes | **yes** |
| confirmation | requires_human_gate | yes (requiresExistingPendingAction) | no |
| cancellation | needs_clarification | no | no |
| unknown | needs_clarification | no | no |

**Invariant (tested):** a decision with `prohibitedAutonomousAction: true` never
has an `allow_*` policy and never carries a `routeKey`.

## Navigation route keys

The router **reuses the existing deterministic resolver**
(`resolveNavFallbackDestinationKey` in `src/lib/llm/nav-fallback-intent.ts`) so
route keys never drift. A small router-owned augmentation covers phrasings the
legacy resolver misses (`va dans X`, bare `dashboard`, `reports`).

## Integration (this lot)

Wired in **shadow mode only** in `src/app/api/cockpit-chat/route.ts`, behind
`AGENTIC_ROUTER_SHADOW=1` (OFF by default): the route computes the decision and
logs it (including whether it agrees with the existing nav shortcut) **without any
control-flow change**. This validates the router against live traffic before it
drives anything. The chat behavior is byte-for-byte unchanged with the flag off.

## How to add a rule

1. Add a regex `IntentRule` (or augmentation pattern) to `intent-router-rules.ts`,
   in the correct tier. The `re` runs on the **normalized** input.
2. Pick the right `actionPolicy` / risk / flags from the table above. If it can
   trigger a write/deploy/send, it MUST be gated/prohibited — never `allow_*`.
3. Add positive **and** negated test cases to
   `src/lib/agentic/__tests__/intent-router.test.ts`.
4. Keep the priority order honest — dangerous before nav before education.

## Non-goals (v1)

- **Not** a replacement for the Master Agent — only a pre-LLM classifier.
- **No** DB migration, **no** Prisma schema change.
- **No** autonomous write; every write stays behind the existing HITL gate.
- **No** deploy / send / source / mark-live execution — those are refused.
- **No** LLM router for critical actions — criticals are deterministic only.
- **Not** a full cockpit-chat rewrite — shadow integration only in v1.

## Next step

Promote nav + dangerous-refusal out of shadow mode (drive the fast-path from the
router's `navigation` / `deploy_request` decisions), then feed the
`allow_readonly` educational decisions to the compliance layer as a
"read-only educational intent" hint so the guard never false-blocks a compliant
educational answer.
