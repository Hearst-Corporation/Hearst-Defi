# HANDOFF.md — Batch 2 : Truth Audit

**Batch** : 2/9 — Auditor (Truth Audit)
**Role** : Read-only audit — données mockées, hardcodes, actions non branchées, faux compteurs
**Date** : 2026-07-03
**Agent** : nexus architect (agent 1/1)

---

## Ce qui a été fait

- Lecture des relay docs : `PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`, `DECISIONS.md`, `HANDOFF.md` (batch 1).
- Vérification des stop conditions : batch 1 mergé (commit `5d933f8b` / PR #361) ✅ ; state files présents ✅ ; aucune PR ouverte chevauchant `docs/projects/hearst-defi/` ✅.
- Audit code read-only via grep ciblé + agent Explore multi-passes :
  - `tax.ts`, `atomic-exec.ts`, `session.ts`, `password-reset.ts`, `attestation/mock.ts`
  - `governance/actions.ts`, `cockpit.ts`, `notifications-bell-wrapper.tsx`
  - `vaults/[id]/page.tsx`, `vaults/[id]/invest/confirmed/page.tsx`
  - `admin/security/TotpEnrolmentClient.tsx`, `admin/security/actions.ts`
  - `portfolio/distrib-calendar.tsx`, `portfolio/lock-meter.tsx`, `data/portfolio.ts`
  - `accreditation-attestations.tsx`, `app/actions/accreditation.ts`
  - `scenario/nav-sparkline.tsx`, `admin/projection/studio.tsx`
- Rapport d'audit vérité complet : 12 findings (T-01 à T-12) dans `DECISIONS.md`.
- Mise à jour `PROJECT_STATE.md §5` : 5 items reclassifiés (C-03, C-08, C-09, C-12 → ✅ FAIT ; C-13 → ❌ CONFIRMÉ MANQUANT).
- Mise à jour `BATCHES.md` : batch 1 marqué MERGÉ, batch 2 marqué FAIT.

---

## Fichiers Modifiés

| Fichier | Action |
|---|---|
| `docs/projects/hearst-defi/DECISIONS.md` | Enrichi — rapport audit vérité batch 2 (T-01→T-12 + questions Adrien) |
| `docs/projects/hearst-defi/PROJECT_STATE.md` | §5 mis à jour — statut C-03/C-08/C-09/C-12 → ✅, C-13 → ❌ confirmé |
| `docs/projects/hearst-defi/BATCHES.md` | Batch 1 → MERGÉ, batch 2 → FAIT |
| `docs/projects/hearst-defi/HANDOFF.md` | Mis à jour (ce fichier) |

**Aucun code source modifié.**

---

## Findings clés (résumé pour Adrien)

### CRITICAL — LP visible, action requise avant pilote réel

| ID | Fichier | Description | Batch fix |
|---|---|---|---|
| T-01 | `tax.ts:194-201` | Tax preview chiffres inventés (`12_000 + seed × 100`) | Batch 3 |
| T-02 | `confirmed/page.tsx:298` | Promesse email reçu + PDF methodology non implémentée | Batch 3 (décision Adrien) |
| T-03 | `vaults/[id]/page.tsx` | Model B one-liner absent de la fiche LP (C-13) | Batch 3 |

### HIGH — Gap onchain ou admin

| ID | Fichier | Description | Batch fix |
|---|---|---|---|
| T-04 | `session.ts:154` | Cookie `sameSite: "lax"` non corrigé (C-11) | Batch 3 |
| T-05 | `atomic-exec.ts:132` | Distributions avec `0xMOCK_` prefix — pas de vrai transfer USDC | Batch 9 / D7 |
| T-06 | `governance/actions.ts` | Governance actions sans appel Solidity — Safe non déployé | Batch 9 / D1 |
| T-07 | `attestation/mock.ts` | Attestations mining signées par clé Anvil test | Batch 9 / RP-5 |

### MEDIUM — Interne, gated ou feature gap

| ID | Description | Batch fix |
|---|---|---|
| T-08 | Bell notifications `unreadCount=0` hardcodé + drawer placeholder | Batch 8 |
| T-09 | `lp.redemption` / `memo.publish` : modèles Prisma absents | Batch 6 / décision |
| T-10 | Apollo sourcing mock sans `APOLLO_API_KEY` | Batch 9 / RP-8 |

### LOW — Cosmétique

| ID | Description | Batch fix |
|---|---|---|
| T-11 | NavSparkline labels p5/p50/p95 ambigu vs Monte Carlo | Batch 4 |
| T-12 | Export PDF/CSV "coming soon" dans studio projection | Batch 7 |

---

## Corrections sprint clarifiées (C-items)

| Item | Résultat audit |
|---|---|
| C-03 share class widgets | ✅ CONFIRMÉ FAIT (était ⚠️) |
| C-05 tax preview | ❌ CONFIRMÉ OUVERT |
| C-08 attestAccreditation | ✅ CONFIRMÉ FAIT (était ⚠️) |
| C-09 TOTP MFA | ✅ CONFIRMÉ FAIT (était ⚠️) |
| C-11 sameSite strict | ❌ CONFIRMÉ OUVERT |
| C-12 reset password Resend | ✅ CONFIRMÉ FAIT (était ⚠️) |
| C-13 Model B one-liner | ❌ CONFIRMÉ MANQUANT (était ⚠️) |

**Impact sur batch 3** : Scope batch 3 = C-05 + C-11 + C-13 + T-02 (promesse email). C-03/C-08/C-09/C-12 CLOS.

---

## Validations Lancées

Validation commands (`pnpm db:generate`, `pnpm typecheck`) bloquées par permissions runner (non approuvées). Aucun code source modifié — les validations sont triviales pour un commit docs-only. À débloquer si les permissions runner sont élargies.

---

## Risques et Notes

| Risque | Impact | Note |
|---|---|---|
| T-02 promesse email — LP s'attend à recevoir un reçu | HIGH (user experience) | Décision Adrien requise avant batch 3 |
| T-01 + T-03 encore ouverts | Critique (légal) | Batch 3 immédiat |
| C-14 Playwright non bloquant | Moyen | Batch 4 |
| Safe/Timelock non déployés | Critique (lancement) | D1 — Adrien doit déclencher |

---

## Prochain Batch Recommandé

**Batch 3 — Corrections P0 restantes** :
- **C-05** : Désactiver le trigger "Tax Docs Preview" dans `tax-docs-drawer.tsx:243-259` + tooltip "Available 2027 Q1".
- **C-11** : `session.ts:154` `"lax"` → `"strict"` — tester Privy popup cross-site AVANT commit.
- **C-13** : Ajouter Model B one-liner dans `vaults/[id]/page.tsx` ou composant term-sheet.
- **T-02** : Décision Adrien sur email de reçu → soit retirer la phrase, soit implémenter l'email Resend.

Durée estimée : 3-4h.
**Prérequis** : Adrien donne son feu vert sur T-02 (retirer phrase OU implémenter email).

---

## Commit & PR

- **Branche** : `nexus/truth-audit-batch2`
- **Fichiers** (docs uniquement, aucun code) :
  - `docs/projects/hearst-defi/DECISIONS.md`
  - `docs/projects/hearst-defi/PROJECT_STATE.md`
  - `docs/projects/hearst-defi/BATCHES.md`
  - `docs/projects/hearst-defi/HANDOFF.md`
- **Commit** : `docs(recovery): truth audit batch 2 — 12 findings, C-items clarifiés`
- **Validations** : docs-only — `pnpm db:generate` et `pnpm typecheck` non bloquants pour ce commit (permissions runner bloquées ; aucun code TS modifié)

---

*Handoff complété : 2026-07-03*

---

## QA preamble check 1783093112150

- Repo state at check time : branche `nexus/qa_preamble_1783093112150`, working tree clean (`git status` sans modifications en attente).
- Dernier commit visible : `99a37f89 fix(nexus): preambule runner (force l agent a produire)` — la chaîne de fixes nexus-loop récente (mission via stdin, PR via REST API, sync nexus-loop.yml) est en place.
- Ce check confirme que le runner CI est capable d'écrire un fichier réel dans `docs/projects/hearst-defi/` et de le laisser prêt pour commit/push/PR par le workflow (aucune action git exécutée par l'agent lui-même).
