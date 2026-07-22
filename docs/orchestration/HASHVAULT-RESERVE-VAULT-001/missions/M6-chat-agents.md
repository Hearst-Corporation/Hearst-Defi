# M6 — Chat + 4 agents : guards BTC-accumulation, prompts, Scenario Narrative

**Owner** : `agent-dev` · **Vague** : 2 · **Dépend de** : M1 (vocabulaire engine) ·
**Périmètre** : `src/lib/llm/*`, `src/lib/agents/*` (prompts, guards, 4 agents)

## Objectif
Étendre les guards compliance au vocabulaire BTC-accumulation (aujourd'hui APY/yield-only), purger
le prompt chat default de ses restes yield, et repivoter les agents encore yield-centric
(Scenario Narrative en priorité).

## Contexte
Voir `02-cartography.md §D`. `src/lib/llm/tools/registry.ts` est **single-owner** — réserver le
lock. Provider = OpenAI GPT-4.1 (ADR-011). Kill-switch `CHAT_MASTER_AGENT` sain — ne pas toucher.

## Tâches (fichier:ligne)
1. **Guards BTC-accumulation** — le trou principal : `agents/apy-range.ts` (`hasSinglePointApy`)
   est ancré YIELD/% et **ne couvre pas** un "single-point BTC accumulated" ni une promesse d'un
   montant de BTC hors %. Un "accumulation de 1,4 BTC" single-point **passe** (attrapé seulement si
   "garanti"). Étendre : `agents/apy-range.ts`, `llm/output-guard.ts:64` (hold-back keyword
   yield-centric), `llm/semantic-guard.ts:32` (`RETURN_PROMISE_HYPOTHESES`) → ajouter un guard
   "single-point BTC-accumulation" + promesses d'accumulation. Garder le guard APY existant (le
   produit à levier distinct l'utilise encore).
2. **`COCKPIT_DEFAULT_SYSTEM_PROMPT`** (`prompts.ts:137`) : purger "yield sources" (`:137,89`),
   "Stressed APY" (`:206`), route `/admin/distributions` (`:172`) au profit du cadrage accumulation
   déjà présent dans `COCKPIT_ADMIN_SYSTEM_PROMPT:98-100` (40/27/33, no distribution/no APY).
3. **Scenario Narrative** (`scenario-narrative.ts:115,119,150,157-159`) — **le plus yield-centric**,
   prioritaire : repivoter PTAI (`projection`=range BTC, pas APY), `apy_range` → range BTC accumulé,
   `yield_contribution_bps` → contribution par pocket en accumulation. C'est l'agent qui narre la
   BTC-accumulation (spec produit).
4. **Risk Explanation** (`risk-explanation.ts:102-105`) : cadrer sur le modèle accumulation
   (assumptions BTC-price-in-range OK, mais expliciter le cadre note d'accumulation).
5. **Mining Health** (`mining-health.ts:105`) : mining-natif ✓, ajouter le cadrage "accumulation
   engine" (le mining alimente l'accumulation, pas un yield).
6. **Investor Memo** (`investor-memo.ts`) : **déjà pivoté** ✓. Résidus mineurs : "APY is ALWAYS a
   range" (`:135`), champ `apy range` (`:55`), `distribution-coverage ratio` (`:59`) → recadrer en
   range BTC / reserve-health.

## Invariants
- **Aucune action financière/custodiale depuis le chat** (ADR-012/017/018). Writes = draft-only,
  HITL 2-temps. Ne pas y toucher.
- **Range #1** ; **mots interdits #5** (garder "not guaranteed" permis).
- Prompt system server-side, pas d'override client.
- Ne pas casser le kill-switch ni le moteur unique `runMasterAgentTurn`.

## Gate
`pnpm typecheck && pnpm test` (dont les tests guards `apy-range` / `forbidden-words` + tests agents).
Ajouter des tests guard : un "single-point BTC accumulated" doit être **bloqué** ; "not guaranteed"
doit **passer**.

## Définition de fini
Guards attrapent le single-point BTC-accumulation ; prompt default purgé de yield/APY/distribution ;
Scenario Narrative + Risk + Mining Health cadrés accumulation ; Investor Memo résidus nettoyés ;
tests guards nouveaux verts.
