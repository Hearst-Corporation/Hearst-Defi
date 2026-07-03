# DECISIONS.md — Hearst DeFi Recovery Series

> Log des décisions prises AU COURS de la Recovery Series (≠ ADRs du projet).
> Chaque décision est une bifurcation non triviale nécessitant l'accord d'Adrien.

---

## Rapport d'audit vérité — Batch 2 (Truth Audit, 2026-07-03)

> Audit read-only. Aucun code modifié. Chaque finding documente une donnée mockée,
> une action non branchée, un compteur factice, ou un hardcode visible par les LPs.
> Sévérité : **CRITICAL** = visible LP, **HIGH** = admin/onchain-gap, **MEDIUM** = gated/interne, **LOW** = cosmétique.

---

### T-01 — Tax preview fake data [CRITICAL — LP visible]
**Fichier** : `src/lib/portfolio/tax.ts:194-201`
**Code** :
```ts
const userSeed = userId.length + (userId.charCodeAt(0) ?? 65);
const interestIncomeUsd = overrides.actualInterestIncomeUsd ?? round2(12_000 + userSeed * 100);
const principalUsd = overrides.actualPrincipalUsd ?? 250_000 + userSeed * 1_000;
```
**Impact** : L'onglet "Tax" du portfolio LP affiche des chiffres inventés déterministes (`$12 000 + seed * 100`) déguisés en preview de formulaire fiscal. Aucun mécanisme UI ne désactive clairement cette surface (C-05 sprint correctness — toujours ouvert).
**Action requise** : Désactiver le trigger "Tax Docs Preview" dans `tax-docs-drawer.tsx:243-259` + tooltip "Available 2027 Q1". Voir batch 3.

---

### T-02 — Confirmed page : fausse promesse d'email [CRITICAL — LP visible]
**Fichier** : `src/app/(product)/vaults/[id]/invest/confirmed/page.tsx:298`
**Texte** : "A receipt and the Methodology v1.0 PDF will be emailed to your registered address."
**Réalité** : Aucune fonction d'envoi d'email de reçu n'est câblée dans le flow `subscribe.ts` ou la page `confirmed`. Seuls les emails de reset password et de bienvenue existent (`send-welcome-email.ts`, `password-reset.ts`). Aucun email n'est envoyé après un dépôt.
**Impact** : Les LPs s'attendent à recevoir un reçu et un PDF Methodology → ils ne le reçoivent pas → friction à l'onboarding.
**Action requise (décision Adrien)** : (a) Retirer la phrase en attendant l'implémentation, ou (b) implémenter l'email de reçu post-souscription via Resend. Pas de code avant accord.

---

### T-03 — Model B one-liner absent de la fiche LP vault [CRITICAL — LP visible]
**Fichier** : `src/app/(product)/vaults/[id]/page.tsx` (et composant term-sheet)
**Statut** : C-13 sprint correctness — **CONFIRMÉ MANQUANT**. Grep exhaustif sur l'arborescence LP — aucune occurrence de "principal held in a USDC cash reserve", "Model B", ou équivalent sur la surface detail vault LP.
**Impact** : Non-négociable produit #3 (Model B obligatoire) + risque de comm "mining-backed" sans disclosure. RP-3 ouvert.
**Action requise** : Ajouter la phrase dans le composant term-sheet LP (batch 3).

---

### T-04 — Cookie sameSite "lax" non corrigé [HIGH — sécurité session]
**Fichier** : `src/lib/auth/session.ts:154`
**Code** : `sameSite: "lax"`
**Statut** : C-11 sprint correctness — **CONFIRMÉ OUVERT**. La cookie de session principale reste en `"lax"`. Cookie secondaire à la ligne 200 est `"strict"` (cookie différent).
**Risque** : CSRF sur actions POST si le navigateur autorise les requêtes cross-site avec cookies `lax`. Tester la compatibilité Privy popup (cross-site OAuth) avant de passer à `"strict"`.
**Action requise** : Batch 3 — tester Privy popup + passer à `"strict"` si survit.

---

### T-05 — Distribution tx hashes tous `0xMOCK_` [HIGH — admin visible]
**Fichier** : `src/lib/distribution/atomic-exec.ts:132`
**Code** : `` const txHash = `0xMOCK_${distributionId}`; ``
**Réalité** : Toutes les distributions historiques portent des tx hashes inventés. L'admin dashboard les affiche avec badge "estimated" et libellé "simulated". Pas de transfert USDC réel (RP-1 ouvert, décision D7 en attente).
**Action requise** : Décision D7 (policy distribution V1 — transfer USDC réel) + déploiement. Batch 9.

---

### T-06 — Governance actions : aucun appel Solidity [HIGH — admin visible]
**Fichiers** : `src/lib/governance/actions.ts:268,331`, `src/app/admin/governance/proposal/[id]/page.tsx:333`
**Code** :
```ts
// Marks an EXECUTABLE proposal as EXECUTED (mock — no on-chain call).
// Actions are recorded on-chain mock only — no Solidity calls at this stage.
```
**Réalité** : Les boutons Approve/Reject/Execute du flow gouvernance écrivent en DB uniquement. QUEUED → TIMELOCK est auto-avancé immédiatement (pas de vrai Timelock 48h). Safe/Timelock non déployés (D1 en attente).
**Action requise** : Décision D1 (signataires Safe 3/5) + déploiement Safe/Timelock. Batch 9.

---

### T-07 — Attestations mining sont mock (clé Anvil test) [HIGH — Proof Center]
**Fichier** : `src/lib/attestation/mock.ts:7-12`
**Code** : `MOCK_ATTESTOR_PRIVATE_KEY` (clé dérivée de la clé test Anvil). `BASE_AUM_USD = 42_500_000` hardcodé. Revenue et hashrate calculés par oscillation sinus déterministe.
**Réalité** : Aucune vraie clé HSM farm partenaire. Aucun data feed minier réel. `publish.ts` fait un no-op si `HEARST_PUBLISHER_PRIVATE_KEY` ou `POR_REGISTRY_ADDRESS` non set.
**Impact** : Le Proof Center affiche des attestations signées par une clé de test. Badge "Attested" trompeur sans disclosure claire. RP-5 ouvert.
**Action requise** : Engagement vendor attestation (RP-5). Batch 9 / décision opérationnelle.

---

### T-08 — Notifications bell : compteur hardcodé 0 + drawer placeholder [MEDIUM — admin]
**Fichier** : `src/components/notifications/notifications-bell-wrapper.tsx:15`
**Code** : `<NotificationsBell unreadCount={0} />`
**Réalité** : `unreadCount` toujours 0 (hardcodé). Le drawer affiche "No notifications yet." sans lire la table `Notification` DB. `NOTIFICATION_MATRIX` et `resolveChannels` dans `router.ts` ont 0 consommateurs Inngest.
**Impact** : Admin — feature bell montée mais non fonctionnelle. Trompeur pour l'admin qui s'attend à des alertes.
**Action requise** : Batch 8 (Notification Matrix câblage), après feu vert Adrien.

---

### T-09 — Action queue `lp.redemption` et `memo.publish` : modèles absents [MEDIUM — admin]
**Fichier** : `src/lib/data/cockpit.ts:405-406`
**Code** :
```ts
// ── TODO: lp.redemption — no Redemption model exists yet (out of scope) ──
// ── TODO: memo.publish  — no clear "ready to publish" data source yet    ──
```
**Réalité** : Ces types d'action apparaissent dans le type union et dans l'UI `action-queue.tsx` mais ne produisent aucune donnée (0 rows). Pas de modèle `Redemption` dans schema.prisma. Pas de champ `publishState` sur `InvestorMemo`.
**Action requise** : Décision Adrien (batch 6) sur scope et timing.

---

### T-10 — Apollo prospect sourcing : mock sans clé [MEDIUM — admin outreach]
**Fichier** : `src/app/admin/outreach/actions.ts`
**Réalité** : En dev, sourcing utilise des données ICP fakées (pas de crédit Apollo dépensé). En prod, refus avec exception si `APOLLO_API_KEY` absent. Env var `APOLLO_API_KEY` listé dans RP-8 comme manquant.
**Impact** : L'admin outreach affiche des prospects simulés. Pas de vraie donnée Apollo.
**Action requise** : Configurer `APOLLO_API_KEY` en prod (RP-8, batch 9).

---

### T-11 — NavSparkline labels p5/p50/p95 : potentiellement trompeurs [LOW — LP]
**Fichier** : `src/components/scenario/nav-sparkline.tsx:128-129`
**Aria desc** : "Bands are derived from the APY range, not from a Monte Carlo simulation."
**Réalité** : L'aria description est honnête mais les labels visuels "Low band / Midpoint / High band" et la légende "p5–p95" sans contexte peuvent implicitement évoquer un Monte Carlo. BACKLOG Lot 1 #2 — à reformuler.
**Action requise** : Batch 4 (reformuler le label pour éviter l'ambiguïté MC).

---

### T-12 — Export PDF/CSV "coming soon" [LOW — admin]
**Fichier** : `src/app/admin/projection/studio.tsx:709`
**Code** : `onClick={() => toast.info("Export to PDF/CSV coming soon")}`
**Impact** : Bouton d'export visible mais non fonctionnel dans le studio de projection admin.
**Action requise** : Feature scope à définir (batch 7 / décision Adrien).

---

## Mises à jour du statut sprint correctness (post-audit vérité)

| C-Item | Ancien statut | Statut vérifié (2026-07-03) |
|---|---|---|
| C-03 share class widgets | ⚠️ À vérifier | ✅ CONFIRMÉ FAIT — `loadDistribCalendarProps()` lit `terms.shareClass` depuis DB |
| C-05 tax preview fake data | ❌ NON FAIT | ❌ CONFIRMÉ OUVERT — `tax.ts:194-201` toujours actif |
| C-08 attestAccreditation | ⚠️ À vérifier | ✅ CONFIRMÉ FAIT — action câblée dans `accreditation-attestations.tsx:68` |
| C-09 MFA TOTP admin | ⚠️ À vérifier | ✅ CONFIRMÉ FAIT — flow 3 étapes complet (QR, `otpauth`, `startEnrolment`/`confirmEnrolment`) |
| C-11 sameSite lax→strict | ❌ NON FAIT | ❌ CONFIRMÉ OUVERT — `session.ts:154` encore "lax" |
| C-12 reset password Resend | ⚠️ À vérifier | ✅ CONFIRMÉ FAIT — `password-reset.ts` complet avec anti-enumeration |
| C-13 Model B one-liner LP | ⚠️ À vérifier | ❌ CONFIRMÉ MANQUANT — absent de `vaults/[id]/page.tsx` et composants |
| NavSparkline label | ⚠️ À vérifier | ⚠️ PARTIEL — aria honnête, labels visuels ambigus |

---

## Questions en attente pour Adrien (enrichies post-audit)

Les items suivants doivent être tranchés par Adrien avant le batch correspondant :

### Batch 3 (P0 corrections)
1. **T-02 — Email de reçu** : retirer la phrase "A receipt and the Methodology v1.0 PDF will be emailed" OU implémenter l'email via Resend avant merge ?
2. **C-11 — Cookie `sameSite: strict`** : confirmer que le flow Privy popup (cross-site OAuth) survit avant merge.

### Batch 5
3. **dev.db alignment** : `db push --accept-data-loss` (efface les données locales dev) OU solution chirurgicale (`CREATE INDEX` seulement si pas de doublons) ?

### Batch 6
4. **Engine backtest rules-vs-no-rules** : définir la baseline "sans règles" → nécessite bump Methodology v1.0 → v2.x ?
5. **Share Class B sélecteur invest** : feu vert pour ajouter le sélecteur dans le flux invest ?
6. **Features Lot 5 non câblées** : câbler maintenant (global search, notifications, ⌘K, etc.) ou continuer à différer ?
7. **Playwright bloquant (C-14)** : activer `continue-on-error: false` seulement quand la suite E2E est verte — confirmer qu'on veut la fixer maintenant ?

### Batch 8
8. **Notifications bell** : câbler le feed avec la table DB `Notification` et `NOTIFICATION_MATRIX` maintenant (après batch 7 bell montée), ou rester au placeholder ?

---

## Décisions prises

_(vide — batch 1 et 2 sont lecture seule)_

---

## Corrections de chemins — Loop 3 (Planner, 2026-07-03)

En préparant `BATCHES.md`, vérification read-only de chaque chemin de fichier cité ci-dessus
(spot-check, pas un re-audit complet). Deux corrections matérielles trouvées :

- **T-01 / C-05** : le chemin `src/components/portfolio/tax-docs-drawer.tsx:243-259` cité dans
  `PROJECT_PLAN.md` (Batch 3) **n'existe pas** dans le dépôt (recherche `find`/`grep` exhaustive,
  aucun résultat). Le flow réel est une route complète `src/app/(product)/portfolio/tax/page.tsx`
  qui appelle `getTaxPreview()` (`src/lib/portfolio/tax.ts`) sans gate — pas de pattern "drawer +
  trigger". Aucun lien nav vers `/portfolio/tax` trouvé par grep statique (probablement construit
  dynamiquement) — l'exécutant Work Batch 3 devra localiser le point d'entrée nav réel avant de
  désactiver l'accès.
- **T-03 / C-13** : confirmé absent (`term-sheet-preview.tsx` — 0 occurrence "Model B"/"cash
  reserve"), mais le texte exact et une contrainte de placement sont déjà verrouillés par
  `src/components/vaults/__tests__/term-sheet-truth.test.tsx:60-64` : le one-liner ne doit **pas**
  être placé au-dessus de la grille d'allocation. Ce test devra être inversé (assertion positive,
  bon emplacement) une fois le one-liner câblé — sinon Work Batch 3 casse la suite.

Détail complet et owner-zones à jour : `BATCHES.md` (Work Batch 3).

---

*Mis à jour : 2026-07-03 (loop 3 — Planner).*
