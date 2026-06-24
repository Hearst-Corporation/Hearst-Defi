# Agent File Locks

Multi-agent coordination ledger. Every active agent reserves the files/directories it
edits here BEFORE touching them. No agent may edit files owned by another active agent.

See the worktree/lock protocol in the repo root and CLAUDE.md.

## Sensitive Single-Owner Files

Only one agent at a time:

```
prisma/schema.prisma
package.json
pnpm-lock.yaml
next.config.*
tailwind.config.*
src/app/api/cockpit-chat/route.ts
src/lib/llm/tools/registry.ts
src/lib/canvas/compose.ts
src/lib/canvas/emit.ts
src/app/globals.css
src/app/doc-flow.css
src/app/admin/admin-proof.css
docs/agent-file-locks.md
CLAUDE.md
```

## ACTIVE LOCKS

### agent/console-debug
Owner: Console Debug Owner
Branch: agent/console-debug
Worktree: ../connect-console-debug
Started: 2026-06-25
Status: active

Scope:
- src/app/api/cockpit-chats/[id]/route.ts   (P1 fix: strip canvas-open marker at chat history display)
- src/app/api/cockpit-chats/__tests__/**    (regression test)

Notes:
- Full console/browser/API/server debug pass on bd6ba923 (current origin/main).
- Does NOT touch the sensitive single-owner files (cockpit-chat/route.ts, emit.ts, compose.ts left untouched).
- Prior worktree (branch agent/console-debug @ 5caf922e) was destroyed by a concurrent
  actor mid-pass; main advanced 5caf922e → bd6ba923; reconciled onto new origin/main.

## RELEASED LOCKS

_(none yet)_
