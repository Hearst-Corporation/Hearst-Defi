# PROJECT_STATE.md — Agentic Full Test Series

> Instantané pris le 2026-07-04 par le batch 1/6 (architect, read-only).

## 1. État du dépôt au moment de ce batch

| Champ | Valeur |
|---|---|
| Branche | `nexus/loop_mr6ee1jx-mr77jvoy` |
| origin/main HEAD (au démarrage) | `6927cdb0` |
| Working tree en entrée | propre |
| Fichiers modifiés par ce batch | `docs/agent-file-locks.md` (ajout d'un lock actif) + création de `docs/projects/agentic-full-test/*` |

## 2. Validations exécutées ce batch

Aucune validation `pnpm` exécutée — batch strictement docs-only, aucun fichier source
touché (ni `src/**`, ni `prisma/**`, ni config). `node_modules` absent au démarrage du
runner ; pas d'installation nécessaire puisqu'aucune commande de build/test/typecheck ne
s'applique à des fichiers Markdown. Revue manuelle des fichiers écrits (relecture
Markdown, cohérence des renvois croisés entre `PROJECT_PLAN.md`/`INVENTORY.md`/
`COVERAGE_MATRIX.md`/`BATCHES.md`).

## 3. Périmètre touché par ce batch

Uniquement `docs/projects/agentic-full-test/**` (nouveaux fichiers) + une entrée ajoutée
dans `docs/agent-file-locks.md` :
- `PROJECT_PLAN.md`
- `INVENTORY.md`
- `COVERAGE_MATRIX.md`
- `BATCHES.md`
- `REPORT_SKELETON.md`
- `PIPELINE_SCHEMA.md`
- `PROJECT_STATE.md` (ce fichier)
- `HANDOFF.md`

Aucun fichier de code source, `prisma/**`, `.github/workflows/**`, secrets/`.env*`,
`vercel.json` n'a été modifié — conforme au mandat "aucun code produit" de ce batch.

## 4. Ce que les batchs 2-6 doivent savoir avant de démarrer

- La série couvre la ligne agentique complète (22 composants recensés dans
  `INVENTORY.md` : 8 en Partie A produit-LLM, 15 en Partie B orchestration/observabilité),
  découpée en 5 zones disjointes (voir `PROJECT_PLAN.md` §Découpage et `BATCHES.md` pour
  le mapping batch↔zone à jour).
- **Budget DLLM dur : ≤50 requêtes réelles cumulées sur toute la série, jamais 100** —
  voir `PROJECT_PLAN.md` §Protocole de test pour la répartition indicative par zone et
  l'obligation de logguer chaque requête réelle dans le `HANDOFF.md` du batch qui la
  consomme.
- Les 5 priorités de couverture identifiées sont dans `COVERAGE_MATRIX.md` §Synthèse — à
  traiter dans l'ordre de priorité si un batch a de la marge au-delà de sa zone stricte,
  mais **sans jamais sortir de son owner-zone sans lock/arbitrage**
  (`docs/agent-file-locks.md`).
- **Ne pas redoubler la série sœur** `docs/projects/outreach-audit/` — tout ce qui est
  spécifique à Outreach (Master Agent, swarm outreach, canvas, writers) reste hors
  périmètre de cette série (voir `PROJECT_PLAN.md` §Coordination).
- **`electron/__tests__/` et `contracts/test/`** sont confirmés hors périmètre (aucun
  rapport avec la ligne agentique) — ne pas y écrire de test malgré ce que suggèrent les
  métadonnées de mission de série.
- `REPORT_SKELETON.md` et `PIPELINE_SCHEMA.md` sont des squelettes à compléter
  progressivement (chaque batch édite uniquement sa propre section) — pas à remplir
  entièrement par un seul batch.
