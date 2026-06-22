# ADR-017 — One chat: single engine + outreach folded into the cockpit chat

**Status**: Accepted
**Date**: 2026-06-22
**Deciders**: Founder (Adrien) + Eng
**Supersedes / extends**: ADR-012 (conversational cockpit chat), ADR-016 (tiered outreach sending)

## Context

The LLM surfaces had fragmented into several parallel chat/engine paths:

- a **dual chat engine** — the app-side tool-capable `runChatAgent` (flag ON) vs the
  legacy `@hearst/cockpit-shell` handler (flag OFF / review mode), which had no tools
  and could not capture token usage (so `LlmRun.costUsd` was NULL on that traffic);
- an **independent outreach chat** (`/api/outreach-chat`) driven by a regex intent
  classifier (`classifyOutreachIntent`, "Palier 0"), with its own in-page copilot panel;
- (still separate, see "Not in this ADR" below) the Product Workspace brief stream and
  the review-document generator.

This meant double maintenance, two compliance chains, an LP-facing surface paying for
GPT-4.1 without tools when the flag was off, and a second place an operator had to go to
run outreach.

## Decision

**Collapse to a single conversational engine and fold outreach into it.**

1. **Single engine.** `runChatAgent` is the only chat engine for all three modes
   (normal/LP, admin, review). The `@hearst/cockpit-shell` handler branch is removed.
   `CHAT_MASTER_AGENT` becomes a **kill-switch** (default ON; `=0` → 503, no fallback).
   Review mode runs through the engine with navigation, product-intent detection and
   product-chart stream events gated off (new `exposeNavigate` option). Token usage +
   cost are now traced on every turn.

2. **Outreach in the chat (admin mode).** Outreach becomes bounded admin tools in the
   same registry + HITL confirmation-token pattern as the governance/review-note drafts:
   - read (no confirmation): `outreach_list_prospects`, `outreach_stats`;
   - write (HITL confirmation, draft-only side effect): `outreach_source_leads`
     (Apollo → scored + tiered prospects, nothing sent), `outreach_draft_email`
     (persists an agent draft, nothing sent), `outreach_trigger_send_run` (drives the
     SAME governed auto-send job as the cron).
   `/api/outreach-chat`, the regex classifier `copilot-intent.ts`, and the in-page
   `OutreachCopilot` panel are retired. The cockpit LLM does intent understanding
   natively (the anticipated "Palier 1", reached by fusion — no extra LLM call).

3. **Send governance unchanged (ADR-016 holds).** `outreach_trigger_send_run` cannot
   exceed the dial: `OUTREACH_AUTONOMY=SUGGEST` → 0 sent; Tier A is never auto-sent;
   warm-up daily cap + suppression re-check apply; every send is forbidden-words
   guarded, carries an unsubscribe link, and is audited.

## Guardrails (invariants preserved + closed gaps)

- The model **never auto-executes a write tool**: write tools are not declared in a way
  that executes — they require a two-step confirmation token (human-in-the-loop).
- Cross-profile isolation holds: outreach tools are admin-mode + admin-profile only
  (a gating test asserts no LP/normal leak).
- Client `system` prompt is still stripped; the output compliance guard
  (`guardChatStream` + forbidden-words + APY-range) wraps every human-facing surface.
- Closed counter-audit gaps: admin-context read-tool results are now linted before
  injection (and the always-on context is restricted to no-parameter snapshot tools);
  outreach scorer `reasons[]` and reply-handler `summary` are forbidden-words linted;
  durable memory is re-linted at injection time.

## Consequences

- One engine, one compliance path, honest cost tracing everywhere; one less endpoint and
  one less classifier to maintain.
- The chat's tool surface is wider (outreach + existing drafts) but every write stays
  HITL — CLAUDE.md non-negotiable #4 is updated to "no autonomously-executed write tools"
  rather than "no write tools".
- `/admin/outreach` keeps ICP/campaign management; the conversational copilot moved to
  the cockpit chat.

## Not in this ADR (deliberately deferred)

The **Product Workspace brief** (live token-by-token streaming in the workspace,
entangled with the chat-nav bridge + Scenario Lab) and the **review-document** generator
are still their own flows. Folding them into the chat without regressing the polished
streaming UX needs a dedicated pass — tracked separately, not bundled here.
