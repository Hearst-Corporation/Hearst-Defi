# AGENTS.md — point d'entrée agents (Cursor / GPT / Gemini / Claude)

But : lire **peu** de fichiers, démarrer au bon endroit, ne pas casser les zones verrouillées.
Ce fichier remplace le rôle « règles » du README (qui reste la doc humaine). Charge la doc de
contexte du domaine concerné, **pas** tout le README.

## Où commencer selon la tâche

| Tâche | Lire d'abord | Détail |
|---|---|---|
| UI / CSS / layout | `docs/UI_CONTEXT.md` + `docs/CSS_INDEX.md` + **`docs/PORTFOLIO_LAYOUT_REFERENCE.md`** (**obligatoire**) | puis la page + le composant ciblés |
| Portfolio / shell / symétrie surfaces | **`docs/PORTFOLIO_LAYOUT_REFERENCE.md`** (**obligatoire**) | puis `portfolio.css` + composants |
| Server action / API / data | `docs/BACKEND_CONTEXT.md` | puis l'`actions.ts` ou `route.ts` ciblé |
| Email / outreach | `docs/EMAIL_CONTEXT.md` | preview/draft only — jamais d'envoi réel |
| Chat / agents / tools | `docs/AGENTS_CONTEXT.md` | `src/lib/llm/` + `src/lib/agents/` |
| Quelle validation lancer | `docs/VALIDATION_MATRIX.md` | tâche → commande minimale |
| Zones interdites | `docs/DO_NOT_TOUCH.md` | STOP avant d'y toucher |

## Docs protégées (lecture obligatoire · jamais supprimer)

| Doc | Quand | Gate |
|-----|-------|------|
| **`docs/PORTFOLIO_LAYOUT_REFERENCE.md`** | Shell 3 colonnes, `/portfolio`, grilles `pf-*`, symétrie/alignement surfaces, calibration Figma | `scripts/protected-docs-check.mjs` (pre-commit) |

Mise à jour autorisée **in place** si les tokens/breakpoints CSS changent. Suppression / rename = **bloqué**.

## À éviter (ne pas charger sauf nécessité directe)
- `README.md` (511 l.) et `CLAUDE.md` (197 l.) en entier — pour les règles, ce fichier suffit.
- Les 3 CSS géants en entier — passer par `docs/CSS_INDEX.md` (plage de lignes).
- Le contexte d'un autre domaine (pas de CSS pour une tâche backend, pas de data pour une tâche UI).
- `docs/audit/*.html` (rapports datés, non normatifs).

## Règles de sécurité (non-négociables)
- **APY toujours en range** (`"9.4-12.8%"`), jamais point unique.
- **Mots interdits** dans les sorties agents : guarantee, promise, certain, will deliver, risk-free.
- **Engine pur** (`src/lib/engine/*`) : pas de `prisma`, `fetch`, `Date.now()`, `process.env`, ni I/O.
- **Pas de cross-project import** depuis `Dev/Projects/hearst-connect` (réf. read-only) — tout recodé ici.
- **Pas d'envoi email réel**, pas de mutation prod, pas de migration DB sans demande explicite.

## Réutilisation obligatoire — jamais de double, jamais de code mort (GATE EXÉCUTABLE)

Avant de créer **tout** composant / fonction / module :
1. **Cherche d'abord** dans `docs/COMPONENT_INDEX.md` (index généré de tous les composants). S'il existe → **réutilise-le**.
2. S'il existe mais est en mauvais état → **refactore-le EN PLACE et supprime l'ancien**. Jamais un 2ᵉ exemplaire.
3. Tu remplaces un composant ? **Supprime l'ancien dans le même change** — un export orphelin bloque le push.

Ces règles ne sont pas que du discours, elles **bloquent le commit/push** (cliquet, ne régresse jamais) :
- **pre-commit** → `jscpd` refuse tout commit qui ajoute du code dupliqué (baseline 143 clones) + régénère l'index.
- **pre-push** → `knip` refuse tout push qui laisse du code mort (baseline 22 findings).
- Inspecter : `pnpm quality` (tout), `pnpm quality:dup:report` / `pnpm quality:dead:report`. Baseline : `scripts/quality-baseline.json` (abaisser via `pnpm quality:update` après nettoyage). Bypass délibéré seulement : `--no-verify`.

## Discipline de commit — staging chirurgical (OBLIGATOIRE)

Plusieurs agents éditent `main` en parallèle. Un staging large a déjà **absorbé** le travail
d'un autre scope dans le mauvais commit (incident 2026-06-17 : `docs/DEPLOYMENT.md` avalé dans
`42bd18d feat(ui)`). Donc :
- **JAMAIS `git add -A` / `git add -u` / `git add .` ni le staging implicite de l'IDE.**
  Toujours `git add <chemin1> <chemin2>` — les chemins exacts de TON lot, listés.
- **Un commit = un lot = un owner = un scope.** Avant commit : `git diff --cached --name-only`
  ne contient QUE tes fichiers. Vérifier : `pnpm commit:check`.
- **Hors-scope dans l'index → `git restore --staged <path>` ou STOP.** Jamais committer pour autrui.
- **Permission refusée (commit/push/outil) → STOP immédiat.** Pas de retry, pas de `--no-verify` de contournement.
- **Workstream concurrent détecté** (`git status` montre un autre scope) → ne stage que tes chemins ;
  doute → rapport avant commit, pas de commit.
- Jamais `reset`/`amend`/`rebase`/force-push sans GO explicite.
- **Isolation** : un agent = un worktree/branche (jamais deux agents sur le même tree). Commit
  libre dans sa branche sur **demande utilisateur** ; push **branche uniquement** (`origin HEAD`).
  **`main` = intégration gatée** (PR + CI + merge checkpoint). Push `main` = prod Vercel.

### Fin de passe vs intégration prod (3 niveaux)

| Niveau | Déclencheur | Action agent |
|--------|-------------|--------------|
| **A — Fin de passe** | Lot terminé | Rapport + validations + kill/restart dev (`dev-server-protocol.mdc`). Pas de commit auto. |
| **B — Commit / push** | « commit », « push » (sans merge) | Staging chirurgical → commit → `git push -u origin HEAD`. Jamais `push origin main`. |
| **C — Prod** | « merge », « ship », « deploy », « mets en ligne » | Checkpoint `CLAUDE.md` : PR → merge `main` → Vercel READY. |

Détail staging : voir ci-dessous et `.cursor/rules/commit-discipline.mdc`.

## STOP conditions (s'arrêter et demander)
- Il faut toucher `next.config.ts`, auth/wallet/CSP, `src/proxy.ts`, l'engine, ou data/provenance.
- Une permission/outil est refusé → ne pas contourner, signaler.
- L'envoi d'un email/message public, un commit, un push, ou un déploiement deviennent nécessaires.
- Un appel API Anthropic (crédits) deviendrait nécessaire → demander avant.

## Validations minimales (détail dans VALIDATION_MATRIX)
- UI : `pnpm test <glob composant>`
- Backend : `pnpm test <glob domaine>` + `pnpm typecheck`
- Agents : `pnpm test src/lib/llm`
- Build complet `pnpm build` : seulement si config/route/schema change, pas par réflexe.

## Conventions clés
- Server Components par défaut ; `"use client"` seulement si interactivité requise.
- Pas de `any`, pas de `as unknown as`. Pas de `useEffect` pour fetch.
- `cn()` (`@/lib/cn`) pour les classes conditionnelles. Tokens `--ct-*` uniquement (un seul vert `#A7FB90`).
- Sous-agents spécialisés disponibles sous `.claude/agents/` (engine-dev, agent-dev, sc-dev, ui-dev).
