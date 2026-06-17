# COMMON_TASKS — copy-paste recipes for recurring work

Always also load `docs/DO_NOT_TOUCH.md` (forbidden zones) + `docs/VALIDATION_MATRIX.md`
(what to run per change). Each recipe = entry file(s) → shape → validation → the one STOP.
DS + UI dominate the churn; recipes 1–2 and 8–9 are the hot path.

## 1. Add an admin page
- **Entry**: `src/app/admin/<route>/page.tsx` (+ `actions.ts` for mutations).
- **Shape**: Server Component, `export const dynamic = "force-dynamic"`, `await requireAdmin()`
  first, render `<AdminPageHeader>` (`src/components/admin/admin-page-header.tsx`). Data via
  `src/lib/data/*` (server-only), no client fetch.
- **Register**: add the route to its section's `tabs` in `src/components/nav/product-nav-items.ts`.
- **Validate**: `pnpm typecheck` + `pnpm lint`. **STOP**: no business logic in the page — call data/engine modules.

## 2. Add a product / proof-center section
- **Entry**: `src/app/(product)/proof-center/page.tsx` (or `portfolio`/`vaults`), child in `src/components/proof-center/*`.
- **Shape**: Server Component; honour `previewZeros` (see `docs/DESIGN_SYSTEM.md` §9). No position → full cockpit + `PreviewModeChip`.
- **STOP**: never paint a fake `Live`/`Verified` badge at zero — use the preview chip. Provenance badge stays real.
- **Validate**: `pnpm typecheck` + visual.

## 3. Add an admin mutation (canonical shape)
- **Entry**: `src/app/admin/<r>/actions.ts` or `src/lib/<domain>/actions.ts` (`"use server"`).
- **Shape (in order)**: `await requireAdmin()` → `await assertRateLimit(...)` → Zod `.safeParse(raw)` →
  read **before** snapshot → `prisma.$transaction([...])` → `recordAdminAudit({ before, after })` → `revalidatePath(...)`.
  Pattern lives in `src/lib/governance/actions.ts`.
- **STOP**: never accept a client-supplied signer/admin id; never `recordAdminAudit` or `revalidatePath` *outside* the transaction's success path.
- **Validate**: `pnpm test <domain>` + `pnpm typecheck`.

## 4. Add an authed API route
- **Entry**: mirror `src/app/api/backtest/run/route.ts`.
- **Shape (in order)**: `export const runtime = "nodejs"` + `dynamic = "force-dynamic"` → `assertBodySize(req)` →
  `requireAuth()`/`requireAdmin()` → `assertRateLimit(...)` → Zod `safeParse` → work. Both helpers in `src/lib/rate-limit.ts`.
- **STOP**: never add `/api/*` to `src/proxy.ts` `matcher` — edge can't do a DB role lookup; each route self-guards.
- **Validate**: `pnpm test <route>` + `pnpm typecheck`.

## 5. Add an inbound webhook
- **Entry**: `src/app/api/<vendor>/webhook/route.ts` (peers: `resend`, `docusign`, `typeform`, `hubspot`, `persona`).
- **Shape**: verify HMAC/signature **fail-closed before any processing**; enforce a replay window.
- **STOP**: missing secret → `503`; bad/absent signature → `401`. Never process then verify.
- **Validate**: `pnpm test <vendor>`.

## 6. Add an Inngest job
- **Entry**: `src/lib/inngest/functions/<x>.ts`; register in `src/app/api/inngest/route.ts`.
- **Shape**: define with idempotency key + `step.run(...)` memoization; pure work delegates to `src/lib/*` modules.
- **STOP**: no unbounded fan-out; no `Date.now()` inside the engine path. **Validate**: `pnpm test inngest`.

## 7. Add a vault preset
- **Entry**: `src/lib/engine/vaults.ts` (assumptions) + `src/lib/data/vaults.ts` (`isYieldVaultRow`) + `src/lib/agents/loaders/vault.ts`.
- **Shape**: vault id is first-class; each carries its own `apyTarget`/share classes/provenance.
- **STOP**: no vault reuses another's `apyTarget` or numbers silently (per-vault isolation, CLAUDE.md #9).
- **Validate**: `pnpm test vault` + `pnpm typecheck`.

## 8. Tune a DS token
- **Entry**: `src/app/cockpit.css` for the **LIVE** value (the `:root` non-layered block wins over `cockpit-shell/tokens.css`).
- **Shape**: change the token; **mirror** the scale into `src/app/globals.css` `@theme` so Tailwind utilities track it. One green: `--ct-accent` #A7FB90.
- **STOP**: don't reintroduce a `--ds-*` namespace or a second green. **Validate**: visual — `browser_close` then re-`navigate` (CSS is chunk-cached).

## 9. Add a nav entry
- **Entry**: ONLY `src/components/nav/product-nav-items.ts`.
- **Shape**: add a `NavItem` to the right section's `tabs`.
- **STOP**: invariant — a section's `href` must equal its FIRST tab's `href`, else landing the section route 404s silently.
- **Validate**: `pnpm test product-nav` + click the route.

## 10. Wire a demo builder
- **Entry**: `src/lib/demo/*` (`builders.ts`, `guard.ts`, `markers.ts`).
- **Shape**: demo output equals live by type (same shape, marked as demo). **STOP (D5)**: never route a demo identity through `previewZeros`.
- **Validate**: `pnpm test demo`.

## 11. Add a protected route
- **Entry**: `src/proxy.ts` — add the prefix to **BOTH** `PROTECTED_PREFIXES` AND `config.matcher`.
- **Shape**: if the route is public app-chrome, also add it to the bare/public list. **STOP**: missing it in `matcher` = the proxy never runs = silently unguarded.
- **Validate**: `pnpm test proxy` + hit the route logged out.

## 12. Edit a transactional email
- **Entry**: `src/lib/auth/send-welcome-email.ts` / `src/lib/auth/password-reset.ts`.
- **Shape**: edit copy/template only. **STOP**: keep the anti-enumeration `await` semantics (same timing/response whether the account exists or not).
- **Validate**: `pnpm test auth` + `pnpm typecheck`.

## 13. Tune / add a batch agent
- **Entry**: `src/lib/agents/<x>.ts` (e.g. `investor-memo.ts`, `outreach-writer.ts`).
- **Shape**: Zod-strict output; run `assertApyAlwaysRange` + `assertNoForbiddenWords` (`src/lib/agents/validators`). Single provider: OpenAI GPT-4.1 (ADR-011).
- **STOP**: APY only as a range; no forbidden words; no second LLM provider, no Anthropic SDK.
- **Validate**: `pnpm test agents`.

## 14. Extend cockpit-chat / Master Agent
- **Entry**: `src/app/api/cockpit-chat/route.ts` + `src/lib/llm/chat-agent.ts`.
- **Shape**: strip the client `system` field server-side (no prompt override); navigation = read-only whitelist only.
- **STOP**: no write/financial/admin tool auto-exec — every action stays human-in-the-loop (ADR-012). Flag-gated `CHAT_MASTER_AGENT`.
- **Validate**: `pnpm test llm` + `pnpm typecheck`.
