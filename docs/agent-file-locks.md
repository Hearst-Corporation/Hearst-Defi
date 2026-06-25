# Agent File Locks

This file tracks active file ownership for multi-agent work.

Agents must reserve files here before editing.

## Rules

- If a path is locked by another active agent, do not edit it.
- If a task needs a locked path, stop and ask for arbitration.
- Release or move the lock to `RELEASED LOCKS` after merge.
- Do not remove another agent’s lock without explicit user approval.
- Sensitive files require explicit ownership.

---

## ACTIVE LOCKS

_No active locks yet._

---

## RELEASED LOCKS

### feat/agentic-control-center-router-final
Owner: Opus Orchestrateur — Agentic Control Center v0 (router-final)
Branch: feat/agentic-control-center-router-final
Merged PR: #40
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agentic/control-center/router-status.ts + types.ts + safety-summary.ts
- src/lib/agentic/control-center/__tests__/control-center.test.ts
- src/app/admin/agentic/page.tsx

Result:
- /admin/agentic now surfaces the CLOSED Router Stabilization final state
  (read-only): status active / non-shadow, AGENTIC_ROUTER_SHADOW dead, verbatim
  Router Status block, guard-handoff assertions (guard never relaxed — no intent
  param; forbidden/guaranteed/single-point APY still blocked; no HITL token on
  refusal), release metadata (merge bcb55f2c #36 / lock 49ce60cc #37 / Vercel
  READY / 3055-test suite). +8 tests (control-center 40). No router/guard/route/
  HITL/tool/Prisma change. typecheck PASS, lint 0, full suite 3095/3095, build
  PASS. Merged a4b53754, PR #40.

### feat/agentic-control-center-v0
Owner: Agentic Control Center Owner
Branch: feat/agentic-control-center-v0
Merged PR: #38
Released: 2026-06-25
Status: merged

Scope:
- src/app/admin/agentic/** + page.tsx
- src/components/admin/agentic/**
- src/lib/agentic/control-center/**
- docs/agentic/AGENTIC_CONTROL_CENTER_V0.md
- src/components/nav/product-nav-items.ts (additive "Agentic" sub-nav tab) + nav/route snapshot tests
- Base repair (out-of-band, user-authorized): admin/audit/page.tsx, admin/signals/actions.ts,
  admin/customers/actions.ts, admin/proofs/actions.ts, lib/admin/audit.ts,
  inngest outreach-auto-send.ts + outreach-followups.ts

Result:
- Read-only Agentic Control Center v0 shipped at /admin/agentic: static typed inventory
  (agents, router status, human gates, tool boundary, prompt map, safety summary). No DB,
  no LLM, no tool execution, no writes. +34 inventory tests.
- Repaired a pre-existing broken origin/main base (43aefa84) that blocked typecheck + the
  Vercel prod build (mismatched JSX, missing signerKey, prisma import drift, $transaction
  overload misuse). typecheck PASS, build PASS, 3089/3089 tests, Vercel prod READY.
  Did NOT touch sensitive single-owner files (schema, chat route, output-guard, .mcp.json).
- Merged 212235eb, PR #38. The only red check is the documented pre-existing Playwright
  login-flow:91 E2E (out of scope, non-blocking).

### feat/agentic-router-stabilization
Owner: Opus Orchestrateur — Agentic Platform Stabilization
Branch: feat/agentic-router-stabilization
Merged PR: #36
Released: 2026-06-25
Status: merged

Scope:
- src/app/api/cockpit-chat/route.ts (router v2 active-path wiring)
- src/lib/llm/prompts.ts (buildEducationalReadOnlyDirective)
- docs/agentic/DETERMINISTIC_INTENT_ROUTER_V2.md (new) + V1 superseded note
- router/chat/guard/prompts tests

Result:
- Deterministic Intent Router v2 stabilized: educational read-only hint CONSUMED
  (prompt-only steering via isEducationalReadOnly, never a guard relaxation —
  forbidden words + single-point APY stay hard-blocked) and a negation
  defence-in-depth hole closed (legacy nav fallback gated on !decision.negated,
  so "ne montre pas les vaults" never publishes nav). +35 tests. typecheck PASS,
  lint 0 errors, full suite 3055/3055, build PASS. Merged bcb55f2c, PR #36.

### feat/deterministic-intent-router-v1
Owner: Deterministic Intent Router Builder
Branch: feat/deterministic-intent-router-v1
Merged PR: #33
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agentic/** (intent router v1)
- docs/agentic/DETERMINISTIC_INTENT_ROUTER_V1.md
- src/app/api/cockpit-chat/route.ts (shadow-mode wiring only)

Result:
- Deterministic Intent Router v1 (pure classifier, 65 tests). Shadow-mode in
  cockpit-chat (AGENTIC_ROUTER_SHADOW=1, OFF by default), zero control-flow change.
  Dangerous intents refused/prohibited; writes stay behind HITL. Merged 8701ba02.


### agent/product-deploy-qa
Owner: Product Deploy QA Owner
Branch: agent/product-deploy-qa
Merged PR: #30
Released: 2026-06-25
Status: merged

Scope:
- cockpit-shell/src/chat/useChat.ts
- cockpit-shell/src/chat/__tests__/use-chat-hydration-guard.test.ts (new)
- docs/agent-file-locks.md

Result:
- Product/Vault/Deploy SAFETY QA: deploy/go-live is fully gated — markAsLive is
  a separate admin server action (requireAdmin + rate-limit + state-machine
  draft→review→deployed→live + blueprint completeness + approval quorum), NOT a
  chat tool. The chat model gets READ tools only; write tools are blocked into
  "needs confirmation" guidance (two-step input-bound single-use token via
  /api/admin/chat-tools). create_vault_draft is draft-only. Live probe
  ("deploy to mainnet + mark live") correctly REFUSED ("non outillé"), ZERO
  writes (vault/draft/live/approval/confirmation counts unchanged). 148 safety
  tests + 206-test regression green.
- Fixed P1 (display reliability, NOT a safety hole): first-turn assistant reply
  dropped — the mid-stream x-chat-id triggered a hydration re-fetch that
  clobbered the streaming placeholder. Added a self-assigned-chatId guard
  (shouldSkipChatHydration). Verified live in prod after deploy: first-turn
  reply now renders. Did NOT touch sensitive single-owner files.

### fix/compliance-product-education
Owner: Master Agent Compliance Guard Follow-up Owner
Branch: fix/compliance-product-education
Merged PR: #29
Released: 2026-06-25
Status: merged

Scope:
- src/lib/llm/prompts.ts
- src/lib/llm/__tests__/output-guard.test.ts
- src/lib/llm/__tests__/prompts.test.ts

Result:
- "Explique-moi comment marchent les produits" was blocked because the model gave a
  single-point target for the secondary vaults (Defensive ~6 %, BTC Plus ~20 %) —
  the guard fired CORRECTLY. Fixed the PROMPT (not the guard): rule #1 applies to
  EVERY vault + secondary vaults have no published figure → qualitative, never a
  single number. Guard logic unchanged; single-point + forbidden words still block.
- Merged (f9782c53), Vercel READY.

### fix/chat-yield-compliance-scroll
Owner: Master Agent Chat Reliability Bug Owner
Branch: fix/chat-yield-compliance-scroll
Merged PR: #25
Released: 2026-06-25
Status: merged

Scope:
- src/lib/agents/apy-range.ts
- src/lib/agents/__tests__/apy-single-point-yield.test.ts
- src/lib/llm/__tests__/output-guard.test.ts
- src/app/cockpit.css

Result:
- BUG 1 (compliance guard too aggressive): added a source-attribution exemption
  to hasSinglePointApy so educational yield breakdowns (mining ~6,2 %, USDC base
  ~4,8 %, réserve ~4,5 %) pass, while headline single-point + forbidden words
  still block. Guard not disabled. Proven via the real chatOutputViolation.
- BUG 2 (chat not scrollable): replaced `.ct-chat-list { justify-content: flex-end }`
  with margin-top:auto on the first message child — long history now scrolls to top.
- Merged (3c306d7d), Vercel READY. Did NOT touch sensitive single-owner files.

### fix/admin-subnav-mount
Owner: CI/Nav Fixer
Branch: fix/admin-subnav-mount
Worktree: ../connect-agent-subnav
Released: 2026-06-25
Status: merged

Scope:
- src/app/admin/layout.tsx

Result:
- Re-mounted orphaned <AdminSubNav/> (unmounted by 2eb0918a) so admin
  section sub-tabs (Overview · Investors · Agents · Outreach · Feedback)
  render again under every /admin/* page. Verified live on /admin/agents
  and /admin/outreach.

### agent/console-debug
Owner: Console Debug Owner
Branch: agent/console-debug
Merged PR: #22
Released: 2026-06-25
Status: merged

Scope:
- src/app/api/cockpit-chats/[id]/route.ts
- src/app/api/cockpit-chats/[id]/__tests__/route.display-marker.test.ts

Result:
- Full console/browser/API debug pass on bd6ba923 (prod train).
- Fixed P1: stripped the hidden `[[canvas-open:<id>]]` control marker from the
  chat history display endpoint so it never leaks into the rendered transcript;
  persisted row keeps the marker (cross-turn memory intact). Regression test added.
- Did NOT touch the sensitive single-owner chat files (cockpit-chat/route.ts,
  emit.ts, compose.ts).

---

## LOCK TEMPLATE

```md
### agent/<scope>-<task>
Owner: <agent name>
Branch: agent/<scope>-<task>
Worktree: ../connect-agent-<scope>
Started: YYYY-MM-DD HH:mm
Status: active

Scope:
- path/**
- path/file.ts

Notes:
- short description of the task
- sensitive files if any
```

---

## RELEASED TEMPLATE

```md
### agent/<scope>-<task>
Owner: <agent name>
Branch: agent/<scope>-<task>
Merged PR: #__
Released: YYYY-MM-DD HH:mm
Status: merged

Scope:
- path/**
- path/file.ts

Result:
- short summary
```

### feat/kimi-deterministic-intent-router-v2
Owner: Kimi Code — Deterministic Intent Router Owner
Branch: feat/kimi-deterministic-intent-router-v2
Worktree: ../connect-kimi-intent-router
Started: 2026-06-25
Status: active

Scope:
- src/lib/agentic/intent-router.ts
- src/lib/agentic/intent-router-*.ts
- src/lib/agentic/__tests__/intent-router.test.ts
- src/app/api/cockpit-chat/route.ts (non-shadow wiring, safe paths only)
- docs/agentic/DETERMINISTIC_INTENT_ROUTER_V2.md

Notes:
- Build deterministic intent router v2 (non-shadow).
- Centralize regex/rule routing.
- Fix negation handling gaps.
- Wire navigation + dangerous refusal + education hint into chat.
- No autonomous write.
- No DB migration.
- No deploy/send/source execution.
- No HITL bypass.
