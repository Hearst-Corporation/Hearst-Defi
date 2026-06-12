# ADR-012 — Conversational cockpit chat: admin review-mode + LP Master Agent (read-only)

**Status**: Accepted
**Date**: 2026-06-12
**Deciders**: Founder (Adrien) + Eng
**Relates to**: ADR-011 (single LLM provider — OpenAI GPT-4.1), CLAUDE.md non-negotiable #4

## Context

The original product non-negotiable was blunt: **"No AI chat. Agents produce
structured JSON outputs only"** (CLAUDE.md #4, `docs/spec/09-agents.mdx`). It
forbade an "Ask the AI" widget because a free-form conversational surface is the
easiest place to leak a non-compliant claim (a single-point APY, a "guaranteed
yield"), to disclose internals, or to take an action a human should own.

Since then two conversational surfaces were actually built and shipped, both on
the single provider from ADR-011 (GPT-4.1):

1. **Admin review-mode facilitator** — an internal, admin-gated chat
   (`@hearst/review-mode`) that drives the product-review flow and emits review
   documents (MD + JSON). Selected per session by an `AdminChatMode` row
   (`chatMode = "review"`). It never faces an LP.
2. **LP-facing "Master Agent"** — a normal-mode conversational assistant that
   answers product questions in French and can **guide** the investor to the
   right page. It runs through an app-owned, tool-capable streaming engine
   (`runChatAgent`) so it can expose a single `navigate` tool that the shared
   `@hearst/cockpit-shell` handler cannot.

Both already had the guardrail machinery in place: a **server-built system
prompt** the client cannot override, an **output-side compliance guard** on the
stream, a **role-aware register**, and — for the Master Agent — a **closed
navigation whitelist** with no write/financial/admin capability. The spec and
CLAUDE.md, however, still said "❌ Chat", which now MISLEADS: the code and the
named source-of-truth diverge. This ADR records the decision and the precise
scope so the chat is legitimate, bounded, and auditable rather than an
undocumented drift.

## Decision

**Hearst ships a conversational cockpit chat as a SCOPED, read-only exception to
the "No AI chat" non-negotiable.** The exception is narrow and explicit:

1. **Two surfaces, both read-only.**
   - **Admin review-mode** — admin-gated facilitator (`@hearst/cockpit-shell`
     handler, **no tools**), produces review documents. Not exposed to LPs.
   - **LP Master Agent** — normal-mode chat, **flag-gated behind
     `CHAT_MASTER_AGENT`** (server-only env, OFF by default;
     `src/lib/feature-flags.ts`). When OFF, the chat falls through to the
     cockpit-shell handler with no tools. When ON, it routes through
     `runChatAgent` (`src/lib/llm/chat-agent.ts`).

2. **The ONLY tool is `navigate`** (`src/lib/llm/navigate-tool.ts`): a
   client-side, **read-only** route change. The model never emits a free-form
   URL — it picks a `key` from a **closed enum** (`NAV_DESTINATIONS`:
   `portfolio`, `vaults`, `proof-center`, `profile`), which the server maps to a
   real LP route. Detail pages with a dynamic `[id]` and all admin/debug routes
   are excluded. **There is NO write, financial, deposit/withdraw, rebalancing,
   custody, or admin tool — and none may be added without a new ADR.**

3. **Human-in-the-loop is preserved (#4 holds).** The chat explains and
   navigates; it never executes a financial or rebalancing action. Rebalancing
   stays agent-proposes / human-decides. In-progress flows (deposit, onboarding,
   TOTP challenge) are protected: `isProtectedRoute` degrades auto-navigation to
   a non-intrusive suggestion so the chat never yanks a user out of a form.

### Guardrails (all server-side, none client-overridable)

- **Server-built system prompt** (`COCKPIT_DEFAULT_SYSTEM_PROMPT` + role
  directive, `src/lib/llm/prompts.ts`). The inbound Zod body schema in
  `src/app/api/cockpit-chat/route.ts` **strips any client `system` field**, so a
  tampered request cannot replace or weaken the curated prompt. The model
  allowlist is `[OPENAI_MODEL]`; an unknown requested model falls back to the
  default.
- **Output-side compliance guard** (`guardChatStream` / `chatOutputViolation`,
  `src/lib/llm/output-guard.ts`). It wraps the streamed answer and enforces the
  **same** forbidden-words rule (`containsForbiddenChat`, FR ∪ EN,
  negation-aware — the canonical list in `src/lib/agents/forbidden-words.ts`)
  **plus** the **APY-always-a-range** rule (#1). A look-back buffer holds the
  tail un-emitted so an offending span is caught **before** it streams; on a
  violation the stream emits the `content_blocked` sentinel and stops. The
  Master Agent **navigates only on a compliant answer** — a blocked answer
  produces no navigation and is never persisted.
- **Role-aware register** (`buildRoleDirective`). Default is the strict, safe LP
  case: vouvoiement, institutional register, **zero internal disclosure**
  (no architecture, env vars, DB schemas, file paths, or other agents' prompts),
  no personalised investment advice. Admins get a looser internal register but
  the secret/internal redaction still applies.
- **Same provider, same compliance posture as the agents** (ADR-011): one model
  (GPT-4.1), one forbidden-vocabulary engine, one APY-range rule — no divergent
  re-implementation.

### Status of non-negotiable #4

CLAUDE.md #4 ("No AI chat") is **amended, not deleted**: the structured agents
still return STRICT JSON only and never converse. The exception is limited to
the two read-only conversational surfaces above, with the guardrails listed.
The orchestrator updates CLAUDE.md #4 to reference this ADR.

## Consequences

### Positive
- The named source-of-truth (`docs/spec/09-agents.mdx`) now matches the shipped
  code: the chat is documented, bounded, and auditable instead of an
  undocumented drift contradicting #4.
- LP UX gains a guided, read-only assistant without any new attack surface for
  financial/admin actions — the capability ceiling is "change the page".
- Compliance is enforced on the chat output with the **same** machinery as the
  agents, so an investor can never be streamed a forbidden claim or a
  single-point APY.

### Negative / risks
- **A conversational surface is intrinsically higher-risk** than JSON-only
  agents (prompt-injection, jailbreak attempts). Mitigated by the server-built
  prompt (client `system` stripped), the output-side guard, and the closed
  navigation whitelist — but this remains the surface to watch in review.
- **The LP Master Agent is gated OFF by default** (`CHAT_MASTER_AGENT`); turning
  it on in production is a deliberate, reviewed step, not a silent default.
- **Whitelist creep is the failure mode.** Adding any non-navigation tool, or a
  dynamic/admin route to `NAV_DESTINATIONS`, breaks the read-only invariant and
  requires a new ADR.

## Non-decisions (out of scope)
- **No write / transactional tool** on the chat — explicitly rejected here; a
  future deposit-assist or action tool needs its own ADR and a human-in-the-loop
  confirmation design.
- **No change to the four structured agents** — their JSON-only contract,
  schemas, and validators are untouched (see `docs/spec/09-agents.mdx`).
- **No fork of `@hearst/cockpit-shell`** — the tool-capable path is an app-owned
  engine (`runChatAgent`); review mode keeps using the shared handler.

## References
- Flag: `CHAT_MASTER_AGENT` (`src/lib/feature-flags.ts`).
- Engine: `src/lib/llm/chat-agent.ts`, `src/lib/llm/navigate-tool.ts`,
  `src/lib/llm/nav-channel.ts`.
- Guard: `src/lib/llm/output-guard.ts`, `src/lib/agents/forbidden-words.ts`.
- Route + prompt: `src/app/api/cockpit-chat/route.ts`, `src/lib/llm/prompts.ts`.
- Commits (Master Agent 2.5a–2.5d + hardening): `5c8e59f`, `8cdfba1`, `b6826de`,
  `5e868d1`, `0c9badf`, `60fdc0e`, `9a7b741`, `516ba7e`.
