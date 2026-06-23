# ADR-018 — Agentic platform migration: homegrown agents out, Swarms/Crew in

**Status**: Accepted
**Date**: 2026-06-24
**Deciders**: Founder (Adrien) + Eng
**Supersedes / extends**: extends ADR-011 (OpenAI GPT-4.1 provider), ADR-012 (conversational cockpit chat), ADR-016 (tiered outreach sending), ADR-017 (unified chat). Does NOT supersede the engine-purity / no-autonomous-write non-negotiables — it hardens them.

## Context

The homegrown agent layer became the de-facto brain of the platform and proved
**fragile and hard to wire** for anything genuinely multi-step. In parallel, the
LLM surfaces fragmented into overlapping efforts:

- navigation used to be **LLM-driven** (a model `navigate` tool + a `gpt-4.1-nano`
  product-intent classifier);
- two parallel branches independently retired that LLM path — the navigation lot
  on `feat/agent-canvas-workspace` (commits `0e36d912`, `9a3cd742`, `0077f3e9`)
  and `feat/product-workspace-foldin` ("fold product-workspace intent into the
  single engine, retire the nano classifier"). They touch the **same files**
  (`cockpit-chat/route.ts`, `classify-product-intent.ts`) — duplicate/conflicting
  work with **no single source of truth**;
- a MySwarms `crewai-engine` (external CrewAI orchestration) exists and is used by
  other Hearst entities; an in-repo client scaffold lives at `src/lib/swarms/*`
  (flag `SWARMS_ENGINE`, default OFF, **no runtime callers** — preparatory only).

We need a stable target so these fragments reconcile instead of diverging.

## Decision

**Homegrown agents stop being the orchestration brain. Complex multi-step work
moves to Swarms/Crew. The deterministic core stays in-repo and is the source of
truth. The chat is a light interface. Navigation is deterministic. Sensitive
actions are human-gated.**

Six layers:

1. **Interface — light chat.** Converse, clarify, summarize, confirm, display a
   report, call an authorized action via the deterministic router, launch a Crew
   with a validated payload. It is **not** the operational brain and never
   orchestrates a critical multi-step action itself. Models: GPT-4.1 (reasoning),
   `gpt-4.1-nano` for cheap classification only — **never for navigation**.
2. **Router — deterministic, NO-LLM.** Command map · regex intent table ·
   permissions · action registry · closed route whitelist · safe fallback · tests.
   The only thing that opens a route or launches an action/Crew. (Phase 1 — see
   spec `10-navigation-router`, **shipped**.)
3. **Swarms/Crew — MySwarms `crewai-engine`.** The hard workflows: reporting,
   adverse review, scenario/product analysis, vault readiness, deployment
   **preparation**, governance **preparation**, ops incident review, investor
   pipeline. Crews read the core through **read-only adapters** and emit
   **structured drafts**; never a direct write, never a signature, never a key.
4. **Deterministic core — preserved in-repo (source of truth).** Engine (pure,
   non-negotiable #6), Prisma/loaders, server actions, adapters (chain/Safe/email/
   CRM), validators (forbidden-words / APY-range / PTAI / assumptions / provenance),
   deterministic jobs (Inngest), registry/provenance.
5. **Human gate — approval/signature/publish/send.** sha256-bound two-step
   confirmation token (in-repo), Safe multisig, publish/send gates. Nothing
   custody-/financial-/communication-sensitive crosses without a human + audit.
6. **Observability — Langfuse / LlmRun / AdminToolRun / audit trail.** Every Crew
   run, draft, gate and send is traced.

**Red line (blockchain / Safe), non-negotiable:**
> **Swarms prepare, simulate, verify, draft and monitor. Humans sign and authorize.**
Crews may read chain state, simulate, compare ABI/address/chainId, draft Safe
payloads, produce checklists and post-execution reports — but **never hold a key,
sign a transaction, or move funds**. On-chain execution stays human-gated and
gated on the Spearbit audit (ADR-006).

**Canonical de-LLM navigation.** Navigation is regex/command-map/closed-whitelist,
**no `navigate` tool exposed to the model, no LLM classifier for routing, no LLM
fallback**. Unknown command → no navigation (safe fallback). This is the **single
source of truth** to which the two parallel de-LLM trains (the nav lot and
`feat/product-workspace-foldin`) MUST reconcile — one approach, not two.

**Reporting is central, and gated.** No human-facing agent/crew output ships
without passing **Adverse Review** (compliance gate reusing the in-repo
validators). See spec `11-agentic-reporting`.

**Compliance preservation.** A Crew output that replaces an in-repo structured
agent must be re-validated through the **same Zod schema + validator stack**
(`assertNoForbiddenWords` / `assertApyAlwaysRange` / `assertCitesAssumption` +
`PtaiSchema`) — not a flat-string guard. Provenance must be carried structurally,
never fabricated; no model name / token / prompt / fake confidence in traces.

**Model policy for crews.** Target is GPT-4.1 on the engine. **Precondition (not
in this ADR):** the engine currently force-routes every agent to Kimi
(`dynamic_crew._resolve_llm` + architect defaults); reconfiguring it to OpenAI is
a prerequisite before any crew claims a GPT-4.1 badge. Until then crews are
design-only.

## Consequences

- The four in-repo batch agents (Scenario Narrative, Mining Health, Risk
  Explanation, Investor Memo) and the cockpit chat **stay in-repo** — they are
  single-shot and must NOT migrate; the chat is the interactive surface.
- MySwarms takes the genuinely multi-agent operational workloads. Homegrown agent
  decommission is **phased**, not a big-bang.
- `src/lib/swarms/*` stays flag-gated OFF with no runtime callers until the engine
  reconfig + per-crew specs land.
- The two parallel de-LLM trains reconcile to one router (this ADR + spec 10).

## Alternatives considered

- **Keep agents in-repo, wire harder.** Rejected: fragility + double maintenance.
- **Move everything (incl. chat + single-shot agents) to MySwarms.** Rejected:
  the chat needs streaming (the engine is kickoff→poll, 360–900s); single-shot
  agents gain nothing from CrewAI and would regress on latency/model.
- **LLM-assisted "smart" navigation.** Rejected: latency, non-determinism,
  prompt-injection surface — code holds control-flow, the LLM generates language.

## Out of scope (separate decisions / trains)

Engine Kimi→GPT-4.1 reconfig; actual crew wiring + Inngest kickoffs; DB migrations;
blockchain/Safe changes; the homegrown-agent removal pass.
