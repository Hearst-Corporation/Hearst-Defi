# HANDOFF.md — Batch 1 : Intake & Recovery

**Batch** : 1/9 — Intake
**Role** : Read-only intake, inventaire état réel
**Date** : 2026-07-02
**Agent** : nexus architect (agent 1/1)

---

## Ce qui a été fait

- Lecture complète de : `docs/BACKLOG.md`, `docs/PROGRAM_MASTER.md`, `docs/execution/agent-e-sprint-correctness.md`, `docs/OWNERSHIP_MATRIX.md`, `docs/DO_NOT_TOUCH.md`, `docs/decisions/ADR-018-agentic-platform-migration.md`, `docs/agent-file-locks.md`, `prisma/schema.prisma`, routes/modules applicatifs, CI workflow.
- Vérification ciblée de l'état de chaque correction C-01→C-14 (grep code source).
- Production de 4 artefacts docs :
  - `docs/projects/hearst-defi/PROJECT_STATE.md` — snapshot d'état complet
  - `docs/projects/hearst-defi/PROJECT_PLAN.md` — plan Recovery Series 9 batches
  - `docs/projects/hearst-defi/DECISIONS.md` — questions en attente pour Adrien
  - `docs/projects/hearst-defi/BATCHES.md` — suivi statut des batches

---

## Fichiers Modifiés

| Fichier | Action |
|---|---|
| `docs/projects/hearst-defi/PROJECT_STATE.md` | Créé |
| `docs/projects/hearst-defi/PROJECT_PLAN.md` | Créé |
| `docs/projects/hearst-defi/DECISIONS.md` | Créé |
| `docs/projects/hearst-defi/BATCHES.md` | Créé |
| `docs/projects/hearst-defi/HANDOFF.md` | Créé (ce fichier) |

**Aucun code source modifié.**

---

## Ce qui reste (pour les batches suivants)

### Urgent — Batch 2 (avant tout code)
- Exécuter `pnpm db:generate && pnpm typecheck && pnpm test` pour valider la baseline.
- Les ~10 PRs strategies ajoutées post-2026-05-29 peuvent avoir introduit des régressions TS ou test.
- Résultat à documenter dans `PROJECT_STATE.md §2`.

### Corrections P0 encore ouvertes — Batch 3
- **C-05** : Tax preview toujours actif avec données inventées (`tax.ts:198` — `12_000 + userSeed * 100`). Risque légal avec des LP qualifiés. Désactiver le trigger UI.
- **C-11** : Cookie `sameSite: "lax"` → `"strict"` à `session.ts:154`. Attention : vérifier la compatibilité Privy popup (cross-site strict peut bloquer le retour OAuth).
- **C-13** : Model B one-liner LP — phrase "Principal held in a USDC cash reserve" absente de la surface vault detail LP.

### Items à vérifier — Batch 3
- **C-03** (share class widgets) : LockMeter/DistribCalendar utilisent-ils des valeurs hardcodées ? À vérifier dans `portfolio.ts:310-320`.
- **C-08** (server action accreditation) : `accreditationAttestedAt` est dans le schéma (ligne 376) mais la server action `attestAccreditation` dans `AccreditationCheckboxes` doit être vérifiée.
- **C-09** (TOTP admin) : deps `otpauth`/`qrcode` présentes — câblage du flux admin à confirmer.
- **C-12** (reset password Resend) : route `forgot-password` existe — implémentation complète à vérifier.

### Corrections P1 — Batch 4
- **C-14** : Playwright `continue-on-error: true` — CI gate non bloquant. À activer seulement après suite E2E verte.
- **NavSparkline label** : fan-chart p5/p50/p95 implicitement présenté comme Monte Carlo alors que c'est l'APY range — reformuler.

---

## Risques Identifiés

| Risque | Impact | Action recommandée |
|---|---|---|
| Baseline inconnue post-strategies | Élevé | Batch 2 en priorité absolue |
| C-05 tax preview données inventées | Critique (légal) | Batch 3 immédiat |
| Lock stale `feat/kimi-deterministic-intent-router-v2` | Moyen | Libérer dans `agent-file-locks.md` avant tout travail sur `cockpit-chat/route.ts` |
| dev.db driftée | Moyen | Batch 5 (décision Adrien d'abord) |
| D1/D2/D4 non exécutées | Critique (lancement) | Adrien doit déclencher ces actions |
| Playwright non bloquant en CI | Moyen | Batch 4 (C-14) |

---

## Validations Lancées

Aucune validation code exécutée (permissions runner bloquées pour `pnpm typecheck`/`pnpm test`). La vérification de l'état des corrections C-01→C-14 a été faite par grep ciblé dans le code source (lecture seule).

---

## Prochain Batch Recommandé

**Batch 2 — Baseline Verification** : exécuter `pnpm db:generate && pnpm typecheck && pnpm test` et documenter le résultat. C'est le prérequis absolu de tout travail de code. Durée estimée : 1h.

---

## Commit & PR

- **Fichiers créés** (non committés — permissions runner bloquées) : `docs/projects/hearst-defi/` (5 fichiers docs, aucun code)
- **Action manuelle requise** :
  ```bash
  git switch -c nexus/intake-batch1
  git add docs/projects/hearst-defi/PROJECT_STATE.md docs/projects/hearst-defi/PROJECT_PLAN.md docs/projects/hearst-defi/DECISIONS.md docs/projects/hearst-defi/BATCHES.md docs/projects/hearst-defi/HANDOFF.md
  git commit -m "docs(recovery): intake batch 1 — PROJECT_STATE + PROJECT_PLAN + HANDOFF"
  git push -u origin nexus/intake-batch1
  # puis ouvrir une PR vers main
  ```
- **Validations pré-PR** : `pnpm db:generate` + `pnpm typecheck` (triviales pour des fichiers docs uniquement)

---

*Handoff complété : 2026-07-02*
