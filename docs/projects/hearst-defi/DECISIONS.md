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

## Rapport batch "Data Truth" (anti-mock guard, 2026-07-03)

> Batch builder ciblé couche données/API (owner zone: sources réelles, gardes
> anti-mock). Fichiers interdits pour ce batch : UI pages, `prisma/**`
> (migrations), `.github/workflows/**`, secrets, `vercel.json`. Aucune mutation
> de données prod. Objectif : reprendre les findings T-01→T-12 du Truth Audit
> et, pour ceux qui relèvent de la couche données (pas juste UI/business
> decision), remplacer le mock non signalé par une source réelle ou un état
> honnête.

### Revue des findings T-01 à T-12 — ce qui est réellement dans cette owner zone

| ID | Verdict de ce batch | Action |
|---|---|---|
| **T-01** (tax preview fake data) | **Corrigé partiellement — surface live déjà réelle, gap de provenance comblé** | Voir détail ci-dessous |
| T-02 (promesse email reçu) | Hors zone — décision produit + UI page (`confirmed/page.tsx`) | Aucune action (reste batch 3 / décision Adrien) |
| T-03 (Model B one-liner) | Hors zone — UI page (`vaults/[id]/page.tsx`) interdite à ce batch | Aucune action (reste batch 3) |
| T-04 (cookie sameSite) | Hors zone — auth, pas données/API mock | Aucune action (reste batch 3) |
| **T-05** (distribution `0xMOCK_`) | **Déjà honnêtement signalé** — vérifié : `admin/distributions/page.tsx:173-191` affiche déjà un badge `estimated` + libellé "simulated" pour tout `txHash` préfixé `0xMOCK`. Pas un mock non signalé. | Aucune action de code — reste gated sur D7 (batch 9) |
| **T-06** (governance sans appel Solidity) | **Déjà honnêtement signalé** — vérifié : `admin/governance/proposal/[id]/page.tsx:334` affiche déjà "Actions are recorded on-chain mock only — no Solidity calls at this stage." | Aucune action de code — reste gated sur D1 (batch 9) |
| **T-07** (attestation mock key) | **Confiné et déjà guardé** — `buildMockAttestation`/`signMockAttestation` (`attestation/mock.ts`) ne sont appelés que par `prisma/seed.ts` et les tests, jamais par un chemin runtime app. La vérification (`stored.ts::isAttestorAllowlisted`) fail-closed en production (allowlist vide → badge "Attested" jamais accordé) et le bypass dev (`ATTESTATION_DEV_ACCEPT_ANY`) est désactivé en production. | Aucune action de code nécessaire |
| T-08 (bell notifications) | Hors zone — composant UI + décision batch 8 | Aucune action |
| T-09 (lp.redemption / memo.publish) | Hors zone — nécessite modèle Prisma (migration interdite à ce batch) | Aucune action |
| **T-10** (Apollo sourcing mock) | **Déjà guardé** — vérifié : `admin/outreach/actions.ts:894-898` refuse `runSourcing` en production sans `APOLLO_API_KEY` ("refusing to source mock leads"). | Aucune action de code nécessaire |
| T-11 (NavSparkline label) | Hors zone — cosmétique UI, batch 4 | Aucune action |
| T-12 (Export coming soon) | Hors zone — feature scope, batch 7 | Aucune action |

### T-01 — détail de la correction (couche données, pas UI)

Le composant original cité par le sprint correctness et le Truth Audit —
`src/components/portfolio/tax-docs-drawer.tsx:243-259` — **n'existe plus** :
il a été supprimé lors du refactor "unify dashboard into MergedSurface premium
panels" (commit `79c9b2c2`), remplacé par une page dédiée
`src/app/(product)/portfolio/tax/page.tsx`. Cette page **appelle déjà**
`loadPortfolio()` et passe les trois montants réels (`totalYieldYtdUsdc`,
`deployedUsdc`, `accruedYieldUsdc`) en overrides à `getTaxPreview()` — le
chemin qui fabrique les chiffres factices (`12_000 + userSeed*100`,
`250_000 + userSeed*1_000`) n'est donc **plus jamais emprunté par la seule
surface LP-facing existante**.

Le vrai gap restant (raison pour laquelle T-01 n'était pas entièrement clos) :
`getTaxPreview()` ne retournait **aucun signal de provenance** — un futur
appelant qui oublierait de passer les overrides obtiendrait silencieusement
les mêmes chiffres fabriqués, indiscernables de données réelles côté type
system. Corrigé :

- `TaxPreview` porte désormais un champ `dataSource: "live" | "stub"`
  (`src/lib/portfolio/tax.ts`) — `"live"` uniquement si les trois overrides
  réels (`actualInterestIncomeUsd`, `actualPrincipalUsd`,
  `actualAccruedYieldUsd`) sont explicitement fournis (y compris à `0` pour un
  nouvel investisseur), `"stub"` sinon.
- Guard de régression ajouté dans `src/lib/__tests__/data-honesty-guards.test.ts`
  (POINT 6, même convention que POINT 1-5 : lecture statique du code source,
  pas de DB) — vérifie que `portfolio/tax/page.tsx` et
  `tax-preview-loader.ts` continuent bien de fournir les trois overrides
  réels.
- Tests ajoutés dans `src/lib/portfolio/__tests__/tax.test.ts` (bloc 19,
  5 cas) + assertion `dataSource: "live"` ajoutée dans
  `tax-preview-loader.test.ts`.
- **Aucun changement de comportement** pour les appelants existants (tous
  passent déjà les 3 overrides → `dataSource: "live"` dans les deux cas) —
  changement additif, tests existants inchangés.

**Impact sur C-05 / batch 3** : le scope original de C-05 ("désactiver le
trigger Tax Docs Preview + tooltip 2027 Q1") référence un fichier disparu.
Batch 3 doit vérifier s'il reste un besoin produit sur la page `tax/page.tsx`
actuelle (ex: mention du `docStatus: "preview"` déjà présente dans le footer
"Preview only — final tax documents are issued annually"), mais **le risque
CRITICAL "chiffres inventés présentés comme réels" documenté par T-01 est
neutralisé** sur la seule surface LP existante, avec un guard de régression en
place.

---

## Rapport batch "Data Truth" — nouvelle invocation, fix réel (2026-07-04)

> Contrairement aux ~5 passes précédentes sur ce même batch (toutes no-op —
> voir `HANDOFF.md`), cette session a trouvé et corrigé un **nouveau finding**
> réel dans l'owner zone données/API, en élargissant le balayage à
> `src/lib/inngest/functions/*` (crons de market data / mining health), pas
> explicitement couvert par les balayages précédents (qui s'étaient concentrés
> sur `portfolio/`, `data/`, `agents/`, `onchain/`, `governance/`,
> `distribution/`, `notifications/`, `product-strategies/`).

### T-13 — Mining fleet uptime badgé "attested" alors que c'est un placeholder codé en dur [HIGH — data/API, alimente l'agent Mining Health + le chat]

**Fichiers** :
- `src/lib/inngest/functions/market-data-hourly.ts:117-118` — écrit `uptimePct: 98.5` et
  `deployedHashrate: 182_000` en dur sur CHAQUE ligne `MiningMetric` créée par le cron horaire,
  avec un commentaire explicite `// placeholder until real uptime feed`.
- `src/lib/agents/loaders/mining.ts:122-136` (`loadLatestMiningMetrics`) — calculait un SEUL tag
  de provenance (`rowTag`, `"attested"` ou `"stale"` selon la fraîcheur de la ligne) et l'appliquait
  aux 4 métriques (`hashprice_usd_per_th`, `difficulty_change_pct`, `margin_pct`, `uptime_pct`) —
  y compris `uptime_pct`, qui n'est **jamais** mesuré.

**Impact** : le non-négociable #2 (CLAUDE.md — "every metric has a provenance badge") exige que
`attested` signifie "measured row + verified mining_attestation Proof" (vocabulaire exact de
`src/lib/agents/schemas.ts`). Une constante codée en dur (`98.5`) n'est par construction jamais
mesurée — la badger `attested` (ou `stale` selon la fraîcheur, ce qui est encore pire : ça implique
qu'une vraie mesure a vieilli) est un badge de provenance mensonger. Ce champ alimente :
- l'agent Mining Health (narrative LP via `runMiningHealth` — cron quotidien 08:00 UTC), qui
  n'aurait jamais reçu l'instruction de "FLAG IN-LINE" ce chiffre puisque `attested` n'est pas un
  tag dégradé (`isDegradedProvenance`) ;
- potentiellement le chat cockpit via `read_market_snapshot`
  (`src/lib/llm/tools/registry.ts:1061`, fichier sensible single-owner — non modifié, hors scope
  prudence de ce batch) qui expose `uptime_pct` sans annotation de provenance dans le texte du
  tool.

**Ce qui était déjà honnête (pas un bug)** : `hashprice`, `difficulty_change_pct` (dérivé de
hashprice réel via mempool.space) et `margin_pct` (calculé par l'engine pur à partir de hashprice/
BTC price réels) restent correctement `attested`/`stale` selon la fraîcheur — ce sont de vraies
valeurs mesurées/dérivées. Seul `uptime_pct` était mal badgé. `src/lib/agents/loaders/coverage.ts`
(P1 distribution coverage) consomme aussi `uptimePct`/`deployedHashrate`, mais son provenance
global était déjà plafonné à `Estimated` (jamais `Live`) car `anyManual` est toujours vrai en P1 —
pas de fix nécessaire là.

**Correction appliquée (couche données uniquement, aucune UI, aucun Prisma)** :
- `src/lib/agents/loaders/mining.ts` — `uptime_pct` est désormais toujours tagué `"estimated"`
  (jamais `rowTag`), peu importe la fraîcheur de la ligne. `estimated` est un tag dégradé
  (`isDegradedProvenance`), donc l'agent Mining Health reçoit maintenant l'instruction
  "FLAG IN-LINE, do not present as attested" pour ce chiffre — comportement déjà cablé dans
  `mining-health.ts`, seul l'input était faux.
- Guard de régression ajouté : `src/lib/__tests__/data-honesty-guards.test.ts` POINT 7 (même
  convention lecture statique que POINT 1-6) — vérifie que `uptime_pct` reste `"estimated"` et que
  les 3 autres métriques restent sur `rowTag`.

**Non touché (délibérément, prudence sur fichier sensible)** : `src/lib/llm/tools/registry.ts`
est listé "sensitive single-owner" dans CLAUDE.md — le texte brut `uptime_pct: 98.5` exposé au
modèle par `read_market_snapshot` n'a pas été annoté ; à considérer par l'owner de ce fichier si
jugé nécessaire (le vrai gap de provenance côté agent structuré JSON, lui, est corrigé).

**Validations** : `pnpm typecheck` → 0 erreur. `pnpm test` → 448/448 fichiers, 5354/5354 tests
(5352 baseline + 2 nouveaux POINT 7). Suite ciblée (`mining-ops-fallback`, `mining-health-daily`,
`data-honesty-guards`, `provenance`, `agent-parsers`) → 72/72 tests, verte.

---

## Rapport batch "Data Truth" — nouvelle invocation, 2e fix réel (2026-07-04)

> Après ~6 passes précédentes sur ce même batch (5 no-op + le fix T-13), cette session a
> trouvé un **second finding réel**, distinct de T-13 bien que même cause racine, en
> poursuivant l'investigation du même fichier (`src/lib/agents/loaders/mining.ts`) vers un
> **autre consommateur** de `MiningOpsSnapshot` que celui déjà couvert par T-13
> (`loadLatestMiningMetrics`, agent Mining Health narrative).

### T-14 — Investor Memo PDF badge "attested" le hashrate/uptime miniers alors qu'ils restent des placeholders codés en dur [CRITICAL — LP visible, document PDF envoyé aux LPs]

**Fichiers** :
- `src/lib/agents/loaders/mining.ts:198-260` (`loadMiningOpsSnapshot`) — alimente
  `MemoPdfData.miningOps` (Investor Memo PDF, page "Mining Health"), un consommateur
  **distinct** de `loadLatestMiningMetrics` (déjà corrigé par T-13). `hashrate_ph_s` est la
  moyenne de `MiningMetric.deployedHashrate` et `uptime_pct` la moyenne de
  `MiningMetric.uptimePct` — les deux colonnes toujours écrites en dur
  (`deployedHashrate: 182_000`, `uptimePct: 98.5`) par `market-data-hourly.ts:117-118` (même
  cron que T-13/RP-10).
- `src/lib/pdf/memo-pages/mining-health.tsx:46-52` — badgeait ces deux métriques
  `opsProvenance = data.miningOps.is_fallback ? "estimated" : "attested"`. Or `is_fallback`
  ne signale que "aucune ligne DB dans la fenêtre 30j" — pas "cette ligne est une vraie
  mesure". Le cron tourne toutes les heures, donc `is_fallback` est quasi toujours `false` →
  le PDF affichait quasi systématiquement "Hashrate deployed" et "Uptime" avec le hint
  trompeur "JV operator fleet, paper-attested" / "Trailing 30d, paper attestation", alors que
  ce sont des constantes codées en dur, jamais mesurées.

**Impact** : viole le non-négociable #2 (CLAUDE.md — chaque métrique doit porter un badge de
provenance honnête) sur un document **LP-visible** (l'Investor Memo PDF, généré par
`admin/investor-memo/pdf-action.tsx` et envoyé/téléchargé pour les investisseurs) — sévérité
équivalente à T-01, plus élevée que T-13 (qui touchait la narrative agent, pas un document
formel envoyé aux LPs). Seul consommateur visuel de `miningOps` trouvé dans le code
(`grep -rl "miningOps" src/app src/components` → uniquement `pdf-action.tsx`) ; le dashboard
admin (`src/lib/data/dashboard.ts`) charge aussi `loadMiningOpsSnapshot()` mais aucune page/
composant ne restitue `dashboardData.miningOps` visuellement à ce jour (vérifié par grep).

**Ce qui était déjà honnête (pas un bug)** : `margin_score` est déjà codé en dur `"estimated"`
dans `mining-health.tsx:75` (composite engine, jamais "attested") ; `attestations_count` est un
vrai comptage Prisma (`Proof.proofType = "mining_attestation"`), pas fabriqué ; `is_fallback`
reste correctement utilisé ailleurs (`dashboard-page-view.ts:32`, scoping preview vault) — non
touché, sémantique différente et légitime.

**Fix appliqué (2 fichiers, owner zone respectée — pas de page `src/app/**`, `src/lib/pdf/**`
est un template de rendu lib, pas une route)** :
- `src/lib/pdf/memo-pages/mining-health.tsx` — `opsProvenance` est désormais toujours
  `"estimated"` (jamais dérivé de `is_fallback`) pour les KPI "Hashrate deployed" et "Uptime" ;
  les hints distinguent toujours "aucune ligne DB" vs "ligne présente mais valeur placeholder"
  sans jamais impliquer une mesure réelle.
- Guard de régression ajouté : `src/lib/__tests__/data-honesty-guards.test.ts` POINT 8 — vérifie
  que `opsProvenance = "estimated"` en dur et que le ternaire `is_fallback ? "estimated" :
  "attested"` ne réapparaît pas.

**Non touché (délibérément)** : `src/lib/agents/loaders/mining.ts` lui-même n'a pas eu besoin
d'un nouveau champ — le snapshot `MiningOpsSnapshot`/`is_fallback` garde sa sémantique actuelle
(légitime pour d'autres usages) ; le fix est entièrement côté consommateur PDF. Le dashboard
admin (`src/lib/data/dashboard.ts`, `dashboard-page-view.ts`) n'a pas été touché : aucune UI
actuelle n'y restitue `miningOps` visuellement, donc pas de risque LP-visible actif là — à
surveiller si un futur composant l'affiche.

**Validations** : `pnpm typecheck` → 0 erreur. `pnpm test` → **448/448 fichiers, 5355/5355
tests** (5354 baseline + 1 nouveau POINT 8). Suite ciblée `data-honesty-guards.test.ts` → 23/23.
`prisma/schema.prisma` restauré proprement en `postgresql` après coup.

---

## Rapport batch "Data Truth" — nouvelle invocation, 3e fix réel (2026-07-04)

> Nouvelle invocation batch série 5/9 sur la même branche. Le working tree contenait déjà
> T-13 + T-14 non commités (relus et validés, rien à changer). Plutôt que de refaire un sweep
> mock/hardcode déjà couvert ~7 fois, cette session a suivi le même fil que T-13/T-14 vers un
> **troisième consommateur distinct** : le loader `loadMemoInput` (`src/lib/agents/loaders/
> vault.ts`), qui alimente le MÊME document LP-visible (Investor Memo PDF) mais pour les champs
> `vault`/`mining` (AUM, APY, risk score) plutôt que `miningOps`.

### T-15 — Investor Memo PDF peut badger un `VaultSnapshot` seed/preset comme "attested" [CRITICAL — LP visible, document PDF envoyé aux LPs]

**Fichier** : `src/lib/agents/loaders/vault.ts:97-158` (`loadMemoInput`) — appelé par
`admin/investor-memo/actions.ts`, `admin/investor-memo/pdf-action.tsx` et le cron
`inngest/functions/investor-memo-monthly.ts`.

**Root cause** : `loadMemoInput` lit `prisma.vaultSnapshot.findFirst({ orderBy: { takenAt:
"desc" } })` — **sans aucun filtre `where` sur `source`**. Il peut donc remonter n'importe quelle
ligne `VaultSnapshot`, y compris une ligne `source: "daily-seed"` (timeline synthétique
sinusoïdale de `prisma/seed.ts`, datée jusqu'à "aujourd'hui" — `seedDailyVaultTimeline()`) ou
`source: "computed"` (run engine sur preset, jamais une mesure réelle — `seedPresetVaultSnapshots
()`), et pas seulement une vraie ligne de custody `"live"`/`"oracle"`. Le tag de provenance
`snapshotTag` était calculé **uniquement** à partir de la fraîcheur de `takenAt`
(`evaluateFreshness`), sans jamais regarder `source` — donc une ligne fraîchement seedée
(synthétique) se voyait badgée `"attested"`, exactement la même classe de bug que T-13/T-14
(fraîcheur ≠ authenticité), sur le MÊME document LP-visible (Investor Memo PDF), cette fois pour
AUM/APY/risk score/mining margin plutôt que hashrate/uptime.

**Ce qui prouve que ce n'est pas une fausse alerte** : `src/lib/data/timeline-snapshot.ts` encode
déjà cette règle explicitement pour le dashboard admin — `LIVE_TIMELINE_SOURCES = new Set(["live",
"oracle", "attested"])`, avec le commentaire : *"`daily-seed` is valid timeline data for
charts/history but MUST NOT trigger Live/Attested provenance badges"* — et `dashboard.ts:402`
calcule `hasLiveTimelineSnapshot: isLiveTimelineSource(latestSnapshotSource)` en conséquence.
`loadMemoInput` n'importait pas cette fonction et ignorait `source` entièrement : le garde-fou
existe déjà dans le codebase pour UNE surface (dashboard) mais pas pour l'AUTRE surface qui lit la
même table (memo PDF).

**Ce qui n'a PAS été changé (délibérément, portée minimale)** : la requête `findFirst` elle-même
(quelle ligne choisir) reste inchangée — en production, une fois que `custody-snapshot-hourly.ts`
écrit des lignes `source: "live"` (dès que le vault a des fonds réels), c'est bien la ligne "live"
la plus récente qui doit gagner, ce qui est déjà le comportement actuel de la requête non filtrée.
Retoucher la sélection de ligne aurait été plus risqué et hors scope ; le vrai bug était
uniquement le badge de provenance, pas le choix de ligne — même logique que T-13/T-14 (fix du tag,
pas de la requête).

**Fix appliqué (1 fichier, owner zone respectée — `src/lib/agents/loaders/**`, aucune UI, aucun
Prisma)** :
- `src/lib/agents/loaders/vault.ts` — importe `isLiveTimelineSource` depuis
  `@/lib/data/timeline-snapshot` ; `snapshotTag` (utilisé pour `provenance.vault` ET
  `provenance.mining`) est désormais `"estimated"` dès que `!isLiveTimelineSource(snapshot.
  source)`, et ne retombe sur la logique fraîcheur (`attested`/`stale`) que pour un `source` déjà
  reconnu comme réel (`"live"`, `"oracle"`, `"attested"`).
- Guard de régression ajouté : `src/lib/__tests__/data-honesty-guards.test.ts` POINT 9 — vérifie
  l'import + la garde `!isLiveTimelineSource(snapshot.source) ? "estimated"` dans le loader, plus
  deux ancres de sanité (seed.ts écrit toujours `"computed"`/`"daily-seed"`, et
  `timeline-snapshot.ts` exclut toujours ces deux valeurs du set "live").

**Validations** : `pnpm typecheck` → 0 erreur. `pnpm test` → **448/448 fichiers, 5358/5358 tests**
(5355 baseline + 3 nouveaux POINT 9). Suite ciblée `data-honesty-guards.test.ts` → 26/26.
`pnpm run lint` → 1 erreur pré-existante, hors scope (`src/components/admin/outreach/
email-review-card.tsx:110`, React Hook `setState` dans un effet — fichier UI non touché par ce
batch, `eslint src || true` reste advisory par CLAUDE.md). `prisma/schema.prisma` restauré
proprement en `postgresql` après coup.

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

*Mis à jour : 2026-07-03 (batch 2 — Truth Audit).*
