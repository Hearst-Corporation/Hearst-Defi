# HANDOFF.md — Recovery Series (log chronologique, dernier batch en premier)

---

## Batch 5/9 (builder, Data Truth) : nouvelle invocation, 2e finding réel T-14 corrigé — 2026-07-04

**Batch série** : builder, `batch 5/9` (série `series_recovery_hearst-defi_0`), rôle "Data
Truth". Nouvelle invocation sur la **même branche** (`nexus/loop_mr3jnyjv-mr5larbn`) — le
working tree contenait déjà, non commité, le fix T-13 complet (2 sessions précédentes l'ont
relu et validé sans y toucher).

RELAIS relu intégralement avant toute action. `docs/agent-file-locks.md` relu : mêmes 4 locks
actifs (`fix/strategy-dupkey-fix`, `feat/product-workspace-report-product-polish`,
`feat/projection-safe-input-preset`, `fix/machine-logo-visible`), tous UI, aucun chevauchement.
`git log` confirme `HEAD` toujours sur `5b339d38` = `origin/main`.

**Ce que cette session a fait différemment** : plutôt que de re-balayer les mêmes répertoires
(déjà couverts ~6 fois), elle a poussé plus loin l'investigation du **même fichier** que le
fix T-13 (`src/lib/agents/loaders/mining.ts`) : `loadLatestMiningMetrics` (corrigé par T-13)
n'est **pas** la seule fonction exportée de ce loader qui expose `uptime_pct`/hashrate au monde
extérieur. `loadMiningOpsSnapshot` (même fichier, lignes 198-260) alimente un consommateur
**distinct** — l'Investor Memo PDF — via `src/lib/pdf/memo-data.ts` →
`src/lib/pdf/memo-pages/mining-health.tsx`. Ça a révélé un second finding réel :

**T-14 — Investor Memo PDF badge "attested" le hashrate/uptime miniers alors que ce sont
toujours des placeholders codés en dur [CRITICAL — document PDF envoyé aux LPs].**
`mining-health.tsx:46` calculait `opsProvenance = data.miningOps.is_fallback ? "estimated" :
"attested"` pour les KPI "Hashrate deployed" et "Uptime". Or `is_fallback` signale seulement
"aucune ligne `MiningMetric` dans la fenêtre 30j" — pas "cette ligne est une vraie mesure". Le
cron `market-data-hourly.ts` tourne toutes les heures et écrit toujours `uptimePct: 98.5` /
`deployedHashrate: 182_000` en dur (même placeholder que T-13) : `is_fallback` est donc quasi
toujours `false`, et le PDF affichait quasi systématiquement ces deux métriques comme
"attested" avec un hint trompeur ("JV operator fleet, paper-attested" / "Trailing 30d, paper
attestation"). Sévérité équivalente à T-01 (document formel LP-visible), plus grave que T-13
(qui touchait seulement la narrative de l'agent Mining Health, pas un PDF envoyé aux
investisseurs). Seul consommateur visuel de `miningOps` trouvé dans le code (vérifié par
grep sur `src/app`/`src/components`) ; le dashboard admin charge aussi
`loadMiningOpsSnapshot()` mais aucune page/composant ne restitue `miningOps` visuellement à
ce jour.

**Fix appliqué** (2 fichiers, owner zone respectée — `src/lib/pdf/**` est un template de rendu
lib, pas une route `src/app/**`) :
- `src/lib/pdf/memo-pages/mining-health.tsx` : `opsProvenance` toujours `"estimated"` pour
  Hashrate/Uptime, jamais dérivé de `is_fallback` ; hints reformulés pour ne jamais impliquer
  une mesure réelle.
- `src/lib/__tests__/data-honesty-guards.test.ts` : POINT 8 ajouté — verrouille que
  `opsProvenance = "estimated"` en dur et que le ternaire `is_fallback ? "estimated" :
  "attested"` ne réapparaît pas.

**Non touché délibérément** : `loaders/mining.ts` n'a pas eu besoin d'un nouveau champ — le
fix est entièrement côté consommateur PDF, `MiningOpsSnapshot`/`is_fallback` gardent leur
sémantique actuelle (légitime ailleurs, ex. `dashboard-page-view.ts` preview-vault scoping).
`src/lib/data/dashboard.ts`/`dashboard-page-view.ts` non touchés : aucune UI actuelle n'y
restitue `miningOps` visuellement.

**Validations** (environnement chaud) :
- `pnpm typecheck` → **0 erreur**.
- `pnpm test` → **448/448 fichiers, 5355/5355 tests** (5354 baseline + 1 nouveau POINT 8).
  `prisma/schema.prisma` restauré proprement en `postgresql`.
- Suite ciblée `data-honesty-guards.test.ts` → 23/23, verte.

**Fichiers modifiés cette session** :
| Fichier | Action |
|---|---|
| `src/lib/pdf/memo-pages/mining-health.tsx` | Fix — hashrate/uptime toujours `"estimated"`, jamais dérivé de `is_fallback` |
| `src/lib/__tests__/data-honesty-guards.test.ts` | POINT 8 — guard régression provenance PDF mining ops |
| `docs/projects/hearst-defi/DECISIONS.md` | T-14 documenté (détail complet) |
| `docs/projects/hearst-defi/BATCHES.md` | Ligne 2b + horodatage mis à jour |
| `docs/projects/hearst-defi/PROJECT_STATE.md` | RP-10 enrichi (T-14) |
| `docs/projects/hearst-defi/HANDOFF.md` | Ce fichier — section ajoutée |

**Fichiers exclus (owner zone respectée)** : aucune UI page (`src/app/**`), aucun
`prisma/**`, aucun `.github/workflows/**`, aucun secret/`.env*`, aucun `vercel.json` ;
`src/lib/llm/tools/registry.ts` toujours non touché (sensible single-owner).

**Statut d'intégration** : diff non commité/non poussé (T-13 + T-14 cumulés sur cette
branche) — pas de PR ouverte par ce batch (rôle builder ; intégration = étape suivante du
pipeline nexus, hors scope de ce rôle).

**Prochain batch recommandé** : inchangé — **Batch 3 — Corrections P0 restantes** (C-05
décision produit résiduelle, C-11 cookie `sameSite`, C-13 Model B one-liner LP, T-02 décision
Adrien email de reçu). Les fixes T-13/T-14 de cette série peuvent être intégrés
indépendamment (isolés, testés, hors scope batch 3).

---

## Batch 5/9 (builder, Data Truth) : re-confirmation + sweep étendu (agentic/outreach/email), no-op additionnel — 2026-07-04

**Batch série** : builder, `batch 5/9` (série `series_recovery_hearst-defi_0`), rôle "Data
Truth". Nouvelle invocation, **même branche** que la passe précédente
(`nexus/loop_mr3jnyjv-mr5larbn`) — le working tree contenait déjà, non commité, le fix T-13
complet (`src/lib/agents/loaders/mining.ts` + POINT 7 dans `data-honesty-guards.test.ts` + les
4 fichiers docs), décrit dans la section juste en dessous.

RELAIS relu intégralement avant toute action. `docs/agent-file-locks.md` relu en entier (1025
lignes) : locks actifs inchangés (`fix/strategy-dupkey-fix`, `feat/product-workspace-report-
product-polish`, `feat/projection-safe-input-preset`, `fix/machine-logo-visible`) — tous UI,
aucun chevauchement avec l'owner zone données/API. `gh` non disponible dans cet environnement
(`command not found`) — pas d'accès direct aux PR ouvertes ; `git log`/`git status` ne montrent
aucune autre branche/PR touchant cette owner zone.

**Ce que cette session a fait** :
1. Relu ligne à ligne le diff déjà présent (`mining.ts` + POINT 7) — correct, cohérent avec la
   description de la passe précédente, rien à changer.
2. Étendu le balayage anti-mock (`mock|fake|hardcod|placeholder|dummy`) à des répertoires
   pas explicitement couverts par les passes précédentes de cette série : `src/lib/agentic/**`
   (swarm/live, observability, crew-simulation, reporting, product-projection),
   `src/lib/outreach/**`, `src/lib/email/**`, `src/lib/power/**`. **Aucun nouveau finding** :
   tous les hits sont soit des `vi.mock(...)` de tests (attendus), soit des commentaires
   documentant un refactor passé ("was hardcoded, now configurable" — `quant-assumptions.ts`,
   `pipeline.ts`, `runners-data.ts`), soit le fallback Apollo déjà honnêtement flaggé
   (`src/lib/outreach/icp.ts` — `mock: true` sur chaque candidat généré, statut documenté en
   commentaire de tête "SOURCING RUNNER — STATUS: REAL (with mock fallback when
   APOLLO_API_KEY absent)", déjà couvert par T-10 et déjà guardé côté prod dans
   `admin/outreach/actions.ts`).
3. Validations complètes relancées indépendamment sur environnement chaud (`node_modules`,
   `prisma/dev.db` déjà présents) :
   - `pnpm typecheck` → **0 erreur**.
   - `pnpm test` (suite complète, wrapper `pretest`/`posttest` sqlite↔postgresql) →
     **448/448 fichiers, 5354/5354 tests**. `prisma/schema.prisma` confirmé propre
     (`postgresql`, `git diff --stat` vide après coup).

**Conclusion** : le fix T-13 déjà présent dans le working tree reste la seule action de code
réelle et nécessaire pour cette owner zone à ce jour ; le sweep étendu à agentic/outreach/email/
power ne révèle aucun mock non signalé supplémentaire. **Aucun changement de fichier source
additionnel cette session** — diff inchangé vs la passe précédente, uniquement cet addendum
HANDOFF. Le diff reste non commité/non poussé (rôle builder — intégration hors scope).

**Prochain batch recommandé** : inchangé — **Batch 3 — Corrections P0 restantes** (C-05
décision produit résiduelle, C-11 cookie `sameSite`, C-13 Model B one-liner LP, T-02 décision
Adrien email de reçu).

---

## Batch 5/9 (builder, Data Truth) : nouvelle invocation, finding réel T-13 corrigé — 2026-07-04

**Batch série** : builder, `batch 5/9` (série `series_recovery_hearst-defi_0`), rôle "Data
Truth" (owner zone : couche données/API — sources réelles, gardes anti-mock). Nouvelle
invocation sur une branche fraîche (`nexus/loop_mr3jnyjv-mr5larbn`), checkout vierge
(`node_modules`/`prisma/dev.db` absents au démarrage).

**RELAIS relu intégralement** (`PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`,
`DECISIONS.md`, `HANDOFF.md`) avant tout code. `docs/agent-file-locks.md` vérifié : 4 locks actifs
(`fix/strategy-dupkey-fix`, `feat/product-workspace-report-product-polish`,
`feat/projection-safe-input-preset`, `fix/machine-logo-visible`), tous scopés UI étroits, aucun
chevauchement avec `src/lib/agents/loaders/mining.ts` ni `src/lib/__tests__/data-honesty-guards.test.ts`.
`git fetch origin main` + `git merge-base --is-ancestor b3487a69 HEAD` → HEAD (`5b339d38`) =
`origin/main`, aucune divergence ; `git log b3487a69..HEAD -- src/lib src/app/api` → seul
`0e378906` (forbidden-words fix, déjà documenté, hors scope mocks). Aucune PR ouverte ne chevauche
cet owner zone.

**Ce que cette session a fait différemment** : au lieu de répéter le même balayage
(`portfolio/`, `data/`, `agents/`, `onchain/`, `governance/`, `distribution/`, `notifications/`,
`product-strategies/` — déjà couverts ~5 fois, toujours no-op), elle a étendu le grep
`mock|fake|hardcod|placeholder|dummy` à `src/lib/inngest/functions/*` (les crons de market data /
mining health), un répertoire pas explicitement cité par les passes précédentes. Ça a trouvé un
finding réel :

**T-13 — mining fleet uptime badgé "attested" alors que c'est un placeholder codé en dur.**
`src/lib/inngest/functions/market-data-hourly.ts:117-118` écrit `uptimePct: 98.5` /
`deployedHashrate: 182_000` en dur sur chaque ligne `MiningMetric` (commentaire du code lui-même :
`// placeholder until real uptime feed`). `src/lib/agents/loaders/mining.ts`
(`loadLatestMiningMetrics`, le loader de l'agent Mining Health) appliquait pourtant à `uptime_pct`
le même tag de provenance que `hashprice`/`difficulty`/`margin` (`"attested"` ou `"stale"` selon
la fraîcheur de la ligne) — alors que le vocabulaire officiel de `attested` (`src/lib/agents/
schemas.ts`) exige "measured row + verified mining_attestation Proof". Un chiffre codé en dur
n'est jamais mesuré : le badger `attested` viole le non-négociable #2 (CLAUDE.md — chaque métrique
doit porter un badge de provenance honnête), et empêchait l'agent de recevoir l'instruction
"FLAG IN-LINE" (réservée aux tags dégradés) pour ce chiffre précis dans sa narrative LP quotidienne.

**Fix appliqué** (2 fichiers, owner zone respectée — aucune UI, aucun Prisma, aucun workflow) :
- `src/lib/agents/loaders/mining.ts` : `uptime_pct` est désormais toujours tagué `"estimated"`
  (jamais `rowTag`), peu importe la fraîcheur — `hashprice_usd_per_th`/`difficulty_change_pct`/
  `margin_pct` restent sur `rowTag` (ce sont, eux, de vraies valeurs mesurées/dérivées d'un
  feed live). `estimated` est un tag dégradé → l'agent flague désormais correctement ce chiffre.
- `src/lib/__tests__/data-honesty-guards.test.ts` : POINT 7 ajouté (même convention lecture
  statique que POINT 1-6) — verrouille que `uptime_pct` reste `"estimated"` et que les 3 autres
  métriques restent sur `rowTag`, + ancre sur le placeholder `98.5` documenté dans le cron.

**Non touché délibérément** : `src/lib/llm/tools/registry.ts` (`read_market_snapshot`, expose
aussi `uptime_pct` en texte brut au modèle de chat) est un fichier **sensible single-owner**
listé dans CLAUDE.md — non édité par prudence de coordination ; le vrai gap de provenance côté
agent structuré JSON (le chemin réellement utilisé par la narrative LP quotidienne) est, lui,
corrigé. Détail complet + inventaire des zones déjà auditées (aucun autre finding) dans
`DECISIONS.md` §"Rapport batch Data Truth — nouvelle invocation, fix réel".

**Validations** (checkout vierge — `pnpm install` + `pnpm db:generate` + `prisma db push
--accept-data-loss` requis avant premier test, comme documenté par les batches précédents) :
- `pnpm typecheck` → **0 erreur**.
- `pnpm test` (suite complète, wrapper `pretest`/`posttest` sqlite↔postgresql) → **448/448
  fichiers, 5354/5354 tests** (5352 baseline + 2 nouveaux POINT 7). `prisma/schema.prisma`
  restauré proprement en `postgresql` après coup (`git diff --stat prisma/schema.prisma` vide).
- Suite ciblée (`mining-ops-fallback.test.ts`, `mining-health-daily.test.ts`,
  `data-honesty-guards.test.ts`, `provenance.test.ts`, `agent-parsers.test.ts`) → 72/72, verte.

**Fichiers modifiés** :
| Fichier | Action |
|---|---|
| `src/lib/agents/loaders/mining.ts` | Fix — `uptime_pct` provenance toujours `"estimated"`, jamais hérité de `rowTag` |
| `src/lib/__tests__/data-honesty-guards.test.ts` | POINT 7 — guard régression provenance uptime |
| `docs/projects/hearst-defi/DECISIONS.md` | T-13 documenté (détail complet) |
| `docs/projects/hearst-defi/BATCHES.md` | Ligne 2b mise à jour |
| `docs/projects/hearst-defi/HANDOFF.md` | Ce fichier — section ajoutée |

**Fichiers exclus (owner zone respectée)** : aucune UI page, aucun `prisma/**` (migration),
aucun `.github/workflows/**`, aucun secret/`.env*`, aucun `vercel.json`, `src/lib/llm/tools/
registry.ts` non édité (sensible single-owner, cf. ci-dessus).

**Statut d'intégration** : diff non commité/non poussé — pas de PR ouverte par ce batch (rôle
builder ; l'étape d'intégration/commit/push/PR est hors scope de ce rôle, laissée à l'étape
suivante du pipeline nexus).

**Prochain batch recommandé** : inchangé — **Batch 3 — Corrections P0 restantes** (C-05 décision
produit résiduelle, C-11 cookie `sameSite`, C-13 Model B one-liner LP, T-02 décision Adrien email
de reçu). Le fix T-13 de cette session peut être intégré indépendamment (isolé, testé, hors
scope batch 3).

---

## Batch 5/9 (builder, Data Truth) : nouvelle invocation, sweep étendu, no-op — 2026-07-03

**Batch série** : builder, `batch 5/9` (série `series_recovery_hearst-defi_0`), rôle "Data
Truth" (owner zone : couche données/API — sources réelles, gardes anti-mock). Nouvelle
invocation sur la même branche (`nexus/loop_mr3jnyjv-mr5jfrcd`, non poussée sur origin —
`git ls-remote` confirme).

RELAIS relu intégralement (`PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`,
`DECISIONS.md`, `HANDOFF.md`) avant toute action. `docs/agent-file-locks.md` vérifié :
locks actifs (`fix/strategy-dupkey-fix`, `feat/product-workspace-report-product-polish`,
+ ceux listés dans l'entrée précédente) tous scopés UI, aucun chevauchement avec l'owner
zone données/API. `git log b3487a69..HEAD -- src/lib src/app/api` → toujours un seul
commit (`0e378906`, forbidden-words guard, hors scope mocks). `HEAD` = `9a48f266` =
`origin/main`, inchangé depuis la dernière passe de cette série. Aucune PR ouverte ne
chevauche cet owner zone (pas d'accès `gh` dans cet environnement ; vérifié via
`git ls-remote` — aucune branche remote ne correspond à cette branche locale).

**Constat** : le working tree contenait déjà, non commité, un addendum HANDOFF complet
de la passe précédente sur cette même branche (section ci-dessous) — état identique,
aucune régression, rien à dédupliquer côté contenu.

**Ce que cette session a fait de nouveau** (plutôt que republier la même conclusion) :
élargi le balayage anti-mock à des répertoires pas explicitement listés dans les passes
précédentes :

1. `grep -rniE "mock|fake|hardcod|placeholder|dummy"` sur `src/lib/governance`,
   `src/lib/distribution`, `src/lib/notifications`, `src/lib/onchain` — seuls hits :
   `distribution/events.ts:33` (commentaire documentant T-05), `governance/actions.ts:268,331`
   (commentaires documentant T-06, déjà signalés en UI), `distribution/atomic-exec.ts:132`
   (`0xMOCK_` déjà badgé "estimated" en admin, T-05), `onchain/vault.ts:10,73` (commentaires
   de garde anti-fake, pas un mock). Rien de nouveau.
2. `grep` sur `NOTIFICATION_MATRIX`/`resolveChannels` (T-08) : toujours 0 consommateur
   hors `router.ts` lui-même — état inchangé, hors owner zone (UI bell + batch 8).
3. Balayage `Math.random()` élargi à **tout** `src/lib` hors `__tests__`/`engine/`/
   `simulation`/`seed` (liste de fichiers plus large que les passes précédentes —
   `products/*`, `vault-drafts/*`, `agentic/swarm/live/*`, `vaults/profile.ts`,
   `vaults/blueprint.ts`, `strategy-data-lab/allocator.ts`) : **tous** les hits sont des
   commentaires de garde de pureté ("no Math.random()", engine purity rule #6), sauf deux
   usages réels déjà connus et non-financiers — `rate-limit.ts:137` (id de fenêtre
   rate-limit) et `agents/swarms/outreach-swarm-orchestrator.ts:155` (`runId` de
   corrélation, pas une donnée LP-visible). Aucun calcul financier ou métrique affichée au
   LP ne dépend d'un random ungouverné.
4. Re-vérification T-01 : `dataSource: "live" | "stub"` toujours présent sur `TaxPreview`
   (`src/lib/portfolio/tax.ts:80,251`).

**Validations** (environnement déjà chaud — `node_modules/` et `prisma/dev.db` présents) :
- `pnpm typecheck` → **0 erreur**.
- `pnpm exec vitest run src/lib/portfolio/__tests__/tax.test.ts
  src/lib/portfolio/__tests__/tax-preview-loader.test.ts
  src/lib/__tests__/data-honesty-guards.test.ts` → **3 fichiers, 68 tests, tous verts**
  (guard de régression T-01 confirmé fonctionnel).

**Conclusion** : owner zone "couche données/API — sources réelles, gardes anti-mock"
confirmée sans item actionnable restant, y compris sur le périmètre élargi
(governance/distribution/notifications/onchain/products/vault-drafts/agentic-swarm-live).
**Aucun changement de fichier source cette session** — uniquement cet addendum HANDOFF.
Pas de PR nécessaire (no-op sain, cohérent avec les 3+ passes précédentes sur ce même
batch dans la série).

**Prochain batch recommandé** : inchangé — **Batch 3 — Corrections P0 restantes** (C-05
décision produit résiduelle, C-11 cookie `sameSite`, C-13 Model B one-liner LP, T-02
décision Adrien email de reçu). Voir `DECISIONS.md` §"Questions en attente pour Adrien".

---

## Batch 5/9 (builder, Data Truth) : re-confirmation indépendante, no-op — 2026-07-03

**Batch série** : builder, `batch 5/9` (série `series_recovery_hearst-defi_0`), rôle "Data
Truth" (owner zone : couche données/API — sources réelles, gardes anti-mock). Nouvelle
invocation de loop sur ce même scope (`nexus/loop_mr3jnyjv-mr5jfrcd`).

RELAIS relu intégralement (`PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`,
`DECISIONS.md`, `HANDOFF.md`) avant de coder. `docs/agent-file-locks.md` vérifié : 3 locks
actifs (`fix/strategy-dupkey-fix`, `feat/product-workspace-report-product-polish`,
`feat/projection-safe-input-preset`) + `fix/machine-logo-visible` — tous scopés à des
fichiers UI étroits (strategies admin, product-workspace, projection handoff, logo chip),
aucun chevauchement avec l'owner zone données/API de ce batch. `git status` de départ :
propre, `HEAD` = `origin/main` (`9a48f266`), aucune PR ouverte ne chevauche cet owner zone.
Dépendance batch 01 (Stabilization) vérifiée : `git merge-base --is-ancestor 9b01f8b3 HEAD`
→ ancêtre, satisfaite.

**Constat de départ** : le travail concret de ce rôle ("Data Truth" — reprendre les
findings T-01→T-12 du Truth Audit et remplacer les mocks non signalés côté données/API par
des sources réelles ou des états honnêtes) avait déjà été fait et **mergé dans `main`** par
un run antérieur — commit `b3487a69` (PR #369, `loop_mr3jnyjv-mr58ghru`), qui correspond
exactement au "Rapport batch Data Truth" documenté dans `DECISIONS.md`. Cette branche part
de `main` et contient déjà ce commit. `src/lib/portfolio/tax.ts` porte bien le champ
`dataSource: "live" | "stub"`, et le guard de régression POINT 6 est présent dans
`src/lib/__tests__/data-honesty-guards.test.ts`.

**Ce que cette session a fait** : au lieu de dupliquer, elle a (1) refait l'inventaire
indépendant des findings T-01→T-12 pour confirmer qu'aucun n'est retombé dans un état non
honnête, et (2) balayé le code data/API touché **depuis** le rapport Data Truth original
pour détecter tout nouveau mock non signalé :

1. `git log b3487a69..HEAD -- src/lib src/app/api` → un seul commit dans l'owner zone :
   `0e378906 fix(chat): stop blocking honest risk disclosures` (fix du garde-fou
   `forbidden-words`, faux positif de compliance — sans rapport avec des données mockées,
   déjà mergé directement, hors scope Data Truth).
2. Re-vérification T-01 : `dataSource` toujours présent, tests `tax.test.ts` bloc 19 et
   `tax-preview-loader.test.ts` toujours verts.
3. Re-vérification T-05/T-06/T-07/T-10 (déjà honnêtement signalés au batch précédent) :
   `admin/distributions/page.tsx:173-191` toujours badge `estimated` sur `0xMOCK`,
   `admin/governance/proposal/[id]/page.tsx:334` toujours le texte "mock only — no
   Solidity calls", `attestation/mock.ts` toujours confiné à `prisma/seed.ts`/tests,
   `src/app/admin/outreach/actions.ts:894-898` toujours le refus prod sans
   `APOLLO_API_KEY`.
4. Balayage large `mock|fake|hardcod|placeholder|dummy` sur `src/lib` (hors tests) : tous
   les hits restants sont soit des commentaires de garde (`isPlaceholderTxHash`,
   `isMock`/`isPlaceholderVault`, `dataSource`), soit des mocks déjà confinés/testés
   (`src/lib/attestation/__mocks__/mock-key.ts`) — aucun nouveau mock non signalé trouvé.
5. Balayage `Math.random()` hors `__tests__`/`engine/`/`simulation`/`seed` : tous les hits
   sont soit des commentaires documentant une contrainte de pureté ("no Math.random()"),
   soit un usage légitime non-données (`rate-limit.ts:137`, id unique de fenêtre de rate
   limit) — aucun calcul financier/donnée LP-visible ne dépend d'un random ungouverné.
6. Balayage rapide des routes `src/app/api/**/route.ts` sans appel `prisma`/`fetch` direct
   au niveau du fichier route — tous délèguent à des loaders `lib/` déjà couverts par les
   points précédents (pas de nouvelle route retournant des données statiques déguisées en
   réelles).

**Validations** (checkout vierge — `node_modules` et `prisma/dev.db` absents au démarrage,
même piège que documenté au batch 4/9 précédent) :
- `pnpm install` puis `pnpm db:generate` — requis.
- `PRISMA_PROVIDER=sqlite node scripts/prisma-provider.mjs && prisma db push
  --accept-data-loss` puis restauration provider — requis avant premier `pnpm test`
  (`dev.db` gitignored, 0 octet sur ce runner).
- `pnpm typecheck` → **0 erreur**.
- `pnpm test` → **448/448 fichiers, 5352/5352 tests** (progression vs 5323 documentée au
  batch 4/9 — delta expliqué par les tests `forbidden-words` ajoutés par le commit
  `0e378906` entre-temps, hors scope de ce batch). `prisma/schema.prisma` restauré
  proprement en `postgresql` après coup (`git diff --stat prisma/schema.prisma` vide).

**Conclusion** : l'owner zone "couche données/API — sources réelles, gardes anti-mock"
**n'a aucun item actionnable restant** au 2026-07-03 : le seul finding qui relevait
réellement de cette zone (T-01) est corrigé et gardé par un test de régression ; les
findings déjà honnêtement signalés (T-05/T-06/T-07/T-10) le restent ; les autres (T-02,
T-03, T-04, T-08, T-09, T-11, T-12) nécessitent une page UI, une migration Prisma, ou une
décision produit Adrien — hors owner zone data/API par construction, inchangés. **Aucun
changement de fichier source cette session** — uniquement cet addendum HANDOFF +
correction du statut PR mergée dans `BATCHES.md`. Pas de PR nécessaire (no-op sain).

**Prochain batch recommandé** : inchangé — **Batch 3 — Corrections P0 restantes** (C-05
décision produit résiduelle, C-11 cookie `sameSite`, C-13 Model B one-liner LP, T-02
décision Adrien email de reçu). Voir `DECISIONS.md` §"Questions en attente pour Adrien".

---

## Batch 4/9 (builder, Stabilization) : 4e confirmation indépendante, no-op — 2026-07-03

**Batch série** : builder, `batch 4/9` (série `series_recovery_hearst-defi_0`), même rôle
"Stabilization". Nouvelle invocation de loop sur ce même scope (`nexus/loop_mr3jny8d-mr5e4hpx`).

RELAIS relu intégralement avant de coder. `docs/agent-file-locks.md` vérifié : seul lock
actif = `fix/strategy-dupkey-fix` (scope UI strategies étroit), aucun chevauchement avec
l'owner zone cross-cutting lint/typecheck/test de ce batch. `git merge-base --is-ancestor
9b01f8b3 HEAD` → oui, le commit de stabilisation (PR #370) est bien dans l'historique de
cette branche. `git status` de départ : seuls les 3 fichiers doc de la passe précédente
non commités (aucun diff de code).

Environnement déjà chaud (`node_modules/` présent, `prisma/dev.db` peuplé). Validations
relancées intégralement, sans aucun changement de code source :

- `pnpm typecheck` → **0 erreur**.
- `pnpm run lint` → **0 erreur**, 46 warnings pré-existants identiques.
- `pnpm test` → **448/448 fichiers, 5323/5323 tests**. `prisma/schema.prisma` sans diff
  après coup (`git diff --stat` vide).

**Conclusion** : 4e confirmation indépendante que la baseline est verte et que la mission
de ce batch reste satisfaite par le commit déjà mergé `9b01f8b3` (PR #370). Aucun changement
de fichier source cette session — uniquement cet addendum HANDOFF + horodatage BATCHES.md.
Pas de PR nécessaire (no-op sain).

**Prochain batch recommandé** : inchangé — **Batch 3 — Corrections P0 restantes** (C-05
décision produit résiduelle, C-11 cookie `sameSite`, C-13 Model B one-liner LP, T-02
décision Adrien email de reçu). Voir `DECISIONS.md` §"Questions en attente pour Adrien".

---

## Batch 4/9 (builder, Stabilization) : re-confirmation supplémentaire, checkout chaud — 2026-07-03

**Batch série** : builder, `batch 4/9` (série `series_recovery_hearst-defi_0`), même rôle
"Stabilization". Nouvelle invocation de loop sur ce même scope.

RELAIS relu intégralement (`PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`,
`DECISIONS.md`, `HANDOFF.md`) avant de coder. `docs/agent-file-locks.md` vérifié : locks
actifs (`fix/strategy-dupkey-fix` + autres, cf. entrée précédente) tous scopés à des
fichiers UI étroits, aucun chevauchement avec l'owner zone cross-cutting de ce batch.
`git status` de départ : seuls `BATCHES.md`/`HANDOFF.md`/`PROJECT_STATE.md` non commités
(addendum de la passe "checkout vierge" précédente, non un diff de code) ; aucune PR
ouverte ne chevauche cet owner zone.

Contrairement à la passe précédente (checkout vierge, `node_modules` absent,
`prisma/dev.db` 0 octet), cet environnement était déjà chaud : `node_modules/` présent,
`prisma/dev.db` déjà peuplé (1.2 Mo). Validations relancées intégralement et
indépendamment, sans aucun changement de code source :

- `pnpm typecheck` → **0 erreur**.
- `pnpm run lint` → **0 erreur**, 46 warnings pré-existants identiques (advisory).
- `pnpm test` (suite complète, wrapper `pretest`/`posttest` sqlite↔postgresql) →
  **448/448 fichiers, 5323/5323 tests**. `prisma/schema.prisma` restauré proprement en
  `postgresql` après coup (`git diff --stat prisma/schema.prisma` vide).

**Conclusion** : troisième confirmation indépendante que la baseline
typecheck/lint/test est verte et que la mission de ce batch reste satisfaite par le
commit déjà mergé `9b01f8b3` (PR #370). **Aucun changement de fichier source cette
session** — uniquement cet addendum HANDOFF. Pas de PR nécessaire (no-op sain).

**Prochain batch recommandé** : inchangé — **Batch 3 — Corrections P0 restantes** (C-05
décision produit résiduelle, C-11 cookie `sameSite`, C-13 Model B one-liner LP, T-02
décision Adrien email de reçu). Voir `DECISIONS.md` §"Questions en attente pour Adrien".

---

## Batch 4/9 (builder, Stabilization) : re-vérification sur checkout vierge — 2026-07-03

**Batch série** : builder, `batch 4/9` (série `series_recovery_hearst-defi_0`), rôle
"Stabilization" (owner zone : fixes cross-cutting lint/typecheck/test rouges, dette TS).

RELAIS relu intégralement (`PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`,
`DECISIONS.md`, `HANDOFF.md`) avant de coder. `docs/agent-file-locks.md` vérifié : 4 locks
actifs (`fix/strategy-dupkey-fix`, `feat/product-workspace-report-product-polish`,
`feat/projection-safe-input-preset`, `fix/machine-logo-visible`) — tous scopés à des
fichiers UI étroits, aucun chevauchement avec l'owner zone cross-cutting de ce batch.
`git status` de départ : propre, aucun diff en attente.

**Constat de départ** : le travail de ce batch (rendre lint/typecheck/test verts) avait
déjà été fait et **mergé dans `main`** par un run précédent — commit `9b01f8b3` (PR #370,
`loop_mr3jny8d-mr5cdfk8`), qui correspond exactement au diff décrit dans la section
"Batch 2c" ci-dessous. Cette branche (`nexus/loop_mr3jny8d-mr5e4hpx`) part de `main` et
contient déjà ce commit.

**Ce que cette session a fait** : au lieu de dupliquer, elle a ré-exécuté les 3 validations
sur un **checkout totalement vierge** (`node_modules` absent, `prisma/dev.db` à 0 octet) —
un scénario jamais testé par les runs précédents, qui trouvaient tous `node_modules` et
`dev.db` déjà en place. Ça a révélé un écart de setup (pas un bug de code) :

1. `pnpm install` — requis, `node_modules/` absent au démarrage.
2. `pnpm db:generate` — requis, sinon `tsc --noEmit` échoue en cascade (`Module
   "@prisma/client" has no exported member 'PrismaClient'/'Prisma'/'VaultDeployment'/...`
   + dizaines de `TS7006 implicit any` dérivés) — **pas de la vraie dette TS**, juste un
   client Prisma non généré.
3. `prisma/dev.db` faisait **0 octet** (jamais poussé sur ce runner) → `pnpm test` échouait
   avec `PrismaClientKnownRequestError: The table 'main.LlmRun' does not exist`. Corrigé en
   poussant le schéma sqlite (`PRISMA_PROVIDER=sqlite node scripts/prisma-provider.mjs &&
   prisma db push --accept-data-loss`, DB vide donc aucune perte réelle, provider restauré
   ensuite via `scripts/restore-prisma-provider.mjs` — même mécanisme que le wrapper
   `pretest`/`posttest` officiel). `prisma/dev.db` est gitignored (`.gitignore:37`) — aucun
   impact git.

**Validations, une fois l'environnement initialisé (aucun changement de code source)** :
- `pnpm typecheck` → **0 erreur**.
- `pnpm test` → **448/448 fichiers, 5323/5323 tests**.
- `pnpm run lint` → **0 erreur**, 46 warnings pré-existants identiques (advisory,
  inchangés vs baseline documentée).
- Recherche ciblée de dette TS non détectée par `tsc` (`@ts-ignore`/`@ts-expect-error`,
  `as any`, `as unknown as`) hors `__tests__` : 1 `@ts-expect-error` légitime
  (`studio.tsx:185`, style CSS custom property non typée par React), ~10 `as unknown as`
  tous des patterns délibérés et documentés (singleton `globalThis` anti-HMR dans
  `db.ts`/`observability/store.ts`/`simulation-store.ts`/`nav-channel.ts`, contexte mock
  diagnostics dans `safe-dry-run.ts`/`guard-diagnostics.ts`, narrow typing wallet dans
  `preflight-check.tsx`) — aucune régression, aucune dette bloquante cachée.

**Conclusion** : mission de ce batch ("rends lint/typecheck/test verts, résous la dette TS
bloquante") **déjà satisfaite** par le commit mergé `9b01f8b3`, confirmée indépendamment
sur un environnement complètement neuf. **Aucun changement de fichier source cette
session** — uniquement cet addendum HANDOFF. Pas de PR nécessaire (no-op sain).

**Risque résiduel / note pour les prochains batches** : un checkout vierge nécessite
`pnpm install && pnpm db:generate` avant `pnpm typecheck`, et `pnpm db:push` (provider
sqlite) avant un premier `pnpm test` si `prisma/dev.db` est absent ou vide. Ce n'est pas
documenté explicitement dans `PROJECT_PLAN.md` batch 2 au-delà de `db:generate` — à ajouter
si un futur agent retombe sur le même piège sur un runner fraîchement provisionné.

**Prochain batch recommandé** : inchangé — **Batch 3 — Corrections P0 restantes** (C-05
décision produit résiduelle, C-11 cookie `sameSite`, C-13 Model B one-liner LP, T-02
décision Adrien email de reçu). Voir `DECISIONS.md` §"Questions en attente pour Adrien".

---

## Batch 2c (rerun de confirmation) : re-validation indépendante — 2026-07-03

**Batch série** : builder, `batch 4/9` (série `series_recovery_hearst-defi_0`), même rôle
"Stabilization" (owner zone : fixes cross-cutting lint/typecheck/test rouges, dette TS)
que le batch 2c ci-dessous.

RELAIS relu intégralement (`PROJECT_STATE.md`, `BATCHES.md`, `HANDOFF.md`) avant de coder.
`docs/agent-file-locks.md` vérifié : aucun lock actif sur les fichiers du diff déjà présent
(`src/lib/vaults/product-display.ts`, `src/components/admin/admin-page-shell.tsx`,
`src/lib/llm/huggingface.ts`, les 9 fichiers de tests, `docs/projects/hearst-defi/*`) ; le
seul lock touchant `huggingface.ts` référencé (PR #203, HF deferral) est déjà **mergé et
libéré** — confirmé ancêtre de `HEAD` (`git merge-base --is-ancestor 5ed5f5fd HEAD`), et le
diff actuel du fichier est un ajout distinct par-dessus (garde `VITEST==="true"` en plus de
`NODE_ENV==="test"`), pas un doublon.

Le working tree contenait déjà, non commité, l'implémentation complète du batch 2c
(diff relu — cohérent avec la description ci-dessous). Plutôt que dupliquer le travail,
cette session a **ré-exécuté les 3 validations de façon indépendante** (nouvel environnement
runner, permissions non bloquées cette fois) :

- `pnpm typecheck` → **0 erreur**.
- `pnpm test` (suite complète, wrapper pretest/posttest sqlite↔postgresql) →
  **448/448 fichiers, 5323/5323 tests**, `prisma/schema.prisma` restauré proprement en
  `postgresql` (aucun diff résiduel après coup).
- `pnpm run lint` → **0 erreur**, 46 warnings pré-existants identiques (advisory, non
  bloquant), aucun nouveau warning.

**Conclusion** : le scope owner-zone "typecheck/lint/test rouges, dette TS" pour ce batch
est confirmé complet et vert avec le diff déjà présent dans le working tree — aucun
changement de code additionnel nécessaire cette session. Aucun fichier de code modifié
dans cette passe (uniquement cet addendum HANDOFF). Le diff reste non commité/non pushé/
sans PR ; laissé pour l'étape d'intégration suivante (hors scope de ce rôle "builder").

---

## Batch 2c — Stabilization : typecheck/test verts, dette TS bloquante — 2026-07-03

**Batch série** : builder, `batch 4/9` (série `series_recovery_hearst-defi_0`), rôle
"Stabilization" (owner zone : fixes cross-cutting lint/typecheck/test rouges, dette TS).
**Batch projet** : équivaut au Batch 2 (Baseline Verification) du `PROJECT_PLAN.md`,
enregistré ici comme 2c car batch 2/2b avaient déjà consommé ce numéro pour le Truth
Audit / Data Truth.
**Date** : 2026-07-03
**Agent** : nexus builder (+ 1 agent délégué pour l'investigation/fix des 9 fichiers rouges)

### RELAIS (avant code)

Lu intégralement : `PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`, `DECISIONS.md`,
`HANDOFF.md`. Vérifié `docs/agent-file-locks.md` : aucun lock actif sur les fichiers
finalement touchés (`src/lib/vaults/product-display.ts`, `src/components/admin/
admin-page-shell.tsx`, `src/lib/llm/huggingface.ts`, les 9 fichiers de tests) — aucun
conflit avec les locks actifs listés (`fix/strategy-dupkey-fix`,
`feat/product-workspace-report-product-polish`, `feat/projection-safe-input-preset`,
`fix/machine-logo-visible`). Batch 2/2b (dont dépendait ce batch selon `PROJECT_PLAN.md`)
n'était pas mergé (PR "à créer") mais son diff était déjà présent, cohérent, et relu — pas
de blocage réel.

### État de départ trouvé (avant toute action)

Le working tree contenait déjà, non commité :
- `prisma/schema.prisma` : `datasource.provider` bloqué sur `"sqlite"` — résidu d'un
  `pnpm test` précédent interrompu avant son hook `posttest` (`restore-prisma-provider.mjs`).
  **Fichier interdit pour ce batch** — corrigé en relançant directement
  `node scripts/restore-prisma-provider.mjs` (aucune édition manuelle du schema), qui l'a
  remis sur `"postgresql"` proprement. Aucun serveur dev local actif sur :4105 au moment
  du fix (vérifié avant).
- `src/lib/agents/__tests__/{agent-user-context,user-context}.test.ts` +
  `src/lib/llm/huggingface.ts` : diff déjà présent et correct (chaînes FR→EN déjà
  synchronisées avec `user-context.ts` ; garde `VITEST=true` en plus de
  `NODE_ENV==="test"` dans `huggingface.ts`) — laissés tels quels, intégrés au commit final.

### Ce qui a été fait

1. `pnpm typecheck` → **0 erreur** (déjà vert après le fix schema.prisma).
2. `pnpm test` (suite complète, via le wrapper `pretest`/`posttest` sqlite↔postgresql) →
   **9 fichiers rouges / 15 tests rouges** sur 448 fichiers / 5323 tests.
3. Root-cause par fichier (investigation déléguée à un agent, vérifiée moi-même sur les
   2 fix source avant clôture) :
   - **7 fichiers = test stale FR→EN** : une migration antérieure des system prompts LLM
     (`src/lib/llm/prompts.ts`, `src/lib/llm/tools/registry.ts`) était passée du français à
     l'anglais côté source, mais plusieurs suites de tests avaient été laissées sur les
     anciennes chaînes françaises (`"ALLOCATIONS CANONIQUES"`, `"INTENT : question
     ÉDUCATIVE read-only"`, `"fourchette"`, `"non garanti"`, `/mot interdit\|garanti/i`,
     etc.). Chaque assertion a été mise à jour vers son équivalent anglais réel présent
     dans le source (vérifié par grep direct sur `prompts.ts`/`registry.ts` avant édition,
     pas de suppression/affaiblissement d'assertion) :
     `calibration.test.ts`, `admin-context.test.ts`, `admin-tools-registry.test.ts`,
     `chat-p2-coherence.test.ts`, `route.router-stabilization.test.ts`, et les 2 fichiers
     `user-context`/`agent-user-context` déjà présents dans le diff de départ.
   - **`latest-study-run.test.ts`** : faux positif — la migration EN a fait que le
     disclaimer obligatoire "not guaranteed" (non-négociable #10) contient littéralement
     le mot "guaranteed", ce qui collisionnait avec une assertion `not.toMatch(/\bguaranteed\b/i)`
     trop large. Comportement source correct et requis ; test corrigé pour retirer la
     négation honnête avant de vérifier l'absence d'une promesse positive (même pattern
     que le strip déjà existant pour "unaudited" dans le même test).
   - **2 vrais bugs source** (pas de la traduction) :
     - `src/lib/vaults/product-display.ts` — `ADMIN_MONTH_DAY` (`Intl.DateTimeFormat`)
       n'avait pas de `timeZone` fixé → une date UTC minuit pouvait s'afficher la veille
       selon le fuseau local de la machine d'exécution (ex. "Jun 11" au lieu de "Jun 12"
       en PDT). Fix : `timeZone: "UTC"`, aligné sur les autres formatters UTC-pinnés du
       code (`nav-bar-chart.ts`, `memo-data.ts`).
     - `src/components/admin/admin-page-shell.tsx` — `AdminSectionCard` rendait son
       sous-titre de section en `<h1 className="ct-section-title">` alors que tous les
       autres consommateurs de `ct-section-title` utilisent `<h2>` ; sur le Proof Center en
       état vide, ça produisait 3 `<h1>` sur la page au lieu d'1 (hiérarchie de heading
       cassée). Fix : `<h1>` → `<h2>`, un seul caractère de balise changé.
4. Validation finale (relancée moi-même, indépendamment de l'agent délégué) :
   `pnpm test` → **448/448 fichiers, 5323/5323 tests** ; `pnpm typecheck` → **0 erreur** ;
   `prisma/schema.prisma` confirmé propre (`postgresql`, aucun diff).
5. `pnpm run lint` : **0 erreur**, 46 warnings pré-existants (`no-unused-vars`,
   `no-explicit-any`, eslint-disable inutilisés) — advisory (`eslint src || true`, pas un
   gate CI par `CLAUDE.md`), non touché ce batch (hors scope "rouge").

### Fichiers modifiés

| Fichier | Nature |
|---|---|
| `src/lib/vaults/product-display.ts` | Fix source — `timeZone: "UTC"` sur `ADMIN_MONTH_DAY` |
| `src/components/admin/admin-page-shell.tsx` | Fix source — `<h1>`→`<h2>` sous-titre de section |
| `src/lib/llm/huggingface.ts` | Pré-existant (garde `VITEST=true`), conservé tel quel |
| `src/lib/agents/__tests__/agent-user-context.test.ts` | Pré-existant, conservé tel quel |
| `src/lib/agents/__tests__/user-context.test.ts` | Pré-existant, conservé tel quel |
| `src/lib/agents/__tests__/calibration.test.ts` | Test stale FR→EN |
| `src/lib/llm/__tests__/admin-context.test.ts` | Test stale FR→EN |
| `src/lib/llm/__tests__/admin-tools-registry.test.ts` | Test stale FR→EN |
| `src/lib/llm/__tests__/chat-p2-coherence.test.ts` | Test stale FR→EN |
| `src/lib/projection/__tests__/latest-study-run.test.ts` | Test — assertion trop large corrigée |
| `src/app/api/cockpit-chat/__tests__/route.router-stabilization.test.ts` | Test stale FR→EN |
| `docs/projects/hearst-defi/PROJECT_STATE.md` | §2 baseline rafraîchie (typecheck/test → ✅ vérifiés) |
| `docs/projects/hearst-defi/BATCHES.md` | Ligne 2c ajoutée (FAIT) |
| `docs/projects/hearst-defi/HANDOFF.md` | Ce fichier — section batch 2c ajoutée |

**Fichiers exclus (owner zone respectée)** : aucun `prisma/**` (migrations) édité — seul
le résidu `schema.prisma` a été restauré via le script officiel, pas d'édition manuelle ;
aucune UI redesign (2 fixes source = un seul attribut/une seule balise, comportement
existant préservé, pas de restylage) ; `.github/workflows/**`, secrets/`.env*`,
`vercel.json` non touchés ; `src/lib/llm/tools/registry.ts` et `src/app/api/cockpit-chat/
route.ts` lus mais non édités (référence seulement, pour vérifier les chaînes source
avant de corriger les tests).

### Validations lancées

- `pnpm typecheck` → 0 erreur (lancé 2×, avant et après les fixs).
- `pnpm test` (suite complète) → 448/448 fichiers, 5323/5323 tests (lancé par l'agent
  délégué puis re-lancé indépendamment par l'agent orchestrateur pour confirmation).
- `pnpm run lint` → 0 erreur, 46 warnings pré-existants (non bloquant, non touché).
- `forge test` — **non relancé** ce batch (hors owner zone TS/test ; dernière vérité
  toujours 73/73 au 2026-05-29 par `PROJECT_STATE.md`).
- `pnpm build` — **non relancé** ce batch (hors scope, coûteux ; typecheck+test suffisent
  pour la stabilisation demandée).

### Risques

| Risque | Impact | Note |
|---|---|---|
| `pnpm build` non vérifié ce batch | Faible-Moyen | typecheck 0 erreur réduit le risque, mais un build Next complet peut révéler des soucis distincts (bundling, RSC boundaries) |
| `forge test` non relancé | Faible | Contrats gelés depuis `898991c`, aucun fichier `contracts/**` touché ce batch |
| 46 warnings ESLint pré-existants non traités | Faible | Advisory uniquement, hors scope "rouge" de ce batch |

### Aucune régression de comportement attendue

Les 2 fixes source sont chacun un changement d'un seul attribut/tag, alignés sur des
conventions déjà établies ailleurs dans le code (formatters UTC-pinnés, hiérarchie
`h2` pour `ct-section-title`) — pas de nouvelle abstraction, pas de fallback ajouté.

### Prochain batch recommandé

**Batch 3 — Corrections P0 restantes** (déjà planifié dans `PROJECT_PLAN.md`, prérequis
satisfait par ce batch : baseline typecheck/test maintenant vérifiée verte) :
- C-05 (décision produit résiduelle sur `tax/page.tsx`), C-11 (cookie `sameSite`), C-13
  (Model B one-liner LP), T-02 (décision Adrien sur promesse email reçu). Voir
  `DECISIONS.md` §"Questions en attente pour Adrien".

---

## Batch 2b (2e rerun de vérification) : extension du spot-check — 2026-07-03

**Batch série** : builder, `batch 5/9` (série `series_recovery_hearst-defi_0`).
Troisième invocation de loop sur ce même scope owner-zone. RELAIS relu
intégralement (`PROJECT_STATE.md`, `BATCHES.md`, `DECISIONS.md`, `HANDOFF.md`) ;
`docs/agent-file-locks.md` vérifié — aucun lock actif sur `src/lib/portfolio/`,
`src/lib/product-strategies/`, ou `docs/projects/hearst-defi/` (seul lock
adjacent trouvé : `src/lib/agents/apy-range.ts` par un autre agent, hors
scope de ce batch). Le diff non commité de `tax.ts` + 3 fichiers de tests a
été relu ligne à ligne une seconde fois (logique `isLive`, cohérence des
guards `POINT 6`, cohérence entre `tax-preview-loader.ts` / `portfolio/tax/page.tsx`
et les assertions de test) — toujours correct, rien à changer.

Plutôt que de re-dupliquer le spot-check déjà fait sur `src/lib/data/**`,
`src/lib/portfolio/**`, `src/app/api/**`, `src/lib/agents/**`,
`src/lib/onchain/**` (rerun précédent), cette session a étendu la couverture
à un module de la couche données/API **pas encore audité** : `src/lib/product-strategies/**`
(Strategies Hub — collateral rebalancing, allocation advisor, data lab,
mergé fin juin, PR #350-358). Agent Explore dédié, lecture complète de
`strategies.config.ts`, `validate.ts`, `types.ts`, `select.ts`,
`from-objective.ts`, `lab-colors.ts`, `index.ts` + `src/lib/strategy-data-lab/*`
(collateral-rebalancing, lab-defaults) consommés par ce module.

**Résultat : aucun finding.** Toutes les valeurs numériques (allocations bps,
ranges de performance, prix BTC de départ des simulations) sont structurées
dans des objets `ScenarioAssumptions` / constantes de base explicitement
nommées, jamais présentées comme des données live ; `validate.ts` fait déjà
respecter le vocabulaire non-négociable #5 (mots interdits) sur toute la
config ; zéro `Math.random()`, zéro TODO/FIXME de câblage data incomplet.

**Validations** : `pnpm vitest run` sur les 3 fichiers ciblés toujours
bloqué par permissions runner (`This command requires approval`) — identique
aux 2 passes précédentes, retenté explicitement cette session, même blocage.

**Conclusion** : owner-zone "données/API — sources réelles, gardes anti-mock"
reste complète. Aucun changement de code additionnel cette session (au-delà
du diff déjà présent dans le working tree). Couverture d'audit étendue à
`product-strategies` = valeur ajoutée réelle de cette 3e passe, même si le
résultat est "rien à corriger".

---

## Batch 2b (rerun de vérification) : confirmation indépendante — 2026-07-03

**Batch série** : builder, `batch 5/9` (série `series_recovery_hearst-defi_0`).
Cette invocation de loop a repris exactement le même scope que le batch 2b
ci-dessous (RELAIS relu intégralement : `PROJECT_STATE.md`, `BATCHES.md`,
`DECISIONS.md`, `HANDOFF.md` ; `docs/agent-file-locks.md` vérifié — aucun
lock actif sur `src/lib/portfolio/` ni `docs/projects/hearst-defi/`). Le
working tree contenait déjà, non commité, l'implémentation complète du
batch 2b (`tax.ts` + 3 fichiers de tests + docs — diff relu ligne à ligne,
cohérent avec la description ci-dessous).

Plutôt que dupliquer ce travail, cette session a :
- Relu et validé manuellement le diff existant de `src/lib/portfolio/tax.ts`
  (logique `isLive` correcte, couvre le cas `0` explicite).
- Lancé un spot-check indépendant (agent Explore dédié) sur tout
  `src/lib/data/**`, `src/lib/portfolio/**` (hors `tax.ts`), `src/app/api/**`,
  `src/lib/agents/**` et `src/lib/onchain/**`, à la recherche de mocks non
  signalés **au-delà** des findings T-01→T-12 déjà répertoriés. **Résultat :
  aucun nouveau finding.** Tous les fallbacks observés (`defillama.ts`,
  `fear-greed.ts`, `stablecoin-prices.ts`, `portfolio.ts`, `dashboard.ts`,
  `risk-framework.ts`, `cockpit.ts`, `history.ts`, `energy-cost.ts`) portent
  déjà un champ `source`/`provenance`/`stale` explicite ; `proof-center.ts`,
  `proofs.ts` et `onchain/vault.ts` lisent des données réelles (Prisma /
  contrats on-chain via viem) sans fabrication.
- Re-confirmé le blocage permissions runner sur `pnpm typecheck` / `pnpm test`
  (identique aux batches 2 et 2b précédents — aucune commande de validation
  n'a pu s'exécuter dans ce contexte headless).

**Conclusion** : le scope owner-zone "données/API — sources réelles, gardes
anti-mock" pour ce batch est complet avec le diff déjà présent dans le
working tree ; aucun changement de code additionnel nécessaire cette session.
Aucun fichier de code modifié dans cette passe (uniquement cet addendum
HANDOFF). **Risque résiduel inchangé** : validations (`typecheck`/`test`) à
lancer avant merge dès que les permissions runner le permettent.

---

## Batch 2b : Data Truth — anti-mock guard (couche données/API)

**Batch série** : builder, `batch 5/9` (série `series_recovery_hearst-defi_0`)
**Batch projet** : 2b/9 — Builder (owner zone : couche données/API, sources réelles, gardes anti-mock)
**Role** : Reprendre les findings T-01→T-12 du Truth Audit (batch 2) et, pour ceux qui relèvent
de la couche données (pas UI/business decision), remplacer le mock non signalé par une source
réelle ou un état honnête. Aucune mutation de données prod.
**Date** : 2026-07-03
**Agent** : nexus builder

### Ce qui a été fait

- RELAIS lu : `PROJECT_PLAN.md`, `PROJECT_STATE.md`, `BATCHES.md`, `DECISIONS.md`, `HANDOFF.md`
  (batch 1 + batch 2 Truth Audit). Vérifié : batch 1 mergé (PR #361), aucune PR ouverte ne
  chevauche l'owner zone (`docs/agent-file-locks.md` inspecté — aucun lock actif sur
  `src/lib/portfolio/`, `src/lib/data/`, ou `docs/projects/hearst-defi/`).
- Revue systématique des 12 findings T-01→T-12 (table complète dans `DECISIONS.md` §"Rapport
  batch Data Truth") pour trier ce qui est réellement dans l'owner zone "données/API" vs UI/décision
  produit/migration (hors scope de ce batch) :
  - **T-01** (tax preview fake data) — seul finding réellement dans l'owner zone. Corrigé (détail
    ci-dessous).
  - **T-05, T-06, T-07, T-10** — vérifiés déjà honnêtement signalés/guardés en code (badges
    "estimated"/"simulated", disclaimer on-chain mock, allowlist fail-closed, refus prod sans clé
    API) — aucune action de code nécessaire, confirmé par lecture directe des fichiers cités.
  - **T-02, T-03, T-04, T-08, T-09, T-11, T-12** — hors owner zone (UI pages interdites, décision
    produit, migration Prisma interdite) — laissés pour batch 3/4/6/7/8 selon `BATCHES.md`.
- **Correction T-01** — `src/lib/portfolio/tax.ts` :
  - Ajout du champ `dataSource: "live" | "stub"` sur `TaxPreview` (non-négociable #2 — provenance
    badge sur chaque métrique). `"live"` uniquement quand les 3 overrides réels
    (`actualInterestIncomeUsd`, `actualPrincipalUsd`, `actualAccruedYieldUsd`) sont fournis
    explicitement (y compris `0` pour un nouvel investisseur) ; `"stub"` sinon.
  - Aucun changement de comportement pour les appelants existants — `portfolio/tax/page.tsx` et
    `tax-preview-loader.ts` passent déjà les 3 overrides réels → `dataSource: "live"` dans les
    deux cas. Changement additif.
  - Le composant historiquement cité par le sprint correctness (`tax-docs-drawer.tsx:243-259`)
    n'existe plus (supprimé au refactor `79c9b2c2`) ; la seule surface LP-facing vivante
    (`portfolio/tax/page.tsx`) n'emprunte déjà plus le chemin stub — voir détail complet dans
    `DECISIONS.md`.
- **Guard de régression** ajouté dans `src/lib/__tests__/data-honesty-guards.test.ts` (POINT 6,
  lecture statique du code source, même convention que POINT 1-5) — vérifie que
  `portfolio/tax/page.tsx` et `tax-preview-loader.ts` continuent de fournir les 3 overrides réels.
- **Tests unitaires** ajoutés dans `src/lib/portfolio/__tests__/tax.test.ts` (bloc 19, 5 cas :
  aucun override → stub, override partiel → stub, 3 overrides dont valeurs à `0` → live) +
  assertion `dataSource: "live"` ajoutée dans `tax-preview-loader.test.ts`.
- Mise à jour `DECISIONS.md` (rapport complet batch Data Truth + table de statut C-items) et
  `BATCHES.md` (batch 2b → FAIT).
- Spot-check indépendant (hors scope T-01→T-12) sur `src/lib/data/{vaults,stablecoin-prices,
  energy-cost}.ts` pour chercher d'autres mocks non signalés dans l'owner zone — rien trouvé :
  placeholders déjà explicitement filtrés (`isPlaceholderVault`) ou marqués `stale`/`fallback`.

### Fichiers modifiés

| Fichier | Action |
|---|---|
| `src/lib/portfolio/tax.ts` | Ajout `dataSource: "live"\|"stub"` sur `TaxPreview` + logique `isLive` |
| `src/lib/__tests__/data-honesty-guards.test.ts` | POINT 6 — guard régression provenance tax |
| `src/lib/portfolio/__tests__/tax.test.ts` | Bloc 19 (5 cas) — provenance `dataSource` |
| `src/lib/portfolio/__tests__/tax-preview-loader.test.ts` | Assertion `dataSource: "live"` ajoutée |
| `docs/projects/hearst-defi/DECISIONS.md` | Rapport batch Data Truth (T-01→T-12 triés, détail T-01) |
| `docs/projects/hearst-defi/BATCHES.md` | Batch 2b → ✅ FAIT |
| `docs/projects/hearst-defi/PROJECT_STATE.md` | §5 rafraîchi (C-05 → ⚠️ partiel, cf. ci-dessous) |
| `docs/projects/hearst-defi/HANDOFF.md` | Ce fichier — section batch 2b ajoutée |

**Fichiers exclus (hors owner zone, non touchés)** : toute UI page (`tax-docs-drawer.tsx` n'existe
plus de toute façon), `prisma/**`, `.github/workflows/**`, secrets/`.env*`, `vercel.json`.

### Ce qui reste

- **C-05** passe de ❌ à ⚠️ PARTIEL (pas ✅) : le gap de provenance type-system est comblé, mais la
  question produit reste ouverte pour batch 3 — faut-il encore désactiver/disclaim le trigger sur
  `portfolio/tax/page.tsx` actuel (au-delà du footer "Preview only" déjà présent) ? Décision Adrien.
- T-02, T-03, T-04 restent ouverts (hors owner zone ce batch) — cf. `DECISIONS.md` pour scope batch 3.
- Aucune régression de comportement attendue ; changement additif pur côté type/valeur retournée.

### Validations lancées

- **Bloquées par permissions runner** (même contrainte que batch 2 — confirmé à nouveau ce batch) :
  `pnpm typecheck`, `pnpm test`, `node --check` retournent tous "this command requires approval"
  en exécution headless, aucune approbation possible dans ce contexte. Seules les commandes
  read-only (`git status`, `git diff`, `ls`, `grep`, lecture de fichiers) ont pu être exécutées.
- **Revue manuelle à la place** : diff complet de `tax.ts` relu ligne à ligne (logique `isLive`
  correcte — les 3 `!== undefined` couvrent le cas `0` explicite requis par le test 19e) ; les 3
  fichiers de test relus pour cohérence de style avec les tests existants (mêmes fixtures
  `FIXED_USER_ID`/`FIXED_YEAR`, même style `describe`/`it`).
  **Risque résiduel** : la suite n'a pas été exécutée dans cette session — recommander de lancer
  `pnpm typecheck && pnpm test src/lib/portfolio/__tests__/tax.test.ts
  src/lib/portfolio/__tests__/tax-preview-loader.test.ts
  src/lib/__tests__/data-honesty-guards.test.ts` dès que les permissions runner le permettent,
  avant merge.

### Risques

| Risque | Impact | Note |
|---|---|---|
| Validations non exécutées (permissions runner) | Moyen | Changement de type additif et localisé — risque de régression faible, mais à valider avant merge |
| C-05 encore ⚠️ (pas ✅) | Faible-Moyen | Décision produit résiduelle, pas un risque légal — le risque CRITIQUE (chiffres inventés non distingables) est neutralisé |

### Prochain batch recommandé

**Batch 3 — Corrections P0 restantes** (déjà planifié, scope réduit par ce batch) :
- C-05 (décision produit résiduelle sur `tax/page.tsx`), C-11 (cookie `sameSite`), C-13 (Model B
  one-liner LP), T-02 (décision Adrien sur promesse email reçu). Voir `DECISIONS.md` §"Questions
  en attente pour Adrien" pour les 2 décisions bloquantes avant batch 3.

---

## Batch 2 : Truth Audit

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
