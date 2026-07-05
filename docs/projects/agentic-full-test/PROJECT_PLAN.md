# PROJECT_PLAN.md — Agentic Full Test Series (`series_opus_agentic_hearst-defi`)

> Établi le 2026-07-04 par le batch 1/6 (architect, read-only, no code).
> Lecture préalable pour les batchs 2-6 : ce fichier + `INVENTORY.md` + `COVERAGE_MATRIX.md`
> + `BATCHES.md`. Voir aussi `docs/agentic/*.md` (source primaire par composant, citée
> dans `INVENTORY.md`), `AGENTS.md` (routing keystone) et la série sœur
> `docs/projects/outreach-audit/` (`series_opus_audit_hearst-defi`, même famille de
> composition `opus`, déjà en cours — voir §Coordination ci-dessous).

## Contexte

La "ligne agentique" de Hearst Connect couvre deux couches (détail complet :
`INVENTORY.md`) :

- **4 agents batch structurés** (Scenario Narrative, Mining Health, Risk Explanation,
  Investor Memo) + le **moteur de chat cockpit unique** (`runChatAgent`, ADR-017, 3 modes :
  LP Master Agent / Admin Ops / Review-facilitator) + le **Master Agent outreach**
  (classifieur d'intent déterministe) — tous pilotés par OpenAI GPT-4.1 (ADR-011).
- **15 composants d'orchestration/observabilité** sous `src/lib/agentic/*` : routeur
  d'intent déterministe, matrice de disponibilité d'action, frontière d'outils, simulation
  de crews/swarms, observabilité (routeur + simulations), quality review, reporting crew,
  swarm de projection produit, control center + control tower visuel.

C'est un système déjà largement implémenté et testé unitairement (~135 fichiers de test
Vitest recensés par ce batch entre `src/lib/agentic/__tests__`, `src/lib/agents/__tests__`,
`src/lib/llm/__tests__` et les routes API `__tests__` — voir `COVERAGE_MATRIX.md`), mais
dont la couverture par **formulation d'entrée** (valides / rejets / cas limites) et par
**appel réel au LLM déployé** n'a jamais été cartographiée de façon centralisée. C'est
l'objet de cette série.

## Objectif de la série (6 batchs)

1. **Batch 1 (architect, ce batch)** — inventaire de la ligne agentique, protocole de
   test (budget DLLM, matrice des formulations), plan de découpage en batchs disjoints,
   squelette du rapport final et du futur schéma complet. Aucun code.
2. **Batchs 2-6 (executants)** — chacun prend une zone disjointe (voir `BATCHES.md`),
   écrit/complète des tests dans son owner-zone uniquement, sans jamais dépasser le
   budget DLLM alloué à sa zone (voir §Budget ci-dessous), sans toucher au code
   applicatif hors ce qui est strictement nécessaire pour rendre un composant testable
   (ex. injection de seed) — et seulement avec accord explicite si ça sort du strict test.

**Exécution strictement séquentielle et manuelle** (`executionMode: sequential-manual`) —
Adrien lance chaque loop l'une après l'autre ; aucun dispatch automatique de la loop
suivante par un batch précédent.

## Coordination avec la série sœur `outreach-audit`

`docs/projects/outreach-audit/` (série `series_opus_audit_hearst-defi`) audite déjà en
détail le pipeline Outreach complet, y compris sa couche agentique : Master Agent
(`outreach-master-agent.ts`, `outreach-master-semantic.ts`), swarm outreach
(`swarms/outreach-swarm-*.ts`), canvas (`canvas/outreach-*.ts`), intégration agentique
(`agentic/outreach-integration.ts`). **Cette série (`agentic-full-test`) ne redouble pas
ce travail** — les fichiers listés ci-dessus restent sous l'owner-zone de
`outreach-audit` (ses batchs 3-4, zones 2-3, voir son `BATCHES.md`). Si un batch de cette
série constate qu'un test outreach-spécifique manque dans le périmètre de l'agentic
generic (ex. comment le swarm générique traite `outreach_governed_swarm` en tant que
*swarm*, par opposition à la logique métier outreach elle-même), il teste la partie
générique (framework swarm) et laisse la partie outreach-spécifique à l'autre série —
frontière détaillée par fichier dans `BATCHES.md`.

## Protocole de test — budget DLLM (obligatoire, jamais dépassé)

**DLLM = Deployed LLM = un vrai appel réseau à l'API OpenAI (GPT-4.1) avec une clé
valide** (par opposition à un test qui mocke `@/lib/llm/openai` — la quasi-totalité des
~135 tests existants, voir `COVERAGE_MATRIX.md` §Infrastructure de mock).

**Constat de ce batch (lecture des harnais existants)** : aucun garde-fou de budget
n'existe aujourd'hui dans le repo pour capper des appels DLLM réels en test —
`vitest.setup.ts` et `playwright.config.ts` fournissent une clé factice (`sk-e2e-local-*`,
`vitest-test-openai-key`) qui fait échouer/sauter les branches "réel" plutôt que de les
capper explicitement (skip par défaut, pas de compteur). **Un futur batch qui veut de
vrais appels DLLM doit lui-même introduire ce compteur** — il n'existe pas encore.

Règles :

1. **Plafond dur de la série entière : 50 requêtes DLLM réelles au maximum, jamais 100.**
   Ce plafond couvre toutes les requêtes réelles cumulées sur les batchs 2-6 combinés,
   pas par batch.
2. **Par défaut, zéro requête réelle.** La grande majorité de la couverture (logique de
   routage, tiers, guards, schémas Zod, invariants de sécurité) doit être testée avec
   `vi.mock("@/lib/llm/openai", () => ({ openai: {}, LLM_MODEL: "gpt-4.1" }))` — c'est
   déjà le pattern dominant du repo, à réutiliser tel quel, pas à réinventer.
3. **Les requêtes DLLM réelles sont réservées aux tests "canary"** — vérifier qu'un
   modèle réel respecte effectivement le schéma Zod strict + les garde-fous (mots
   interdits, APY range, citation d'assumption) en sortie, chose qu'un mock ne peut pas
   prouver par construction. Un canary = 1 formulation représentative par agent/mode, pas
   une matrice complète.
4. **Répartition indicative du budget de 50** (à ajuster par les batchs 2-6 selon ce
   qu'ils trouvent réellement utile, mais sans jamais dépasser le total) :

   | Zone (voir `BATCHES.md`) | Budget DLLM indicatif | Justification |
   |---|---|---|
   | Zone 1 — Routeur + observabilité | 0 | Purement déterministe (regex/règles), aucun appel LLM dans le routeur lui-même — un vrai DLLM call n'y ajoute aucune preuve. |
   | Zone 2 — Action readiness / tool boundary / crew sim / swarm | 0 | Simulation/classification pure, `executable: false` partout, aucun LLM appelé. |
   | Zone 3 — API read-only / control center / observability | 0 | Registres statiques + agrégats, aucun LLM appelé. |
   | Zone 4 — 4 agents batch + reporting crew + projection swarm | ≤ 24 (6 par agent × 4 agents, canary formulation valide + 1 reject + 1 edge) | Ce sont les seuls agents qui appellent réellement OpenAI pour générer du texte structuré — priorité du budget. |
   | Zone 5 — Cockpit chat core + guards | ≤ 26 (répartis LP/Admin/Review × formulations canary) | Surface la plus exposée aux utilisateurs réels ; priorité égale à zone 4. |
   | **Total** | **≤ 50** | — |

5. **Toute requête DLLM réelle doit être explicitement loguée** dans le `HANDOFF.md` du
   batch qui l'exécute (nombre exact, agent ciblé, formulation testée) — pas seulement
   "j'ai testé en vrai", un décompte vérifiable.
6. **Si un batch estime avoir besoin de plus que sa part indicative**, il documente
   pourquoi dans son propre `HANDOFF.md` et peut consommer une part non utilisée par une
   zone précédente — mais le total série (50) est un plafond dur, pas une cible. Aucun
   batch ne dépasse 100 à lui seul dans quelque circonstance que ce soit — ce chiffre ne
   doit jamais apparaître dans un budget réel, il marque juste la ligne rouge absolue.

## Matrice des formulations à couvrir (résumé — détail complet : `COVERAGE_MATRIX.md`)

Pour chaque agent/composant testable, la couverture par formulation doit inclure au
minimum ces 3 catégories (voir `COVERAGE_MATRIX.md` pour le détail par composant) :

- **Réponses valides** — chemin nominal, entrée bien formée, sortie attendue conforme au
  schéma Zod / à la policy attendue.
- **Rejects explicites** — mots interdits provoqués intentionnellement, intent dangereux
  (deploy/sign/send/migrate...), action `forbidden_autonomous`, APY single-point,
  assumption non citée, scénario/swarm/outil inconnu, kill-switch actif
  (`CHAT_MASTER_AGENT=0`), autonomie insuffisante (`OUTREACH_AUTONOMY` < requis).
- **Cas limites** — négation d'un intent positif ("ne déploie pas"), mélange FR/EN,
  unicode/accents/casse, ambiguïté (fallback sémantique/`ask_clarification`), jeton de
  confirmation expiré/rejoué/mal lié, plafond quotidien atteint, `confidence=low`
  explicite, donnée manquante (provenance "stale"/absente).

## Découpage en batchs de tests disjoints (détail : `BATCHES.md`)

Cinq zones couvrant l'intégralité de l'inventaire agentique **hors périmètre
outreach-spécifique déjà couvert par `outreach-audit`**, sans recouvrement de fichiers
entre elles :

| # | Zone | Racine des fichiers (tests) |
|---|---|---|
| 1 | Routeur d'intent + observabilité routeur + quality review | `src/lib/agentic/intent-router*`, `src/lib/agentic/observability/*` (traces routeur), `route.router-stabilization.test.ts`, `route.observability.test.ts` |
| 2 | Action readiness + tool boundary + crew simulation + swarm framework (générique) | `src/lib/agentic/action-readiness/*`, `tool-boundary/*`, `crew-simulation/*`, `swarm/*` (hors fichiers `outreach-swarm-*` = zone outreach-audit) |
| 3 | API read-only agentic + control center + control tower visuel + simulation observability | `src/app/api/admin/agentic/*` (hors ce qui est déjà zone 1), `src/lib/agentic/control-center/*`, `system-map/*`, `src/components/admin/agentic/*`, `src/lib/agentic/observability/*` (traces de simulation, distinctes des traces routeur) |
| 4 | 4 agents batch + reporting crew + product projection swarm | `src/lib/agents/{scenario-narrative,mining-health,risk-explanation,investor-memo}.ts`, `src/lib/agentic/reporting/*`, `src/lib/agentic/product-projection/*` |
| 5 | Cockpit chat core (moteur + guards + tool registry) hors outreach | `src/lib/llm/chat-agent.ts`, `openai.ts`, `output-guard.ts`, `src/lib/agents/{apy-range,forbidden-words}.ts`, `src/lib/llm/tools/{registry,types}.ts`, `src/app/api/cockpit-chat/route.ts` + ses tests (hors `route.outreach.test.ts` = zone outreach-audit) |

**Zones importantes exclues du split (constat de ce batch, contredit les métadonnées de
mission)** : la mission de série mentionne `electron/__tests__` et `contracts/test/`
comme emplacements possibles pour les batchs de test. Vérifié par ce batch — **aucun des
deux n'a de rapport avec la ligne agentique** : `electron/__tests__/smoke.spec.ts` est un
harnais de cycle de vie de fenêtre Electron (shell desktop, aucun contenu agentique) et
`contracts/test/*.t.sol` sont des tests Foundry Solidity (Governance, EventLogger,
PoRRegistry, HearstYieldVault — smart contracts, non-IA). **Aucun batch 2-6 ne doit
tenter d'y écrire des tests agentiques** — la seule vraie surface e2e Playwright
pertinente est `e2e/outreach-master-agent.spec.ts` (déjà owned par `outreach-audit`,
skip gracieux quand `OPENAI_API_KEY` est un placeholder CI). Le reste de la couverture
"vraie ligne agentique générique" (zones 1-5 ci-dessus) vit uniquement en Vitest,
co-localisé sous `src/lib/**/__tests__/` et `src/app/api/**/__tests__/`.

## Non-négociables applicables à cette série (rappel, voir CLAUDE.md racine)

- **#4** : aucun outil d'écriture auto-exécuté depuis le chat — invariant à tester
  explicitement (jeton de confirmation, `sideEffects: false`, tiers `forbidden_autonomous`
  jamais franchissables), pas seulement supposé correct en lisant le code.
- **#5** : mots interdits ("guarantee", "promise", "certain", "will deliver", "risk-free",
  "no risk") — s'applique à tous les agents batch ET au chat cockpit.
- **#1** : APY toujours en range — testable sur les 4 agents batch + le chat.
- **ADR-016/017** : kill-switches (`CHAT_MASTER_AGENT`, `OUTREACH_AUTONOMY`) testables
  comme invariants, pas seulement documentés.
- Aucun appel réel à un service externe autre qu'OpenAI dans le cadre du budget DLLM
  ci-dessus (pas d'Apollo, pas d'email réel, pas de HuggingFace réel sauf test dédié déjà
  existant type `huggingface-test-deferral.test.ts`).

## Ce que cette série ne fait pas

- Pas de refonte de l'architecture agentique (les docs `docs/agentic/*.md` restent la
  source de vérité produit/architecture).
- Pas de nouvel ADR (sauf découverte d'une lacune de gouvernance — alors documenter dans
  `HANDOFF.md` du batch concerné et proposer, ne pas trancher seul).
- Pas de modification de `prisma/**`, `.github/workflows/**`, `vercel.json`, secrets —
  hors scope de toute la série.
- Pas de dispatch automatique de la loop suivante, pas de merge/push sur `main` par un
  agent (le pipeline nexus gère commit/push/PR après coup).
