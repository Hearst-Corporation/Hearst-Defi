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

### fix/chat-yield-compliance-scroll
Owner: Master Agent Chat Reliability Bug Owner
Branch: fix/chat-yield-compliance-scroll
Worktree: ../connect-agent-chat-reliability
Started: 2026-06-25
Status: active

Scope:
- src/lib/agents/apy-range.ts
- src/lib/agents/__tests__/apy-single-point-yield.test.ts
- src/lib/agents/__tests__/apy-range.test.ts
- src/lib/llm/__tests__/output-guard.test.ts
- src/app/cockpit.css

Notes:
- BUG 1: output guard false-positives on yield SOURCE breakdowns (mining ~6,2 %,
  USDC base ~4,8 %, réserve ~4,5 %) → "Réponse bloquée" on educational answers.
  Fix = source-attribution exemption in hasSinglePointApy (apy-range.ts). Guard
  NOT disabled; headline single-point + forbidden words still blocked.
- BUG 2: chat history unreachable — `.ct-chat-list { justify-content: flex-end }`
  clips overflow at the top. Fix = margin-top:auto on first child (cockpit.css).
- Does NOT touch sensitive single-owner files (cockpit-chat/route.ts, compose.ts,
  emit.ts, registry.ts, globals.css). cockpit.css is NOT on the sensitive list.

---

## RELEASED LOCKS

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
