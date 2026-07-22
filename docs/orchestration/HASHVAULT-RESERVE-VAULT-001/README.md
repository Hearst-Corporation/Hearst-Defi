# HASHVAULT-RESERVE-VAULT-001 — Pack d'orchestration

**Objectif** : pivoter / stabiliser Hearst Connect vers **Hearst Bitcoin Reserve Vault — Series 1**
(BTC accumulation, aucune distribution cash périodique, aucune promesse d'APY, **aucun
borrow / LTV / liquidation pour Series 1**), en cohérence avec `PermissionedDynaVault v2.1`,
**ADR-019**, **methodology v3.0**, le moteur de projection mining-note, le cockpit portfolio,
le proof center, le chat admin et la demo Zandbank.

**Mode** : `prepare`. Ce dossier est un **pack de missions**, pas une exécution. Aucune ligne de
code n'a été modifiée. Aucun commit / push. Le pack a été produit par une reconnaissance
**read-only** de 6 lecteurs parallèles (contrats/chain, engine, cockpit, proof/admin/chat, data,
docs/demo), chaque constat ancré `fichier:ligne`.

**Généré le** : 2026-07-18 · **Branche de reco** : `release/hc-btc-backend-cutover` · **HEAD** : `eca69561`

---

## Le constat central en une phrase

Le pivot produit (yield vault → mining note) est **déjà à 60-70 % fait au niveau du modèle
de vérité** (ADR-019, methodology v3.0, README, specs 00/04/05/07, PDF memo corps, prompts
admin, agent Investor Memo, route `/btc`, `/dashboard`, engine `mining-note-projection.ts`).
Ce qui reste est un **travail de convergence** : purger les surfaces LEGACY qui portent
encore le vocabulaire *yield / APY / distribution mensuelle / borrow-LTV-liquidation*, et
**créer** ce que le mining note exige et qui n'existe pas encore (models take-profit /
curtailment / BTC-accumulation, ingest on-chain, guards chat BTC-accumulation).

**Décisions produit — ACTÉES 2026-07-18** (registre gelé : `00-decisions-required.md`) :
1. **Rebrand VALIDÉ** → "Hearst Bitcoin Reserve Vault — Series 1". **ADR-020 acté**. M9 en Vague 3
   après convergence des fondations.
2. **Périmètre borrow/LTV = Option B (deux produits distincts)**. Series 1 = strictement no borrow /
   no LTV / no liquidation / no distribution cash / no fixed APY. Le levier (Morpho/collateral)
   reste **uniquement** en produit distinct / sandbox admin / research — jamais Series 1, jamais
   Zandbank, jamais Proof Center Series 1.
3. **Architecture front/back** (nouveau) → **Front = consommateur, Backend séparé = source of
   truth**. Aucun calcul critique Series 1 propriétaire du front. Détail : `04-architecture-front-back.md`.
   ⚠️ Le backend `gpu1-backend/` est **spécifié mais absent du disque** — on prépare les contrats
   API, on ne matérialise pas le service sans feu vert (STOP posé).

---

## Fichiers du pack

| Fichier | Contenu |
|---|---|
| `README.md` | Ce fichier — index + constat central. |
| `00-decisions-required.md` | Registre des 3 décisions produit — **ACTÉES 2026-07-18**. |
| `01-target-model.md` | Le modèle cible Series 1 (invariants, KPI, ce qui meurt, ce qui naît). |
| `02-cartography.md` | La cartographie brute des 6 axes (`fichier:ligne`), source des missions. |
| `03-execution-plan.md` | Séquencement des missions : vagues, dépendances, ownership, anti-collision. |
| `04-architecture-front-back.md` | Séparation front (consommateur) / back (source of truth), décision #3. |
| `missions/M1-*.md` … `M12-*.md` | Les 12 missions parallélisables, une par domaine, autoportantes. |

## Les 9 missions (vue d'ensemble)

| # | Mission | Domaine / owner | Vague | Dépend de |
|---|---|---|---|---|
| **M1** | Engine — purge yield/APY, MC BTC-accumulation | `engine-dev` · `src/lib/engine/*` | 1 | — |
| **M2** | Data — DROP distribution, CREATE take-profit/curtailment/BTC-accum, seed, env | `agent-dev`+backend · `prisma/*`, `src/lib/inngest/*`, `env.ts` | 1 | — |
| **M3** | Smart-contract — deploy DynaVault Base Sepolia, vérif ABI/decimals, getters manquants | `sc-dev` · `contracts/*`, `src/lib/chain/*` | 1 | — |
| **M4** | Cockpit — term-sheet/deposit/position → KPI BTC delivered + acquisition cost | `ui-dev` · `src/app/(product)/*`, `src/components/vaults|portfolio/*` | 2 | M1, M2 |
| **M5** | Retrait borrow/LTV/liquidation des surfaces Series 1 + sandbox `preview` | `ui-dev` · `src/app/(product)/portfolio/preview/*`, `src/components/portfolio/*` | 2 | décision #2 |
| **M6** | Chat + 4 agents — guards BTC-accum, prompts, Scenario Narrative | `agent-dev` · `src/lib/llm/*`, `src/lib/agents/*` | 2 | M1 |
| **M7** | Proof Center + rail admin distribution — retrait/refonte | `ui-dev`+backend · `src/app/admin/distributions/*`, `src/lib/distribution/*`, proof-center | 2 | M2 |
| **M8** | Docs + demo Zandbank — realign specs 01/02/99, roadmap, fixture Zand | backend · `docs/spec/*`, `docs/roadmap.json`, `src/lib/demo/*` | 2 | M1, M2 |
| **M9** | Rebrand "Bitcoin Reserve Vault — Series 1" (ADR-020 acté) | backend · wordmarks legacy | 3 | M4-M8 convergés |
| **M10** | Backend source-of-truth — DTOs Series 1, calcul serveur, contract indexing | backend · `gpu1-backend/` (à créer) | 1 (prépa) → 2 | M2, décision #3 |
| **M11** | Front API-contract — client + DTOs, surfaces Series 1 consomment le contrat | `ui-dev` · `src/lib/<client>` | 2 | M10 |
| **M12** | Intégration front/back — proxy strangler par domaine, parité, rollback | backend+`ui-dev` | 2 | M10, M11 |

**Vague 1** (M1/M2/M3 + **M10 préparation**) = fondations sans collision + contrats API préparés.
**Vague 2** (M4-M8, M10 matérialisation, M11, M12) = surfaces + backend + intégration.
**Vague 3** (M9) = rebrand cosmétique en dernier, une fois le modèle convergé.

> ⚠️ **M10 en Vague 1 = PRÉPARATION seule** (DTOs + frontière). La **matérialisation** du service
> `gpu1-backend/` (absent du disque) attend un feu vert explicite d'Adrien sur le package/repo exact
> (STOP posé, voir `04-architecture-front-back.md`).

> Ce pack s'arrête ici. L'exécution (worktrees, locks, commits, gate) suit le workflow
> multi-agent du `CLAUDE.md` local et se déclenche sur décision explicite d'Adrien.
