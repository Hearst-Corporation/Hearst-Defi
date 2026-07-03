# HANDOFF.md — Loop 3 : Planner (Architecture Plan & Batches)

**Loop** : 3/9 (série) — Planner
**Role** : Read-only planning — découpe le travail en batches séquentiels avec owner-zones disjointes
**Date** : 2026-07-03
**Agent** : nexus architect (agent 1/1)

---

## Relais effectué (avant tout travail)

- Lu `PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`, `DECISIONS.md`, `HANDOFF.md` (état loop 2).
- Vérifié la dépendance `series_recovery_hearst-defi_0::truth.audit` : **satisfaite** — loop 2 (Truth
  Audit) mergé sur `main` via PR #363 (commit `4d236c8d`, "nexus-loop: apply 1-agent fleet changes
  (loop_mr3jnxm3-mr4n99o2) (#363)"). `git diff main -- docs/projects/hearst-defi/` = vide → les docs
  du worktree courant sont déjà synchronisées avec `main`.
- Vérifié absence de PR ouverte chevauchant l'owner-zone `docs/projects/hearst-defi/` : `gh`
  indisponible sur ce runner (confirmé par commit history du projet — cohérent avec
  `c920d163 fix(nexus): PR via REST API (gh absent du runner)`) ; API GitHub REST bloquée par le
  sandbox réseau de cette session. Fallback : `PROJECT_STATE.md §1` documente la seule PR ouverte
  connue touchant le code (#146, purge-css-final, DRAFT/PARKED, sans rapport avec docs/projects/) ;
  `git branch -a` ne montre aucune branche active sur `docs/projects/hearst-defi/`. Aucun signal de
  conflit trouvé.
- Working tree propre au démarrage et à la fin (aucun fichier hors `docs/projects/hearst-defi/`
  touché).

---

## Ce qui a été fait

- Analyse croisée `PROJECT_PLAN.md` (plan Batches 1-9) + `DECISIONS.md` (12 findings Truth Audit
  T-01→T-12, loop 2) pour produire un plan de batches affiné et actionnable.
- **Réécriture complète de `BATCHES.md`** :
  - Clarifié la distinction entre loop-slots de série (1=Intake, 2=Auditor, 3=Planner, …) et Work
    Batches de contenu (1-9, hérités de `PROJECT_PLAN.md`) — ces deux numérotations avaient divergé
    silencieusement (loop 2 = Truth Audit alors que `PROJECT_PLAN.md` Batch 2 = Baseline
    Verification), source de confusion pour les futurs loops.
  - Signalé un **gate bloquant non résolu** : Work Batch 2 (Baseline Verification —
    `pnpm typecheck`/`pnpm test`/`forge test`) n'a **jamais été exécuté** (court-circuité par le
    pivot vers Truth Audit). Ajouté comme étape 0 obligatoire du Work Batch 3.
  - Redéfini le scope de chaque Work Batch (3 à 9) avec owner-zones explicites et disjointes,
    dépendances, et gates de décision Adrien.
  - Intégré tous les findings T-01→T-12 avec table de traçabilité complète (aucun finding orphelin).
  - Retiré C-09 (MFA TOTP) du scope Work Batch 4 — confirmé FAIT par le Truth Audit, plus besoin
    d'y toucher (réduit l'owner-zone de ce batch, plus de `src/app/admin/`/`src/lib/auth/` général).
  - Signalé le chevauchement de fichier Work Batch 3 / Work Batch 6 sur
    `vaults/[id]/invest/confirmed/page.tsx` (T-02 vs BACKLOG #11) — sans risque d'exécution
    parallèle (série strictement séquentielle) mais ordre à respecter.
- **Corrections factuelles apportées à `DECISIONS.md`** (spot-check read-only sur les chemins cités
  par le Truth Audit, pas un re-audit complet) :
  - `tax-docs-drawer.tsx` (cité pour C-05/T-01) **n'existe pas** — chemin réel :
    `src/app/(product)/portfolio/tax/page.tsx` + `src/lib/portfolio/tax.ts`. Pas de pattern
    "drawer + trigger" — c'est une route complète sans gate.
  - C-13/T-03 (Model B one-liner) : confirmé absent, mais le texte exact et une contrainte de
    placement ("pas au-dessus de la grille d'allocation") sont déjà verrouillés par un test
    existant (`term-sheet-truth.test.tsx:60-64`) — précision utile pour l'implémentation.

---

## Fichiers Modifiés

| Fichier | Action |
|---|---|
| `docs/projects/hearst-defi/BATCHES.md` | Réécrit — Work Batch Plan complet (3-9), owner-zones disjointes, gate baseline verification, traçabilité T-01→T-12 |
| `docs/projects/hearst-defi/DECISIONS.md` | Enrichi — section "Corrections de chemins — Loop 3" (tax-docs-drawer inexistant, contrainte placement Model B) |
| `docs/projects/hearst-defi/HANDOFF.md` | Mis à jour (ce fichier) |

`PROJECT_PLAN.md` et `PROJECT_STATE.md` **non modifiés** — `BATCHES.md` fait désormais autorité sur
le contenu des batches (supersède la liste de `PROJECT_PLAN.md` pour les chemins de fichiers et le
scope détaillé).

**Aucun code source modifié.**

---

## Validations Lancées

Aucune — loop de planification pure, docs-only. Les corrections de chemins ont été vérifiées par
lecture read-only (`find`, `grep`, `ls`) sur le code source, sans aucune écriture. Pas de
`pnpm typecheck`/`pnpm test` nécessaire pour ce commit (aucun fichier `.ts`/`.tsx` touché).

---

## Risques et Notes

| Risque | Impact | Note |
|---|---|---|
| Work Batch 2 (Baseline Verification) jamais exécuté | Élevé — baseline `typecheck`/`test` inconnue depuis 2026-05-29, ~10 PRs strategies mergées depuis | Ajouté comme étape 0 bloquante du Work Batch 3 dans `BATCHES.md` |
| Chemins stales dans `PROJECT_PLAN.md` (Batch 3, tax-docs-drawer.tsx) | Moyen — aurait fait perdre du temps au prochain coder | Corrigé dans `BATCHES.md` + loggé dans `DECISIONS.md` |
| `gh` / API GitHub indisponible dans ce sandbox | Faible | Vérification PR ouvertes faite via signaux indirects (`PROJECT_STATE.md`, `git branch -a`) — recommander qu'un futur loop avec accès `gh` refasse un check direct avant le prochain commit de code |

---

## Prochain Batch Recommandé

**Work Batch 3 — Corrections P0 restantes** (voir `BATCHES.md` pour détail complet) :
1. **Étape 0 (bloquante)** : `pnpm db:generate && pnpm typecheck && pnpm test` — baseline jamais vérifiée post-strategies.
2. **C-05/T-01** : gater la route `/portfolio/tax` (chemin réel, pas de "drawer") + tooltip "Available 2027 Q1".
3. **C-11/T-04** : `session.ts:154` `"lax"` → `"strict"` — tester Privy popup AVANT commit.
4. **C-13/T-03** : ajouter le one-liner Model B (texte exact fourni) dans `term-sheet-preview.tsx`, PAS au-dessus de la grille d'allocation ; inverser l'assertion du test associé.
5. **T-02** : bloqué sur décision Adrien (retirer phrase email vs implémenter Resend).

**Prérequis avant dispatch du prochain loop de code** : Adrien tranche T-02 (peut être fait en parallèle des items 1-4, qui n'en dépendent pas).

---

## Commit & PR

- **Branche** : `nexus/loop_mr3jnxxf-mr52t7vg` (branche courante de ce loop)
- **Fichiers** (docs uniquement, aucun code) :
  - `docs/projects/hearst-defi/BATCHES.md`
  - `docs/projects/hearst-defi/DECISIONS.md`
  - `docs/projects/hearst-defi/HANDOFF.md`
- **Commit** : à créer par le harness Nexus (pas de commit manuel dans cette loop — conformément au contrat "no auto-dispatch, no auto-merge")
- **Validations** : docs-only, aucune requise

---

*Handoff complété : 2026-07-03.*
