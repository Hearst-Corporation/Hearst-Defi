# MANDATORY MULTI-AGENT WORKFLOW — WORKTREES, LOCKS, COMMIT, PUSH, MERGE

This repository uses a strict multi-agent workflow.

These rules are mandatory for every agent, every task, and every code change.

Core rules:
1. One agent = one isolated git worktree.
2. One task = one short-lived branch.
3. One integration step (when user asks) = commit, push branch, PR, merge into `main`.
4. Every agent must reserve files before editing.
5. No agent may edit files owned by another active agent.
6. No broad staging.
7. No hidden unrelated cleanup.
8. No destructive reset, rebase, stash pop, or checkout in another agent’s worktree.
9. Production is currently treated as internal/dev, so frequent merges are allowed when validations pass.
10. If the user says `merge`, `push`, `ship`, `deploy`, `mets en ligne`, `commit`, or equivalent,
    run the matching level from `commit-discipline.mdc` (B = commit/push branch, C = full checkpoint).
    Stop coding before level C.

Required worktree protocol:
- Agents must never develop directly in a shared, dirty, or active worktree.
- Every task starts from latest `origin/main` in an isolated worktree.
- If the worktree is not clean, STOP and report.

File lock protocol:
- Before editing, inspect `docs/agent-file-locks.md`.
- Reserve intended files/directories before coding.
- If a path is locked by another active agent, do not edit, stage, or commit it.
- Report conflicts and wait for arbitration.
- Release locks after merge.

Sensitive single-owner files:
- prisma/schema.prisma
- package.json
- pnpm-lock.yaml
- next.config.*
- tailwind.config.*
- src/app/api/cockpit-chat/route.ts
- src/lib/llm/tools/registry.ts
- src/lib/canvas/compose.ts
- src/lib/canvas/emit.ts
- src/app/globals.css
- src/app/doc-flow.css
- src/app/admin/admin-proof.css
- docs/agent-file-locks.md
- CLAUDE.md
- .mcp.json

`.mcp.json` is security-sensitive. Supabase MCP must remain read-only unless the user explicitly approves a write-capable session. Never commit a change that removes `--read-only` from Supabase MCP without explicit approval.

Checkpoint / merge protocol (level C — prod integration only):
- fetch origin;
- reconcile with latest origin/main;
- verify locks;
- run validations relevant to the task;
- stage explicit files only;
- commit (if uncommitted work remains);
- push branch (`git push -u origin HEAD`) — never push `main` directly from an agent worktree;
- create PR into main;
- merge if PR is mergeable and checks are acceptable;
- wait for Vercel READY if production-facing (`push main` triggers Vercel prod — cf. `docs/DEPLOYMENT.md`).

Never use:
- git add -A
- git add -u
- git commit -a

Forbidden files:
- .continue/
- .env
- .env.*
- *.local
- node_modules/
- screenshots/
- tmp/
- logs/
- coverage/
- playwright-report/
- .DS_Store

Every final report must include:
- worktree path;
- branch;
- lock acquired/released;
- files changed;
- files excluded;
- validations;
- commit hash;
- PR URL;
- merge commit;
- origin/main HEAD;
- Vercel deployment status if applicable;
- safety confirmation.

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Hearst Connect

Single-vault institutional DeFi platform. **Hearst Yield Vault.**

Mining-backed structured yield, monthly USDC distributions, target APY range 8–15%.
Cayman SPV structure, $250k min ticket, 60-day soft lock-up.

## Source of truth (read before any feature work)

- **Agent routing**: `AGENTS.md` (keystone) → per-domain `docs/*_CONTEXT.md`, `docs/DO_NOT_TOUCH.md`,
  `docs/OWNERSHIP_MATRIX.md`, `docs/COMMON_TASKS.md`, `docs/SYSTEM_MAP.md`. Scoped Cursor rules in `.cursor/rules/`.
- **Product spec**: `/docs/spec/*.mdx` — read the relevant spec file before coding
- **Methodology**: `/docs/methodology/v1.0.md` — immutable once published, bump version if change needed
- **Roadmap**: `/docs/roadmap.json` + `/admin/roadmap` UI — planning context for major feature work, not a blocker for active UI calibration / fix-forward passes
- **Decisions**: `/docs/decisions/ADR-*.md` — Architecture Decision Records, append-only
- **Design system** (copie locale éditable) : DS Cockpit dé-vendoré dans `cockpit-shell/` (composants + `tokens.css`) — cascade `cockpit-shell/tokens.css` → `src/app/cockpit.css` → `src/app/globals.css`. Éditable librement (tokens `--ct-*`, CSS, composants) : pas de package figé, pas de source centrale. **Un seul vert : `--ct-accent` #A7FB90**, pas de namespace `--ds-*`. Docs : `docs/DESIGN_SYSTEM.md` + `docs/CSS_INDEX.md` (carte de la cascade).
- **Plan source**: `/Users/adrienbeyondcrypto/.claude/plans/tu-es-claude-opus-functional-eich.md`

## Non-negotiables (CI enforces most)

1. **APY always as range**, never single point. Output `"9.4-12.8%"` not `"11%"`.
2. **Every metric has a provenance badge**: Live / Oracle / Attested / Estimated / Manual / Stale.
3. **PTAI format mandatory** for simulations and rebalancing actions:
   Projection → Trigger → Action → Impact.
4. **No AI chat with *autonomously-executed* write tools.** The 4 batch agents produce
   structured JSON only (see `/docs/spec/09-agents.mdx`). ONE conversational cockpit
   chat is shipped — a **single engine** for all modes (LP "Master Agent" + admin
   copilot + review-mode); the legacy `@hearst/cockpit-shell` handler is retired
   (**ADR-017**). It can navigate (read-only, closed route whitelist) and call bounded
   **read** tools, plus **write** tools that are ALWAYS human-in-the-loop: every write
   is draft-only and gated by a two-step confirmation token — the model never
   auto-executes one (admin review-note / governance-proposal drafts; outreach
   `source` / `draft` / `trigger_send_run`). **No financial or custodial action**
   from the chat, ever (**ADR-012** + **ADR-017**, scoped exceptions). Guardrails:
   server-side system prompt (no client override), output-side compliance guard
   (forbidden words + APY-range) on every human-facing surface, role-aware register.
   Kill-switch `CHAT_MASTER_AGENT` (default ON; `=0` disables the chat, no fallback).
   Outreach **sending** exception (**ADR-016**): a send run — the hourly cron OR the
   `outreach_trigger_send_run` chat tool — only dispatches for **Tier B/C** when
   `OUTREACH_AUTONOMY` is `SEND`+ (default `SUGGEST` = nothing auto-sends).
   **Tier A is never auto-sent**; hard daily cap (`OUTREACH_DAILY_SEND_CAP`) +
   warm-up; suppression re-checked at send time; every send forbidden-words guarded,
   carries an unsubscribe link, and is audited. Not a financial/custodial action.
5. **Forbidden words in agent outputs**: "guarantee", "promise", "certain", "will deliver", "risk-free".
6. **Scenario Engine is pure-function**: no DB, no fetch, no I/O in `src/lib/engine/*`.
7. **Monte Carlo allowed (V2, see ADR-006)** *alongside* the rule-based engine —
   rule-based stays the default. PRNG **seed must be injected** (engine purity #6
   still holds: no `Math.random()` ungoverned, no `Date.now()`). MC requires
   Methodology v2.0; headline APY stays a **range** (#1), MC only adds p5/p50/p95.
8. **Smart contracts**: testnet event logger Phase 2 ✅, ERC-4626 vault written +
   tested on Base Sepolia (Phase 3). **Mainnet deploy stays gated on a completed
   Spearbit audit + remediation** (ADR-006) — lifting the lock does NOT authorize
   unaudited mainnet code.
9. **Multi-vault allowed (V1+, see ADR-006)**: Yield / Defensive / BTC Plus. Vault id
   is a first-class key; each vault carries its own assumptions, share classes, and
   provenance — no vault reuses another's numbers silently.
10. Every projection must show its **assumptions** and a **"not guaranteed"** disclaimer.
11. **HARD RULE — no cross-project imports.** It is **forbidden** to copy, move, or import any
    component, file, asset, snippet, type, style, or dependency from `/Users/adrienbeyondcrypto/Dev/Projects/hearst-connect`
    (or any other sibling repo) into this codebase. That project is **read-only reference material**:
    you may open it to study patterns/structure, but every line shipped here must be **recoded
    from scratch** using this project's locked design system (Cockpit tokens) and conventions.
    No `git mv`, no copy-paste, no symlink, no new dependency added just because A had it.

## Méthode de travail visuel (RÈGLES ASSOUPLIES)

- **Initiative visuelle encouragée :** Les améliorations proactives (glassmorphism, lueurs/glows, dégradés radiaux premium) sont appréciées pour renforcer l'aspect institutionnel, tant qu'elles respectent globalement l'ambiance sombre et les couleurs de base.
- **Réversibilité.** Toute modif doit pouvoir être annulée vite. Pas de `git add/commit/push/reset` sans demande explicite.
- **Après chaque modif CSS/Turbopack** : `browser_close` puis re-`navigate` (sinon CSS servi en cache, Playwright garde l'ancien chunk).
- **Accent = vert `#A7FB90` principalement** (fond noir `--ct-bg-deep`). Panneaux modules = **graphite opaque plat** (`.ct-glass-panel`, nom legacy — pas de verre dépoli). Lueurs ambiantes autorisées **sur le shell / fond**, pas comme fill de card.
- **Portfolio empty state** — Sans position active : l'interface affiche naturellement son layout vide (le contrat ghost a été supprimé). Pas de faux badge `Live`/`Verified` ni de mockup chart fictif.
- **Phase chantier UI :** spacing, marges, hiérarchie de page, wording, nav et
  layout shell/doc-flow peuvent être itérés directement dans `cockpit.css`,
  `doc-flow.css` et les composants concernés sans étape roadmap/ADR préalable,
  tant que les non-négociables produit et l'honnêteté des états restent intacts.

## Stack

- Next.js 16 (App Router, Server Components by default)
- TypeScript strict (`noUncheckedIndexedAccess: true`, `noImplicitOverride`, `noFallthroughCasesInSwitch`)
- Tailwind CSS v4 (no `tailwind.config.js`, theme in `globals.css` `@theme` block)
- Prisma + Postgres (Supabase in production, SQLite for local dev — `DATABASE_URL=file:./prisma/dev.db`)
- Inngest for jobs and crons (V1)
- LLM provider: **OpenAI GPT-4.1** (`openai` SDK, `OPENAI_API_KEY`). Single model for all 4 agents + cockpit chat — **ADR-011** (supersedes ADR-007 / Kimi-via-Hypercli, retired). No Anthropic SDK. The client lives in `src/lib/llm/openai.ts` — there is no `kimi.ts` and no `kimi`/`KIMI_*` exports left (those legacy aliases were fully removed; don't look for them).
- Foundry for smart contracts (Phase 2+, Base Sepolia testnet — mainnet gated on Spearbit)
- Package manager: **pnpm** (workspace in `pnpm-workspace.yaml`)
- Path alias: `@/*` → `./src/*`; shell alias `@hearst/cockpit-shell` → `./cockpit-shell/src` (tsconfig + vitest, not node_modules)

## Common commands

```bash
pnpm dev                  # Next dev server (Turbopack root pinned in next.config.ts)
pnpm build                # Production build
pnpm typecheck            # tsc --noEmit  (the real gate — lint is `eslint src || true`, advisory)
pnpm test                 # vitest run  (~2400 tests under src/**/__tests__/)
pnpm test:e2e             # Playwright

pnpm db:generate          # prisma generate
pnpm db:push              # prisma db push (schema → SQLite dev.db, no migration history)
pnpm db:migrate           # prisma migrate dev (create + apply named migration)
pnpm db:studio            # Prisma Studio GUI
```

Test runner (Vitest 4) and Playwright are wired — do not re-add or re-configure either.

## Architecture

The product is built out, not a skeleton: investor cockpit (`src/app/(product)/*` — portfolio, vaults,
proof-center, profile) + admin console (`src/app/admin/*`, ~20 sections) on the 3-column Cockpit shell;
the pure engine (`src/lib/engine/*`), the 4 GPT-4.1 batch agents + LP Master Agent (`src/lib/agents/*`,
`src/lib/llm/*`), Inngest jobs, and the Base Sepolia contracts (`contracts/*`) all exist. Prod DB =
Supabase Postgres (~50 Prisma tables); file storage = Supabase Storage (`reports` bucket).

- **Mental model & where things live**: `docs/SYSTEM_MAP.md` (3 layers, auth model, data triad, nav systems).
- **Who owns what / where to start / what not to touch**: `AGENTS.md` → `docs/OWNERSHIP_MATRIX.md`,
  `docs/DO_NOT_TOUCH.md`, the per-domain `docs/*_CONTEXT.md`, and `docs/COMMON_TASKS.md` recipes.
- **Canonical mutation pattern** (any admin surface): static doc/data → Prisma overlay → Server Component
  query → Server Action (`requireAdmin` → rate-limit → Zod → mutate in `$transaction` → audit →
  `revalidatePath`). There is no client-side data fetching. Detail in `docs/BACKEND_CONTEXT.md`.

## Conventions

- **Server Components by default**; `"use client"` only when interactivity requires it. No `useEffect` for data fetching.
- **No `any`, no `as unknown as`** — fix the model. **All routes typed**; `next/link`, never `<a href>`.
- **`server-only`** at the top of any module touching `fs`/`prisma` (see `src/lib/roadmap.ts`).
- **`cn()` from `@/lib/cn`** for conditional classes — never raw conditional template strings.
- **Dark mode only.** Colors from `--ct-*` CSS vars (`cockpit.css` is the live value, `tokens.css` the base); no `dark:` modifiers; no `tailwind.config.js`.
- **Env vars validated by Zod at boot** in `src/lib/env.ts`.

Per-domain conventions and invariants live in the `docs/*_CONTEXT.md` bundles + `.cursor/rules/`.

## Sub-agents available

Four specialist agents under `.claude/agents/` (invoke via `Agent` with the matching `subagent_type`);
each carries its own scope, file ownership, and "forbidden" list, stricter than this file:

- **`engine-dev`** — owns `src/lib/engine/*`. Refuses UI work and any I/O inside engine code.
- **`agent-dev`** — owns `src/lib/agents/*`. Structured outputs, single-model pinning (OpenAI GPT-4.1, ADR-011).
- **`sc-dev`** — owns `contracts/*`. Foundry only, OpenZeppelin primitives, phased rollout.
- **`ui-dev`** — owns `src/app/*` and `src/components/*`. Refuses business logic outside the engine.

For task→file routing and STOP conditions per role, see `AGENTS.md` and `.cursor/rules/*.mdc`.

## Before major feature work

1. Read the related `/docs/spec/*.mdx` + the matching `docs/*_CONTEXT.md`
2. Check `/admin/roadmap` if the work is roadmap-driven
3. Code
4. Update roadmap status only when the change is actually tied to a roadmap item
5. Add / update an ADR only for non-trivial product or architecture decisions, not for micro UI calibration

## When in doubt

Open the plan file: `/Users/adrienbeyondcrypto/.claude/plans/tu-es-claude-opus-functional-eich.md`.
It's the master vision. If the plan and the code diverge, the plan wins — update the code, not the plan, unless the plan is wrong (then update the plan first).
