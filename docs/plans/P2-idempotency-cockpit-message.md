# P2 — Idempotency on `CockpitMessage` (plan, not yet implemented)

**Status:** deferred — needs a client change + a DB migration. Surfaced by the
LLM-agent contre-audit (P2-001).

## Problem

`runMasterAgentTurn` persists the user message with a server-generated random id
(`crypto.randomUUID()`), and `CockpitMessage` has no uniqueness on the message
identity (`prisma/schema.prisma` → `model CockpitMessage`). A retried
`POST /api/cockpit-chat` (flaky network, client retry) therefore inserts the
same user turn twice — a duplicate history row. Low impact (cosmetic history
duplication, not financial), but real.

The codebase already applies idempotency unique-constraints where it matters
(`@@unique([period, signerWallet])`, Persona `inquiryId`, DocuSign `envelopeId`)
— this is the one chat-side gap.

## Why it is NOT fixed in this pass

A `@@unique` only dedupes if the dedup key is **stable across retries**. The
current id is generated server-side per request, so it differs on every retry —
a unique constraint on it would dedupe nothing. Real idempotency requires the
**client to send a stable `clientMessageId`** with each send and reuse it on
retry. The client is the vendored `@hearst/cockpit-shell` `useChat` hook, which
this workstream must not modify (no tarball/package changes). Hence: plan only.

## Recommended implementation (separate pass, when the package can change)

1. **Client** (`@hearst/cockpit-shell` `useChat`): generate one `clientMessageId`
   (UUID) per user send, attach it to the POST body, and reuse the same id when
   retrying that send. (Package change — coordinate with the shell owner.)
2. **Schema** (`CockpitMessage`): add `clientMessageId String?` and
   `@@unique([chatId, clientMessageId])` (nullable so legacy/no-id rows are
   unaffected — SQLite/Postgres both treat NULLs as distinct, so only real
   client ids collide). Migration: additive column + partial unique index.
3. **Route** (`cockpit-chat/route.ts` `saveMessage`): when a `clientMessageId`
   is present, persist via `upsert` (or `create` + catch `P2002`) keyed on
   `(chatId, clientMessageId)` so a retried identical turn is a no-op.
4. **Tests:** two POSTs with the same `clientMessageId` → exactly one
   `CockpitMessage` row.

## Interim mitigation (no package/DB change, optional)

A best-effort server guard: before inserting the user message, skip if an
identical `(chatId, role:"user", content)` row exists within the last few
seconds. Cheap but heuristic — it can drop a *legitimate* immediate repeat of
the same text, so it is **not** recommended over the stable-id approach above.

## Do not

- Add a `@@unique` on the current server-generated random id (no-op).
- Modify the `@hearst/cockpit-shell` package as part of an unrelated pass.
