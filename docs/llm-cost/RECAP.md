# LLM Cost Reduction — Récapitulatif complet

> Session du 2026-06-17. Audit read-only coût LLM/Cursor + livraison du lot documentaire P0.
> Aucun code runtime modifié, aucun commit, aucun push. Ce fichier est le récap unique.

---

## 1. Ce qui a été fait (résumé)

1. **Audit read-only** du coût LLM/Cursor (10 phases) → score actuel **5/10**, atteignable **8/10** après P0/P1.
2. **Lot P0 livré** : 13 fichiers de docs/règles agent créés (436 lignes au total), zéro runtime touché.

Objectif : que Cursor/GPT/Gemini **lisent moins, comprennent plus vite, coûtent moins, cassent moins**.

---

## 2. Pourquoi le projet coûtait cher (constat audit)

Repo *fonctionnellement* bien rangé mais **hostile au contexte LLM** :

- **3 CSS géants toujours pertinents** (`cockpit.css` 4513 + `doc-flow.css` 1850 + `portfolio.css` 1347 ≈ **7 700 lignes**) → grep en aveugle.
- **Aucune règle Cursor** (`.cursorrules`/`.cursor/`/`AGENTS.md` absents) → chaque agent rechargeait **README 32 Ko + CLAUDE 13 Ko** juste pour les règles.
- **83 fichiers >250 lignes**, dont 13 >600 mêlant data+UI+actions.
- **Pas de doc de contexte par domaine** → l'agent redécouvre à chaque tâche.
- **`pnpm lint` = `eslint`** non bloquant + CI `continue-on-error` → validation ciblée non fiable, build complet par réflexe.

### Les 10 plus gros facteurs de coût
| # | Facteur | Impact |
|---|---------|--------|
| 1 | 3 CSS centralisés (7 700 l.) | Fort |
| 2 | Aucun `.cursorrules`/`AGENTS.md` → README+CLAUDE rechargés | Fort |
| 3 | 83 fichiers >250 l. (13 >600) responsabilités mêlées | Fort |
| 4 | README 511 l./32 Ko sert de doc humaine ET de règles | Fort |
| 5 | Pas de context doc par domaine | Fort |
| 6 | `registry.ts` 1287 + `chat-agent.ts` 652 + `admin-chat-controls.tsx` 1201 | Moyen-Fort |
| 7 | Couches data épaisses (`portfolio.ts` 913, `dashboard.ts` 726, `cockpit.ts` 579) | Moyen |
| 8 | 8 headers distincts + 19 formatters USD/APY dispersés | Moyen |
| 9 | Validations non ciblées → build complet | Moyen |
| 10 | 156 fichiers docs sans index « lequel lire » | Faible-Moyen |

---

## 3. Fichiers chauds (top fichiers coûteux pour LLM)

| Fichier | Lignes | Pourquoi cher | Reco |
|---|---|---|---|
| [src/app/cockpit.css](../../src/app/cockpit.css) | 4513 | Tout agent UI le grep | Index (P0 ✅ via CSS_INDEX) + split (P1) |
| [src/lib/llm/tools/registry.ts](../../src/lib/llm/tools/registry.ts) | 1287 | Lu en entier pour 1 outil | Split par famille (P1) |
| [src/components/admin/admin-chat-controls.tsx](../../src/components/admin/admin-chat-controls.tsx) | 1201 | UI+state+actions mêlés | Extraire présentation + hook (P1) |
| [src/app/doc-flow.css](../../src/app/doc-flow.css) | 1850 | Grep aveugle pages produit | Index (P0 ✅) |
| [src/app/(product)/portfolio/portfolio.css](../../src/app/(product)/portfolio/portfolio.css) | 1347 | CSS page-level gros | Index (P0 ✅) |
| [src/app/admin/vaults/_vault-form.tsx](../../src/app/admin/vaults/_vault-form.tsx) | 1033 | data+validation+UI | Extraire schema + champs (P1) |
| [cockpit-shell/tokens.css](../../cockpit-shell/tokens.css) | 1001 | Chargé partout | Cheatsheet (P1) |
| [src/app/api/cockpit-chat/route.ts](../../src/app/api/cockpit-chat/route.ts) | 956 | prompt+streaming+guard mêlés | Extraire prompt+guard (P1) |
| [src/lib/data/portfolio.ts](../../src/lib/data/portfolio.ts) | 913 | fetch+derive+format | Séparer fetch/derive (P1) |
| [src/app/api/statements/[id]/pdf/route.tsx](../../src/app/api/statements/[id]/pdf/route.tsx) | 836 | Layout PDF inline | Extraire template (P1) |
| [src/app/admin/outreach/actions.ts](../../src/app/admin/outreach/actions.ts) | 828 | Multi-action email | Split send/draft/campaign (P1) |
| [src/app/admin/vaults/actions.ts](../../src/app/admin/vaults/actions.ts) | 822 | Multi-action monolithe | Split par action (P1) |
| [src/lib/data/dashboard.ts](../../src/lib/data/dashboard.ts) | 726 | fetch+derive | Séparer derive (P1) |
| [src/lib/agents/loaders/vault.ts](../../src/lib/agents/loaders/vault.ts) | 711 | Gros contexte agent | Documenter (P1) |
| [src/app/admin/projection/studio.tsx](../../src/app/admin/projection/studio.tsx) | 705 | UI+logique | Extraire panneaux (P1) |
| [src/lib/llm/chat-agent.ts](../../src/lib/llm/chat-agent.ts) | 652 | Cœur orchestration | Pointé par AGENTS_CONTEXT (P0 ✅) |
| [src/app/admin/product-workspace/page.tsx](../../src/app/admin/product-workspace/page.tsx) | 611 | Page trop riche | Extraire sections (P1) |
| [README.md](../../README.md) | 511 / 32 Ko | Rechargé comme « règles » | Scinder règles → AGENTS.md (P0 ✅, raccourcir = P1) |

---

## 4. Lot P0 livré — fichiers créés (13, 436 lignes)

| Fichier | Lignes | Rôle |
|---|---|---|
| [AGENTS.md](../../AGENTS.md) | 47 | Routeur agent : tâche → quoi lire/éviter, règles sécu, STOP, validations |
| [.cursor/rules/ui.mdc](../../.cursor/rules/ui.mdc) | 25 | Règle Cursor scopée UI (`src/app/**.tsx`, CSS) |
| [.cursor/rules/backend.mdc](../../.cursor/rules/backend.mdc) | 24 | Règle scopée backend (`actions.ts`/`route.ts`/`lib/data`) |
| [.cursor/rules/email.mdc](../../.cursor/rules/email.mdc) | 22 | Règle scopée email (`outreach`/`lib/email`) — no real send |
| [.cursor/rules/agents.mdc](../../.cursor/rules/agents.mdc) | 27 | Règle scopée agents (`lib/llm`/`lib/agents`) |
| [.cursor/rules/do-not-touch.mdc](../../.cursor/rules/do-not-touch.mdc) | 23 | `alwaysApply: true` — zones verrouillées |
| [docs/UI_CONTEXT.md](../UI_CONTEXT.md) | 48 | Shell 3 colonnes, cockpit/doc-flow/portfolio, tokens, glass/flat |
| [docs/BACKEND_CONTEXT.md](../BACKEND_CONTEXT.md) | 35 | Actions/API/services/data, permissions, server-only, engine pur |
| [docs/EMAIL_CONTEXT.md](../EMAIL_CONTEXT.md) | 28 | Outreach, flux draft→preview→send, interdiction envoi réel |
| [docs/AGENTS_CONTEXT.md](../AGENTS_CONTEXT.md) | 39 | Chat/tools/4 agents, UI vs orchestration, GPT-4.1, read-only |
| [docs/VALIDATION_MATRIX.md](../VALIDATION_MATRIX.md) | 30 | Tâche → validation minimale, quand `build`/`tsc` |
| [docs/DO_NOT_TOUCH.md](../DO_NOT_TOUCH.md) | 32 | Zones verrouillées + raisons |
| [docs/CSS_INDEX.md](../CSS_INDEX.md) | 56 | Carte plages-de-lignes des 3 CSS |

---

## 5. Comment ça réduit le coût

- **Règles Cursor scopées** : seule la règle du domaine touché (+ `do-not-touch`) est injectée, au lieu de README 32 Ko + CLAUDE 13 Ko à chaque tâche.
- **CSS_INDEX** : ouverture d'une plage de lignes au lieu de grep 7 700 lignes.
- **Context bundles** : agent backend ne charge plus de contexte UI (et inversement) → prompts courts, moins de relectures, moins d'erreurs sur zones verrouillées.
- **436 lignes de docs** remplacent ~45 Ko de règles rechargées en boucle.

Gain estimé : tokens/prompt **Fort** · temps Cursor **Moyen-Fort** · erreurs agent **Moyen** · prompts longs **Fort**.

---

## 6. Scores LLM-efficiency

| Axe | Avant | Cible P0/P1 |
|---|---|---|
| LLM efficiency globale | 5 | 8 |
| Clarté architecture | 7 | 8 |
| Séparation domaines | 6 | 8 |
| Coût CSS | 4 | 7 |
| Coût composants | 5 | 7 |
| Coût backend | 6 | 7 |
| Coût email/outreach | 5 | 7 |
| Coût agents/orchestration | 5 | 7 |
| Qualité docs agents | 4 | **9** (P0 livré) |
| Validations ciblées | 4 | 7 |
| Facilité Cursor | 4 | **8** (P0 livré) |

---

## 7. Reste à faire (P1 / P2)

**P1 (factorisation ciblée, sur validation)**
- Canoniser `PageHeader` (8→1) + formatters USD/APY → `src/lib/format/`.
- Split `registry.ts` (1287), extraire system-prompt de `cockpit-chat/route.ts` (956), scinder `src/lib/data/*` (fetch/derive).
- Découper `admin-chat-controls.tsx` (1201), `_vault-form.tsx` (1033).
- Insérer un sommaire en tête des 3 CSS (séparé, sur accord explicite).
- Ajouter scripts ciblés `test:ui|backend|agents`.

**P2 (polish)**
- Raccourcir README/CLAUDE (déplacer les règles vers AGENTS.md déjà créé).
- Archiver `docs/audit/*.html` hors chemin agent. Cleanup classes CSS mortes confirmées.

---

## 8. Garanties

- **Aucun code runtime modifié** — seuls docs `.md` + règles Cursor `.mdc` créés (untracked).
- `next.config.ts`, auth/wallet/CSP, `src/proxy.ts`, data/engine/provenance, CSS fonctionnel, `package.json` : **non touchés**.
- **Aucun commit, aucun push, aucun stage.** `git diff --check` propre.
- Les fichiers `M` du `git status` (proof-center, env.ts, doc-flow.css, storage/…) étaient **déjà modifiés avant** ce travail.
