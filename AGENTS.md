# AGENTS.md — point d'entrée agents (Cursor / GPT / Gemini / Claude)

But : lire **peu** de fichiers, démarrer au bon endroit, ne pas casser les zones verrouillées.
Ce fichier remplace le rôle « règles » du README (qui reste la doc humaine). Charge la doc de
contexte du domaine concerné, **pas** tout le README.

## Où commencer selon la tâche

| Tâche | Lire d'abord | Détail |
|---|---|---|
| UI / CSS / layout | `docs/UI_CONTEXT.md` + `docs/CSS_INDEX.md` | puis la page + le composant ciblés |
| Server action / API / data | `docs/BACKEND_CONTEXT.md` | puis l'`actions.ts` ou `route.ts` ciblé |
| Email / outreach | `docs/EMAIL_CONTEXT.md` | preview/draft only — jamais d'envoi réel |
| Chat / agents / tools | `docs/AGENTS_CONTEXT.md` | `src/lib/llm/` + `src/lib/agents/` |
| Quelle validation lancer | `docs/VALIDATION_MATRIX.md` | tâche → commande minimale |
| Zones interdites | `docs/DO_NOT_TOUCH.md` | STOP avant d'y toucher |

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
