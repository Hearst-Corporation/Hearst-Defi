# PROJECT_PLAN.md — Hearst DeFi (hearst-defi)

> Plan de reprise Recovery Series, établi le 2026-07-02 par le batch Intake (1/9).
> Lecture préalable : `docs/BACKLOG.md`, `docs/PROGRAM_MASTER.md`, `docs/execution/agent-e-sprint-correctness.md`.
> Non-négociables : APY en range, badges provenance, PTAI, agents = JSON only, mots interdits, engine pur, mainnet gaté audit, Model B.

---

## Contexte & Objectif

Le projet Hearst Connect (DeFi single-vault, Hearst Yield Vault) est un produit fonctionnel mais **pas encore prêt pour des LP réels**. La baseline de code (vitest/typecheck/forge) était verte au 2026-05-29 ; des sprints de features (strategies hub) ont été ajoutés depuis. Les corrections P0 du sprint correctness (agent-e) sont majoritairement faites, mais 2 items critiques restent ouverts + 5 à vérifier.

**Objectif de la Recovery Series** : rendre le projet "paper pilot ready" — correction de tous les items C restants + stabilisation de la baseline + préparation des décisions Adrien nécessaires au lancement.

---

## Batches Planifiés

### Batch 1 — Intake ✅ EN COURS
**Role** : read-only. Inventorie l'état réel. Produit `PROJECT_STATE.md`, `PROJECT_PLAN.md`, `HANDOFF.md`.
**Owner zone** : `docs/projects/hearst-defi/`
**Pas de code.**

---

### Batch 2 — Baseline Verification (priorité haute)
**Objectif** : valider que la baseline est verte AVANT tout travail de code. Les commits strategies (~10 PRs) peuvent avoir introduit des régressions.

**Tâches** :
1. `pnpm db:generate` — régénère le client Prisma
2. `pnpm typecheck` — doit être 0 erreur
3. `pnpm test` (Vitest) — doit être ≥ 1766/1766
4. `forge test` — doit être 73/73 (gel contrat)
5. Documenter tout écart dans `PROJECT_STATE.md`
6. Si des erreurs TS sont trouvées : les lister dans un patch minimal

**Owner zone** : aucun code modifié sauf corrections TS minimales si nécessaire
**Dépend de** : batch 1 (ce batch)
**Validations** : `pnpm typecheck` + `pnpm db:generate`

---

### Batch 3 — Corrections P0 Restantes
**Objectif** : fermer les items critiques encore ouverts du sprint correctness.

**Scope** :
- **C-05** (tax preview off) : désactiver le trigger "Tax Docs Preview" dans `src/components/portfolio/tax-docs-drawer.tsx:243-259` + ajouter tooltip "Available 2027 Q1". NE PAS modifier `tax.ts` (les données restent mock — on disable l'accès).
- **C-11** (cookie sameSite strict) : `src/lib/auth/session.ts:154` `"lax"` → `"strict"` + texte `src/app/legal/privacy/page.tsx:97`. Vérifier Privy popup survit (popup domain = privy.io, cross-site → `strict` peut bloquer le retour de popup OAuth — tester avant commit).
- **C-13** (Model B one-liner LP) : ajouter la phrase dans le composant vault detail/term-sheet LP (`src/app/(product)/vaults/[id]/page.tsx` ou composant term-sheet).

**Items à vérifier en même temps** :
- C-03 (share class widgets portfolio) — si pas fait, ajouter au scope
- C-08 server action `attestAccreditation` — vérifier qu'elle existe bien et est branchée dans `AccreditationCheckboxes`
- C-12 (reset password Resend) — vérifier implémentation complète

**Owner zone** : `src/app/(product)/`, `src/components/portfolio/`, `src/lib/auth/session.ts`, `src/app/legal/`
**Dépend de** : batch 2 (baseline verte)
**Validations** : `pnpm typecheck` + `pnpm test` + test manuel flow

---

### Batch 4 — Corrections P1 (sécurité + guards)
**Objectif** : fermer les items de durcissement P1.

**Scope** :
- **C-09** (MFA TOTP admin) : câbler `otpauth` + `qrcode` dans le flux admin (génération QR + validation TOTP). Deps présentes, câblage seul restant. Zone : `src/app/admin/` + `src/lib/auth/session.ts`.
- **C-14** (Playwright CI bloquant) : `continue-on-error: false` à `ci.yml:137` — SEULEMENT après que la suite Playwright soit verte localement. Si E2E rouges → fixer d'abord, puis activer le gate.
- **NavSparkline label** (BACKLOG Lot 1 #2) : reformuler le label fan-chart p5/p50/p95 pour ne plus impliquer "Monte Carlo".

**Owner zone** : `src/app/admin/`, `src/lib/auth/`, `.github/workflows/ci.yml`, composants dataviz
**Dépend de** : batch 3
**Validations** : `pnpm typecheck` + `pnpm test` + test E2E local

---

### Batch 5 — dev.db Alignment (bloquant schéma)
**Objectif** : réaligner la dev.db avec le schéma actuel pour débloquer les futurs changements de schéma.

**Scope** :
- Diagnostiquer les doublons potentiels violant les contraintes `Distribution[period,vaultRef]`, `InvestorTransaction[txHash]`, `Position[txHashOpen]`
- Choisir la stratégie : `db push --accept-data-loss` (recréation locale) OU `CREATE INDEX` chirurgicaux additifs
- Documenter la décision dans `DECISIONS.md`
- Si des doublons existent → les nettoyer d'abord

**Précondition Adrien** : valider l'approche (`--accept-data-loss` efface les données locales — acceptable en dev, à confirmer).
**Owner zone** : `prisma/` (pas de modification schema.prisma sauf indices additifs)
**Dépend de** : batch 4
**Validations** : `pnpm db:generate` + `pnpm typecheck`

---

### Batch 6 — Décisions Produit Lot 4 BACKLOG (nécessite feu vert Adrien)
**Objectif** : les items suivants nécessitent une décision explicite d'Adrien AVANT tout code.

**Questions à soumettre** :

1. **Engine backtest rules-vs-no-rules (BACKLOG #8)** : définir la baseline "sans règles" (touche Methodology v1.0 immuable — bump nécessaire si change). Câbler `compareRules` et l'UI.
2. **Share Class B sélecteur invest (BACKLOG #9)** : ajouter un sélecteur dans le flux invest. Coord avec session vaults active.
3. **Advanced metrics LP (BACKLOG #10)** : `RiskMetricsPanel` côté LP — composant référencé n'existe pas.
4. **Vaults confirmed page hardcodé (BACKLOG #11)** : lire les données depuis le vault réel.
5. **Action-queue restants (BACKLOG #12)** : `lp.redemption` (modèle Redemption absent) + `memo.publish` (champ publish-state absent).

**Ce batch NE CODE PAS** — produit une liste de questions structurées pour Adrien dans `DECISIONS.md`.
**Dépend de** : batch 5
**Pas de code.**

---

### Batch 7 — Lot 5 BACKLOG : Features Non Câblées (si feu vert Adrien)
**Objectif** : câbler les features intentionnellement différées (2026-06-10).

**Features** (par ordre de valeur décroissante) :
- Global search ⌘/ (`GlobalSearch` + `/api/search` — non montés)
- Notifications bell feed
- ⌘K command palette
- Keyboard shortcuts cheatsheet
- Batch actions multi-select
- Saved views 8 templates

**Précondition** : feu vert explicite d'Adrien. Sans accord → NE PAS câbler.
**Dépend de** : décision Adrien post-batch 6

---

### Batch 8 — Notification Matrix + Bell (Lot 6 BACKLOG)
**Objectif** : câbler `src/lib/notifications/router.ts` (NOTIFICATION_MATRIX/resolveChannels/renderTemplate) — actuellement 0 consommateur.

**Scope** : fonctions Inngest par event gouvernance → email (Resend) + in_app (`Notification.create`) + telegram (sender à construire).
**Dépend de** : batch 7 (bell feed doit être monté d'abord)

---

### Batch 9 — Lancement / Intégrations Tierces (décisions D1-D7)
**Objectif** : actions d'intégration non-code nécessaires avant le pilote réel.

**Checklist** :
- D1 : Désigner les 5 signataires Safe 3/5 + clé guardian 2/3 → déployer Timelock + Safe (runbook `docs/execution/agent-a-safe-governance.md`)
- D2 : Engager Maples (counsel Cayman) — brief `agent-c-cayman-counsel.md`
- D4 : Signer Spearbit — email `agent-b-spearbit.md`
- D5 : Périmètre juridictionnel pilotes (exclure US persons sauf Reg D)
- D7 : Décision distribution V1 (transfer USDC réel treasury→vault, retirer `0xMOCK_`)
- Redéployer vault testnet (constructeur 6 args — guardian)
- Renseigner `abi-freeze.json` + `contracts/README.md` avec adresses

**Ce batch est surtout opérationnel, pas de code applicatif.**

---

## Priorités immédiates (sans décision Adrien)

| Ordre | Batch | Estimé | Bloquant |
|---|---|---|---|
| 1 | Batch 2 — Baseline Verification | 1h | Toute modification de code |
| 2 | Batch 3 — Corrections P0 restantes | 3-4h | Paper pilot réel |
| 3 | Batch 4 — Corrections P1 (sécurité) | 3-4h | Durcissement sécurité |
| 4 | Batch 5 — dev.db alignment | 1-2h | Tout changement de schéma |

---

## Contraintes et Garde-fous

- **Gel contrat** : `contracts/src` @ `898991c` — intouchable jusqu'à l'audit Spearbit.
- **Mainnet** : NO-GO absolu — ADR-006, non-négociable #8.
- **Fichiers sensibles single-owner** : `prisma/schema.prisma`, `next.config.ts`, `src/app/api/cockpit-chat/route.ts`, `src/lib/llm/tools/registry.ts`, `globals.css`, `cockpit.css` — coordination required.
- **Pas d'import cross-projet** depuis `Dev/Projects/hearst-connect`.
- **Pas de push main** sans accord Adrien (main = deploy prod Vercel).
- **Lock stale `feat/kimi-deterministic-intent-router-v2`** : Kimi retiré per ADR-011 → libérer le lock dans `agent-file-locks.md` avant de toucher `cockpit-chat/route.ts`.

---

*Établi le 2026-07-02. Série Recovery 9 batches — exécution séquentielle manuelle.*
