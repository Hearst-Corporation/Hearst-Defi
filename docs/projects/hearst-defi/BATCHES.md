# BATCHES.md — Recovery Series: Execution Log + Work Batch Plan

> Deux niveaux de numérotation coexistent dans cette série — ne pas les confondre :
> - **Loop-slots de la série** (métadonnées `batchNumber: N/9`, cadence Nexus) : 1=Intake, 2=Auditor
>   (Truth Audit), 3=Planner (**ce document**), 4+=Coder/Reviewer selon dispatch.
> - **Work Batches** (contenu métier, hérités de `PROJECT_PLAN.md` §"Batches Planifiés") : Batch 1
>   Intake → Batch 9 Lancement. C'est la table ci-dessous ("Work Batch Plan") qui fait autorité sur
>   le contenu ; elle **supersède** la liste de `PROJECT_PLAN.md` (corrections de chemins de fichiers
>   + intégration des findings Truth Audit T-01→T-12 ci-dessous).

---

## Series Execution Log (loop-slots)

| Loop | Role | Statut | PR | Mergé |
|---|---|---|---|---|
| 1 | Intake — inventaire état réel | ✅ MERGÉ | PR #361 | Oui — `5d933f8b` |
| 2 | Auditor — Truth Audit (données mockées, hardcodes, actions non branchées) | ✅ MERGÉ | PR #363 | Oui — `4d236c8d` |
| 3 | Planner — ce document (Work Batch Plan) | ✅ FAIT (2026-07-03) | — | Non (à créer) |
| 4+ | Coder/Reviewer — Work Batch 3 (Corrections P0) | ⏳ En attente | — | — |

*Dépendance vérifiée : `truth.audit` (loop 2) mergé sur `main` (commit `4d236c8d`, PR #363) — condition satisfaite pour démarrer ce loop 3 (planner).*

---

## ⚠️ Gate bloquant avant tout code (Work Batch 2 jamais exécuté)

`PROJECT_PLAN.md` prévoyait un **Work Batch 2 — Baseline Verification** (`pnpm db:generate && pnpm typecheck && pnpm test && forge test`) avant tout code. Ce batch a été **court-circuité** : le loop 2 de la série a été redirigé vers le Truth Audit (read-only) à la place. Résultat : `PROJECT_STATE.md §2` liste `typecheck`/`test`/`build` comme **INCONNU** — dernière vérité verte = 2026-05-29, avant ~10 PRs strategies mergées fin juin.

**Conséquence pour ce plan** : le premier loop de code (Work Batch 3 ci-dessous) DOIT commencer par la baseline verification avant de toucher quoi que ce soit. Ajouté comme étape 0 du Work Batch 3.

---

## Work Batch Plan (contenu, owner-zones disjointes)

Owner-zones vérifiées disjointes entre batches (aucun chevauchement de fichiers entre deux batches
adjacents actifs simultanément — l'exécution reste strictement séquentielle par contrat de série,
donc un chevauchement inter-batch non-adjacent, ex. Batch 3 / Batch 6 sur `confirmed/page.tsx`,
est acceptable et signalé ci-dessous).

### Work Batch 3 — Corrections P0 restantes
**Statut** : ⏳ Prochain à exécuter · **Estimé** : 3-4h (+ baseline verification)
**Dépend de** : loop 2 (Truth Audit, mergé) — ✅ satisfait

**Étape 0 (bloquante, avant tout code)** — Baseline Verification (Work Batch 2, rattrapage) :
- `pnpm db:generate && pnpm typecheck && pnpm test`
- Si régressions trouvées (post-strategies) : documenter dans `PROJECT_STATE.md §2`, patch minimal seulement si bloquant pour la suite.

**Scope code** (C-items + T-items Truth Audit) :
| Item | Fichier réel (vérifié 2026-07-03) | Action |
|---|---|---|
| C-05 / T-01 | `src/lib/portfolio/tax.ts:194-201` (données) + `src/app/(product)/portfolio/tax/page.tsx` (route complète, PAS de composant `tax-docs-drawer.tsx` — **ce chemin cité dans PROJECT_PLAN.md est stale/inexistant**) | La route `/portfolio/tax` calcule et affiche des chiffres inventés sans gate. Retrouver le point d'entrée nav (aucun lien trouvé par grep statique — chercher côté nav config runtime) et le désactiver + tooltip "Available 2027 Q1", OU gater la route elle-même (redirect / empty-state honnête). Ne pas toucher `tax.ts` (mock reste, on coupe l'accès). |
| C-11 / T-04 | `src/lib/auth/session.ts:154` (`sameSite: "lax"` confirmé) — ligne 200 est un cookie différent, déjà `"strict"`, ne pas toucher | `"lax"` → `"strict"` sur le cookie de session principal. **Tester le flow Privy popup (OAuth cross-site) avant commit** — risque de casser le retour de popup. |
| C-13 / T-03 | `src/components/vaults/term-sheet-preview.tsx` (grep confirmé : aucune occurrence "Model B" / "cash reserve") | Ajouter le one-liner. Texte **exact déjà verrouillé par test** (`src/components/vaults/__tests__/term-sheet-truth.test.tsx:60-64`) : `"Principal held in a USDC cash reserve — not deployed on-chain; yield is a monthly mining-revenue-share distribution."` — **contrainte de placement** : NE PAS le mettre au-dessus de la grille d'allocation (le test l'interdit explicitement). Mettre ce test à jour pour affirmer la présence (positive) au bon endroit une fois câblé. |
| T-02 | `src/app/(product)/vaults/[id]/invest/confirmed/page.tsx:298` | **Décision Adrien requise avant commit** : retirer la phrase "A receipt and the Methodology v1.0 PDF will be emailed…" OU implémenter l'envoi réel (Resend). Aucune fonction d'envoi n'existe pour ce flow (seuls welcome-email et password-reset existent). |

**Owner-zone** : `src/app/(product)/portfolio/tax/`, `src/app/(product)/vaults/[id]/invest/confirmed/`, `src/components/vaults/term-sheet-preview.tsx` + son test, `src/lib/auth/session.ts` (ligne 154 uniquement)
**Blocage décision Adrien** : T-02 (retirer phrase vs implémenter email) — **à trancher avant de commit ce fichier**, le reste du scope peut avancer sans lui.
**Validations** : `pnpm typecheck` + `pnpm test` (inclut `term-sheet-truth.test.tsx` à mettre à jour) + test manuel flow Privy popup.

---

### Work Batch 4 — Corrections P1 (sécurité + guards)
**Statut** : ⏳ En attente · **Estimé** : 2-3h (réduit — C-09 déjà clos)
**Dépend de** : Work Batch 3

**Scope révisé** (C-09 retiré — confirmé FAIT par Truth Audit, ne pas re-toucher) :
| Item | Fichier réel | Action |
|---|---|---|
| C-14 | `.github/workflows/ci.yml:137` (job `playwright`, confirmé `continue-on-error: true`) | Passer à `false` **seulement si** la suite Playwright est verte en local d'abord. ⚠️ Ne pas confondre avec la ligne 212 (`continue-on-error: true` du job `foundry`) — celle-ci reste advisory par design (ADR-006, contrats gelés), hors scope. |
| T-11 | `src/components/scenario/nav-sparkline.tsx:128-129` | Reformuler labels visuels "Low band / Midpoint / High band" + légende "p5–p95" pour ne plus évoquer Monte Carlo (aria-desc déjà honnête, seul le visuel est ambigu). |

**Owner-zone** : `.github/workflows/ci.yml` (job `playwright` uniquement), `src/components/scenario/nav-sparkline.tsx`
**Note** : owner-zone ne touche plus `src/app/admin/` ni `src/lib/auth/` (C-09 retiré du scope).
**Validations** : `pnpm typecheck` + `pnpm test` + E2E Playwright local (bloquant avant de flipper le gate CI).

---

### Work Batch 5 — dev.db Alignment (bloquant schéma)
**Statut** : ⏳ En attente décision Adrien · **Estimé** : 1-2h
**Dépend de** : Work Batch 4

**Scope** : réaligner `dev.db` (contraintes uniques manquantes : `Distribution[period,vaultRef]`, `InvestorTransaction[txHash]`, `Position[txHashOpen]`, index `UserAgentProfile`/`VaultDraft`).
**Décision Adrien requise (Q3 dans `DECISIONS.md`)** : `db push --accept-data-loss` (efface données locales dev, acceptable ?) vs `CREATE INDEX` chirurgical additif si aucun doublon détecté.
**Owner-zone** : `prisma/` — pas de modification `schema.prisma` sauf index additifs.
**Validations** : `pnpm db:generate` + `pnpm typecheck`.

---

### Work Batch 6 — Décisions Produit Lot 4 BACKLOG (pas de code)
**Statut** : ⏳ En attente · **Estimé** : lecture seule
**Dépend de** : Work Batch 5

**Objectif** : soumettre à Adrien les items nécessitant décision AVANT code. **Pas de code.**
1. Engine backtest rules-vs-no-rules (BACKLOG #8) — touche Methodology v1.0 immuable, bump requis si changement.
2. Share Class B sélecteur invest (BACKLOG #9).
3. Advanced metrics LP (BACKLOG #10) — `RiskMetricsPanel` référencé mais n'existe pas.
4. Vaults confirmed page hardcodé (BACKLOG #11) — lire les données depuis le vault réel. **⚠️ Conflit de fichier avec Work Batch 3 (T-02)** : même fichier `vaults/[id]/invest/confirmed/page.tsx`. Aucun risque d'exécution parallèle (série strictement séquentielle) mais **ce batch doit démarrer après que Work Batch 3 ait résolu/commit T-02** — sinon le diff hardcodé rentre en conflit avec le retrait/l'ajout de la phrase email.
5. Action-queue restants (BACKLOG #12 / T-09, `src/lib/data/cockpit.ts:405-406`) : `lp.redemption` (modèle `Redemption` absent du schéma) + `memo.publish` (pas de champ publish-state sur `InvestorMemo`).

**Owner-zone** : aucune (production de questions structurées dans `DECISIONS.md` uniquement).

---

### Work Batch 7 — Lot 5 BACKLOG : Features Non Câblées (si feu vert Adrien)
**Statut** : ⏳ Différé · **Dépend de** : décision Adrien post-Work Batch 6

**Features** (ordre de valeur décroissant) : Global search ⌘/ (`GlobalSearch` + `/api/search`, non montés), Notifications bell feed, ⌘K command palette, Keyboard shortcuts cheatsheet, Batch actions multi-select, Saved views 8 templates.
**Ajout Truth Audit** : T-12 — export PDF/CSV "coming soon" dans `src/app/admin/projection/studio.tsx:709` (bouton visible, non fonctionnel) — scope à définir avec Adrien, même batch (feature gap admin, cohérent avec le reste du lot).
**Précondition** : feu vert explicite Adrien. Sans accord → NE PAS câbler.
**Owner-zone** (si feu vert) : `src/lib/power/`, composants nav/search associés, `src/app/api/search/`, `src/app/admin/projection/studio.tsx`.

---

### Work Batch 8 — Notification Matrix + Bell (Lot 6 BACKLOG)
**Statut** : ⏳ Différé · **Dépend de** : Work Batch 7 (bell feed doit être montée d'abord)

**Scope** : câbler `src/lib/notifications/router.ts` (`NOTIFICATION_MATRIX`/`resolveChannels`/`renderTemplate` — 0 consommateur Inngest actuellement, confirmé) → fonctions Inngest par event gouvernance → email (Resend) + in_app (`Notification.create`) + telegram (sender à construire).
**T-08** (`src/components/notifications/notifications-bell-wrapper.tsx:15`, `unreadCount={0}` hardcodé, drawer placeholder) : câbler la lecture réelle de la table `Notification`.
**Owner-zone** : `src/lib/notifications/`, `src/components/notifications/`, fonctions Inngest gouvernance.

---

### Work Batch 9 — Lancement / Intégrations Tierces (décisions D1-D7)
**Statut** : ⏳ Différé · **Surtout opérationnel, peu de code applicatif**

**Checklist** :
- D1 : Signataires Safe 3/5 + guardian 2/3 → déployer Timelock + Safe (runbook `docs/execution/agent-a-safe-governance.md`). Résout **T-06** (`src/lib/governance/actions.ts:268,331` — actions gouvernance mock only, pas d'appel Solidity).
- D2 : Engager Maples (counsel Cayman).
- D4 : Signer Spearbit (audit). Précondition du gel mainnet (non-négociable #8).
- D5 : Périmètre juridictionnel pilotes (exclure US persons sauf Reg D).
- D7 : Décision distribution V1 (transfer USDC réel treasury→vault). Résout **T-05** (`src/lib/distribution/atomic-exec.ts:132` — tx hashes `0xMOCK_` sur toutes les distributions).
- **T-07** (`src/lib/attestation/mock.ts` — clé Anvil test, `BASE_AUM_USD` hardcodé) : engagement vendor attestation mining (lié à RP-5, décision opérationnelle hors périmètre code).
- **T-10** (`src/app/admin/outreach/actions.ts` — sourcing Apollo mock sans clé) : configurer `APOLLO_API_KEY` en prod (RP-8).
- Redéployer vault testnet (constructeur 6 args — guardian ; instance actuelle prédate le guardian).
- Renseigner `abi-freeze.json` + `contracts/README.md` avec adresses.

---

## Traçabilité Truth Audit → Work Batch (couverture complète T-01→T-12)

| Finding | Sévérité | Work Batch |
|---|---|---|
| T-01 (tax fake data) | CRITICAL | 3 |
| T-02 (email reçu non envoyé) | CRITICAL | 3 (décision Adrien) |
| T-03 (Model B absent) | CRITICAL | 3 |
| T-04 (cookie sameSite) | HIGH | 3 |
| T-05 (distribution 0xMOCK) | HIGH | 9 (D7) |
| T-06 (gouvernance sans Solidity) | HIGH | 9 (D1) |
| T-07 (attestation mock) | HIGH | 9 |
| T-08 (bell hardcodée) | MEDIUM | 8 |
| T-09 (lp.redemption/memo.publish) | MEDIUM | 6 (décision) |
| T-10 (Apollo mock) | MEDIUM | 9 |
| T-11 (NavSparkline label) | LOW | 4 |
| T-12 (export PDF/CSV) | LOW | 7 |

Tous les findings T-01→T-12 sont couverts par un Work Batch. Aucun finding orphelin.

---

*Mis à jour : 2026-07-03 (loop 3 — Planner).*
