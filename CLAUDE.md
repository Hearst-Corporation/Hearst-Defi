# RÈGLE DESIGN #0 — LIBERTÉ VISUELLE TOTALE · SEUL IMPÉRATIF : COMPOSANTS CATALYST

**La seule règle de design de ce repo :** l'UI se construit avec les **composants Catalyst**
(`src/components/catalyst/*` + primitives). C'est le seul garde-fou design qui subsiste.

**Tout le reste est LIBRE — aucune autre contrainte de design ne s'applique :**
- crée de nouveaux tokens, de nouvelles classes / couches CSS, du hardcode si tu veux ;
- réinterprète, refonds une section entière, change le layout, la palette, la typo, les
  espacements — pas de mono-accent imposé, pas d'échelle d'espacement figée, pas de
  frontière dashboard/marketing, pas d'obligation de « corriger le runtime existant » ;
- tu peux redessiner librement, t'inspirer d'une maquette, oser une direction visuelle.

**Ceci ANNULE et REMPLACE, pour ce repo, la section « DESIGN » du `~/.claude/CLAUDE.md`
global** (squelette Catalyst imposé, charte qualité, un seul accent, tokens obligatoires,
échelle d'espacement, méthode de travail visuel). Il ne reste que « composants Catalyst ».

Inchangés — ce ne sont PAS des règles de design : workflow git / multi-agent, sécurité
back-end, non-négociables PRODUIT (honnêteté des états, ranges, provenance, mots interdits),
stack.

---

# MANDATORY MULTI-AGENT WORKFLOW — WORKTREES, LOCKS, COMMIT, PUSH, MERGE

This repository uses a strict multi-agent workflow.

These rules are mandatory for every agent, every task, and every code change.

Core rules:
1. Worktree isolation is REQUIRED whenever there is parallelism: several agents at once,
   fan-out, a long run, or a fragile/dirty tree. A SINGLE sequential agent may work in the
   current repo on the current branch or a dedicated feature branch (no worktree required).
   Never two agents writing the same working tree; shared files → go sequential.
   (Global baseline: `~/.claude/dev-agent-rules.md` §3.)
2. One task = one short-lived branch (in a worktree when rule 1 requires isolation).
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
- wait for Vercel READY if production-facing.

> **Prod reality (no CI gate).** Any `push`/`merge` to `main` deploys straight to Vercel
> production (`connect.hearst.app`) — Vercel's Git integration is NOT blocked by `ci.yml`
> (see `docs/DEPLOYMENT.md`). So `main` is a *deploy trigger*, not a gated integration branch
> today. **Never push or merge to `main` without explicit confirmation from the user** —
> that push IS the production deploy. Branch protection requiring `ci.yml` is a separate,
> not-yet-wired chantier.

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

Single-vault institutional DeFi platform. **Hearst Mining Note** (on
`PermissionedDynaVault v2.1`, Base Sepolia testnet).

BTC-accumulation instrument backed by real Bitcoin mining, structured in **3 on-chain
pockets — 40 / 27 / 33** (B1 Mining Power / B2 BTC Pouch / B3 Reserve USDC). BTC is
**accumulated over a 24-month term and delivered at maturity** — there is **no periodic
cash distribution and no fixed APY**. Estimated return is disclosed **as a range, in
accumulated BTC, not guaranteed** (methodology **v3.0**, ADR-019). Cayman SPV structure,
$250k min ticket, 60-day soft lock-up (both contractual / applicative, not enforced
on-chain). *(The earlier "yield vault / monthly USDC distributions / target APY 8–15%"
framing is retired — v3.0 replaced it.)*

## Source of truth (read before any feature work)

- **Agent routing**: `AGENTS.md` (keystone) → per-domain `docs/*_CONTEXT.md`, `docs/DO_NOT_TOUCH.md`,
  `docs/OWNERSHIP_MATRIX.md`, `docs/COMMON_TASKS.md`, `docs/SYSTEM_MAP.md`. Scoped Cursor rules in `.cursor/rules/`.
- **Product spec**: `/docs/spec/*.mdx` — read the relevant spec file before coding
- **Methodology**: `/docs/methodology/v3.0.md` — **active** (mining note, ADR-019). `v1.0.md` (rule-based yield) and `v2.0.md` (Monte Carlo extension) are **immutable historical references** on file for memos generated under them; `v2.1-draft.md` never ratified. Immutable once published; bump version + ADR to change.
- **Roadmap**: `/docs/roadmap.json` + `/admin/roadmap` UI — planning context for major feature work, not a blocker for active UI calibration / fix-forward passes
- **Decisions**: `/docs/decisions/ADR-*.md` — Architecture Decision Records, append-only
- **Design system** (copie locale éditable) : DS Cockpit dé-vendoré dans `cockpit-shell/` (composants + `tokens.css`) — cascade `cockpit-shell/tokens.css` → `src/app/cockpit.css` → `src/app/globals.css`. Éditable librement (tokens, CSS, composants, nouveaux tokens/couches autorisés — voir RÈGLE DESIGN #0). Pas de mono-accent imposé, pas de palette figée. Docs : `docs/DESIGN_SYSTEM.md` + `docs/CSS_INDEX.md` (carte de la cascade).
- **Plan source**: `/Users/adrienbeyondcrypto/.claude/plans/tu-es-claude-opus-functional-eich.md`

## Non-negotiables (CI enforces most)

1. **Estimated return always as a range**, never a single point. Output `"9.4-12.8%"` not
   `"11%"`. Under v3.0 the range describes **accumulated BTC, not distributed / not a fixed
   APY** — the range mechanic is preserved, only its meaning changed.
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
6. **Engine is pure-function**: no DB, no fetch, no I/O in `src/lib/engine/*`. (The engine
   now models the v3.0 mining note — mining economics, take-profit, vending curve,
   curtailment, BTC-accumulation projection — not the retired scenario-lab. The standalone
   Scenario Lab route and its preset/routing metadata were removed; the `scenario-narrative`
   batch agent stays, narrating BTC-accumulation.)
7. **Monte Carlo allowed (V2, see ADR-006)** *alongside* the rule-based engine —
   rule-based stays the default. PRNG **seed must be injected** (engine purity #6
   still holds: no `Math.random()` ungoverned, no `Date.now()`). MC belongs to
   **Methodology v2.0 (historical)**; the range stays a **range** (#1), MC only adds
   p5/p50/p95. The **active** product runs on **v3.0** (mining note), which does not require MC.
8. **Smart contracts**: the v3.0 mining note targets **`PermissionedDynaVault v2.1`**
   (3 pockets 40/27/33, keeper-driven monthly engine — the SOURCE OF TRUTH for its
   interface is `docs/VAULT_SPEC_V2.1.md`). It is **written but NOT deployed** (all
   addresses TBD); the app runs in `legacy` mode on the prior ERC-4626
   `HearstYieldVault` until `NEXT_PUBLIC_DYNAVAULT_ADDRESS` is posted. Also on Base
   Sepolia: event logger + PoR registry (Phase 2 ✅). **Mainnet deploy stays gated on a
   completed Spearbit audit + remediation** (ADR-006) — lifting the lock does NOT
   authorize unaudited mainnet code.
9. **Vault id is a first-class key** (multi-vault plumbing kept, `engine/vaults.ts` +
   loaders): each vault carries its own assumptions, share classes, and provenance — no
   vault reuses another's numbers silently. **The active product is a single mining note**
   (v3.0); the earlier Yield / Defensive / BTC Plus family is not the shipped model.
10. Every projection must show its **assumptions** and a **"not guaranteed"** disclaimer.
11. **HARD RULE — no cross-project imports.** It is **forbidden** to copy, move, or import any
    component, file, asset, snippet, type, style, or dependency from `/Users/adrienbeyondcrypto/Dev/Projects/hearst-connect`
    (or any other sibling repo) into this codebase. That project is **read-only reference material**:
    you may open it to study patterns/structure, but every line shipped here must be **recoded
    from scratch** using this project's locked design system (Cockpit tokens) and conventions.
    No `git mv`, no copy-paste, no symlink, no new dependency added just because A had it.

## Méthode de travail visuel

Design LIBRE (voir RÈGLE DESIGN #0). Aucune contrainte de charte, d'accent, d'échelle ou
de « corriger le runtime ». Seul impératif : composants Catalyst. Itère librement le
layout, la palette, la typo, le spacing, les effets — sans étape roadmap/ADR préalable.

Seul garde-fou qui subsiste ici, et c'est du PRODUIT, pas du design : **honnêteté des
états**. Portfolio/UI sans position active → layout vide honnête, jamais de faux badge
`Live`/`Verified` ni de chart fictif.

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
- **Couleurs, tokens, CSS : LIBRES** (RÈGLE DESIGN #0). Les tokens `--ct-*` restent disponibles (`cockpit.css` live, `tokens.css` base) mais ne sont plus obligatoires — hardcode, nouveaux tokens et nouvelles couches CSS autorisés.
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
