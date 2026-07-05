# COVERAGE_MATRIX.md — Agentic Test Coverage & Formulation Matrix

> Batch 1/6 (architect, read-only). Deux parties : (1) inventaire des tests existants
> par zone (présence/absence, pas de mesure de branche), (2) matrice des formulations
> d'entrée à couvrir par composant pour les batchs 2-6. Méthode identique à la série
> sœur `docs/projects/outreach-audit/COVERAGE_MATRIX.md` : ✅ Direct (fichier
> `__tests__/<name>.test.*` colocalisé), 🟡 Indirect (exercé via un autre test), ❌ Aucun.

## Partie 1 — Couverture existante par zone (voir `BATCHES.md` pour le mapping batch↔zone)

### Zone 1 — Routeur d'intent + observabilité routeur + quality review

| Fichier | Couverture | Note |
|---|---|---|
| `src/lib/agentic/intent-router.ts` (+ `intent-router-*.ts`) | ✅ Direct | `src/lib/agentic/__tests__/intent-router.test.ts` (classification + négation) |
| Route-level routing (nav fast-path, dangerous refusal, educational hint) | ✅ Direct | `src/app/api/cockpit-chat/__tests__/route.router-stabilization.test.ts` |
| Router Observability (traces V1 durable + agrégats) | ✅ Direct | `src/lib/agentic/observability/__tests__/*` (13 fichiers recensés : aggregates, trends, db-store, decision summary, retention, stats, router decision logging/retrieval) + `route.observability.test.ts` |
| Router Quality Review (v0) | 🟡 Indirect probable | Aucun fichier `quality-review.test.ts` isolé identifié par nom — à confirmer par le batch 1 zone (vérifier s'il est exercé dans les 13 fichiers `observability/__tests__/*` ou s'il manque un test dédié au calcul des seuils watch/alert/info eux-mêmes). |

**Zone 1 : couverture unitaire globalement bonne (routeur + observabilité déjà denses),
le point à vérifier en premier par le batch 2 est le calcul des seuils de
`quality-review.ts` isolément (pas juste via les agrégats bruts).**

### Zone 2 — Action readiness / tool boundary / crew simulation / swarm (générique)

| Fichier | Couverture | Note |
|---|---|---|
| `action-readiness/*` | ✅ Direct | `action-readiness.test.ts` |
| `tool-boundary/*` | ✅ Direct | `tool-boundary.test.ts` (tests de complétude du mapping de métadonnées) |
| `crew-simulation/*` | ✅ Direct | `crew-simulation.test.ts` |
| `swarm/*` (générique + calibration) | ✅ Direct | `swarm-calibration.test.ts`, `swarm/swarm.test.ts`, `swarm-scope-all.test.ts`, `swarm-boundary-enforcement.test.ts`, `registry-snapshot.test.ts` |
| `swarm/live/**` (8 fichiers) | ✅ Direct | artefacts swarm live, formulaires vault, allocation stratégie, cohérence pipeline, profils objectifs, sécurité, orchestration scénario |
| `control-center.test.ts` | ✅ Direct | contrôle et coordination du swarm |

**Zone 2 : la mieux couverte de l'inventaire — 45 fichiers recensés sous
`src/lib/agentic/__tests__/` au total, dont la majorité couvre cette zone. Le batch 3
doit surtout vérifier la matrice de *formulations* (partie 2 ci-dessous), pas ajouter de
tests unitaires de base qui existent déjà.**

### Zone 3 — API read-only agentic + control center + control tower + simulation observability

| Fichier | Couverture | Note |
|---|---|---|
| `src/app/api/admin/agentic/__tests__/*` (5 fichiers) | ✅ Direct | projection build, simulate, registry, simulations, aggregates |
| `system-map/__tests__/*` (4 fichiers) | ✅ Direct | intégration system-map, tracking de statut, ancres |
| Agentic Simulation Observability (traces de simulation, distinctes du routeur) | 🟡 À vérifier | Peut être couverte dans les 45 fichiers `agentic/__tests__/*` sans nom dédié évident — le batch 4 doit confirmer par grep qu'un test exerce spécifiquement l'opt-in `observability:{record:true}` de `POST /simulate` (comportement par défaut OFF, non-blocage en cas d'échec de store). |
| Control Tower visuel (composants React) | ❌ Aucun test dédié identifié | Cohérent avec le reste du repo (peu de tests de composants de présentation pure) — priorité basse sauf régression visuelle constatée (voir skill `visual-review` plutôt que Vitest pour ce cas). |

**Zone 3 : bonne couverture API, à vérifier : opt-in observability des simulations
(voir ci-dessus) et absence totale de test sur les composants visuels (risque faible,
présentation pure).**

### Zone 4 — 4 agents batch + reporting crew + product projection swarm

| Fichier | Couverture | Note |
|---|---|---|
| `scenario-narrative.ts` | ✅ Direct (intégration) | `src/__tests__/integration/scenario-lab.integration.test.ts` (22 cas : validation, guardrails, mots interdits, citations) |
| `mining-health.ts` | 🟡 Indirect | Pas de `mining-health.test.ts` isolé identifié — exercé via loaders (`loaders/__tests__/mining-latest-metrics.test.ts`) + validateurs génériques (`assumption-citation.test.ts`, `agent-parsers.test.ts`). **Gap potentiel** : la rubrique fixe d'alerte (seuils green/amber/red) elle-même n'a peut-être pas de test isolé — à confirmer par le batch 4. |
| `risk-explanation.ts` | 🟡 Indirect | Idem — couvert par les validateurs génériques, pas de fichier `risk-explanation.test.ts` isolé identifié. À confirmer/combler. |
| `investor-memo.ts` | ✅ Direct | `investor-memo-model-b.test.ts` + intégration |
| `reporting/*` (Reporting Crew) | ✅ Direct | `reporting/__tests__/*` (2 fichiers) |
| `product-projection/*` | ✅ Direct | `product-projection/__tests__/*` (3 fichiers : méthodologie, client, v2) |

**Zone 4 : Scenario Narrative et Investor Memo bien couverts directement ; Mining
Health et Risk Explanation semblent couverts seulement à travers les validateurs
transverses (mots interdits, citation d'assumption) mais pas leur logique métier propre
(rubriques de seuils, sélection des 1-2 risques les plus saillants) — **priorité haute
pour le batch 4**, à confirmer par grep exhaustif avant d'écrire quoi que ce soit de
redondant.**

### Zone 5 — Cockpit chat core (moteur + guards + tool registry) hors outreach

| Fichier | Couverture | Note |
|---|---|---|
| `route.test.ts`, `route.guard.test.ts`, `route.limits.test.ts`, `route.profile-guard.test.ts` | ✅ Direct | cœur de route + guards + limites + profil |
| `chat-agent.test.ts` | ✅ Direct | moteur `runChatAgent` |
| `output-guard.test.ts`, `stress-compliance.test.ts` | ✅ Direct | guard de conformité, y compris stress |
| `admin-tools-registry.test.ts` | ✅ Direct | registre d'outils + policy gating |
| `chat-agent-tool-messaging.test.ts`, `product-chat-stream.test.ts` | ✅ Direct | messagerie outil, streaming |
| Navigation (`nav-*`, `client-nav`, `vault-typo-routing`, `nav-global-hardening`, `stress-nav-*`) | ✅ Direct (nombreux) | 12+ fichiers couvrant l'encodage/décodage, fallback, robustesse, typos |
| `semantic-guard.test.ts` | ✅ Direct | garde sémantique |
| `chat-nav/__tests__/*` (2 fichiers) | ✅ Direct | endpoint chat-nav |
| `admin/chat-tools/__tests__/*` (3 fichiers) | ✅ Direct | outils admin, création de draft de campagne, e2e |
| `cockpit-chats/[id]/__tests__/*` | ✅ Direct | historique de chat, marqueur d'affichage |
| Kill-switch `CHAT_MASTER_AGENT=0` | 🟡 À vérifier | Aucun nom de fichier explicite trouvé pour ce cas précis — à confirmer par grep dans `route.test.ts`/`route.guard.test.ts` si la valeur `0` est testée isolément (503 sans fallback). |

**Zone 5 : la zone la plus densément testée de tout l'inventaire (~32 fichiers sous
`src/lib/llm/__tests__/` + 6 sous `cockpit-chat/__tests__/`). Le seul point net à
vérifier : le kill-switch lui-même comme test isolé (pas juste documenté).**

## Infrastructure de mock (constat transverse, base pour le budget DLLM de `PROJECT_PLAN.md`)

- **Mock dominant** : `vi.mock("@/lib/llm/openai", () => ({ openai: {}, LLM_MODEL:
  "gpt-4.1" }))` — le client OpenAI est stubé à un objet vide, aucun appel réel.
- **Mock de plus haut niveau** : `runChatAgent()` mocké directement dans les tests de
  route pour retourner des fixtures synthétiques.
- **Pas de MSW/nock** — tout le mocking est au niveau module/fonction (Vitest natif).
- **E2E** : `outreach-master-agent.spec.ts` saute gracieusement les scénarios "vrai LLM"
  quand `OPENAI_API_KEY` est le placeholder CI (`sk-ci-*`/`sk-e2e-local-*`) — aucun appel
  réel en CI aujourd'hui.
- **Aucun compteur de budget/quota n'existe** dans `vitest.setup.ts` ni
  `playwright.config.ts` — si un batch 2-6 introduit un test à vrai appel DLLM (voir
  budget dans `PROJECT_PLAN.md`), il doit lui-même ajouter le garde-fou (ex. variable
  d'env `DLLM_BUDGET_MAX`, compteur de test explicite) plutôt que de supposer qu'il existe.

## Partie 2 — Matrice des formulations par composant

Légende des colonnes : **Valide** = chemin nominal attendu ; **Reject** = doit être
explicitement refusé/bloqué ; **Limite** = cas ambigu/frontière à vérifier.

| Composant | Valide (exemples de formulation) | Reject (exemples) | Limite (exemples) |
|---|---|---|---|
| Intent Router (B1) | "montre-moi le dashboard", "go to vaults" | "déploie le contrat en prod", "signe la transaction", "exécute le governance proposal" | "ne déploie pas le contrat" (négation → cancellation, pas refus positif) ; mélange FR/EN dans une même phrase ; accents/casse variés |
| Action Readiness (B2) | requête d'un outil `read_only` | requête d'un des 8 `forbidden_autonomous` (ex. `mark_vault_live`) même avec jeton fourni | `confirmed_write` sans jeton (doit gater, pas bloquer définitivement) ; jeton expiré/rejoué/mal lié à `(userId,toolId,payloadHash)` |
| Tool Boundary (B3) | id d'outil réel connu | — (pas de "reject" au sens utilisateur, c'est un contrôle interne) | id d'outil absent du mapping de métadonnées → doit tomber en tier `unknown` + warning, jamais en silencieux "read_only" par défaut |
| Crew Simulation (B4) | un des 6 ids de scénario connus | id de scénario inconnu → `CrewSimulationError`, pas de fallback exécutable | scénario avec risque élevé (`vault_readiness_flow`) — vérifier que le `mark_vault_live` reste inatteignable même en simulation |
| Swarm framework (B5) | swarm connu + action dans `allowedActionIds` | swarm inconnu (404) ; action dans `forbiddenActions` du swarm (bloqué même si globalement `read_only`) | action absente à la fois de `allowedActionIds` et `forbiddenActions` → doit être bloquée par défaut (fail-safe), pas autorisée par omission |
| Mining Health Agent (A2/B4 zone) | métriques nominales → alerte green | métriques qui déclenchent red (margin<5, uptime<95, difficulty_change>10) → vérifier notification manager sans auto-action | valeurs exactement à la frontière des seuils (margin=5, uptime=95, etc.) — comportement au seuil exact non documenté explicitement, à clarifier en testant |
| Risk Explanation Agent (A3) | scores composites nominaux → 1-2 top risks cohérents | `overall_summary` qui contiendrait "nous allons corriger" (formulation interdite au sens produit, pas juste mot-clé) | scores à égalité parfaite entre 2 dimensions → quel tie-break pour la sélection top 1-2 ? |
| Scenario Narrative / Investor Memo (A1/A4) | scénario/vault bien formé → narrative + PTAI / mémo complet | mot interdit injecté artificiellement dans un mock de sortie LLM → guard doit bloquer avant émission ; APY single-point → rejeté | `confidence=low` sans mention explicite dans `narrative_md` → doit être un cas de reject testé, pas seulement documenté ; assumption manquante dans les données d'entrée (provenance "stale"/absente) |
| Cockpit Chat — LP mode (A5) | demande de navigation vers une page whitelistée | tentative d'atteindre un outil d'écriture/financier depuis le mode LP (ne doit même pas être exposé, pas juste refusé) | destination de nav inconnue/mal orthographiée (`vault-typo-routing.test.ts` existe déjà — vérifier qu'il couvre bien ce cas plutôt que de le redupliquer) |
| Cockpit Chat — Admin mode (A5) | lecture de snapshot toujours-on | appel direct (sans confirmation) d'un outil d'écriture (`create_review_note_draft`, `outreach_trigger_send_run`...) → doit toujours revenir `confirmation_required` | double confirmation avec jeton légèrement modifié (payload hash différent) → doit être rejeté, pas silencieusement accepté |
| Cockpit Chat — Review mode (A5) | facilitation de revue produit | tentative de naviguer (doit être désactivé, `exposeNavigate:false`) ou d'appeler un outil (aucun outil exposé) | changement de mode mi-conversation (admin→review) — le contexte outils doit bien basculer, pas rester sur l'ancien mode |
| Kill-switch chat (`CHAT_MASTER_AGENT=0`) | N/A (mode désactivé) | toute requête avec le switch à `0` → 503, aucun fallback silencieux | switch remis à ON après un 503 — pas de comportement "collant" résiduel |
| Outreach Master Agent (A6 — hors périmètre de code de cette série, cf. `PROJECT_PLAN.md` §Coordination) | intent clair (ex. "crée une campagne email") | intent qui ressemble à un envoi direct → `sendAllowed` doit rester false, `requiresUserReview` true | intent ambigu → cascade regex→sémantique→`no_action`, jamais un fallback qui autorise l'envoi par défaut |

## Synthèse — priorités pour les batchs 2-6

1. **Zone 4** — Mining Health et Risk Explanation semblent n'avoir aucun test isolé de
   leur logique de seuils/sélection propre (au-delà des validateurs transverses) —
   priorité la plus haute.
2. **Zone 5** — vérifier l'existence d'un test isolé du kill-switch
   `CHAT_MASTER_AGENT=0` ; sinon l'ajouter (mock-only, aucun DLLM réel nécessaire).
3. **Zone 1** — vérifier/combler un test isolé de `quality-review.ts` (calcul des seuils
   watch/alert/info), pas seulement via les agrégats bruts.
4. **Zone 3** — confirmer la couverture de l'opt-in `observability:{record:true}` sur
   `POST /simulate` (comportement par défaut OFF + non-blocage sur échec de store).
5. **Toutes zones** — compléter la matrice de formulations (Partie 2) avant d'ajouter des
   tests redondants avec l'existant déjà dense (surtout zones 2 et 5, déjà très couvertes
   en tests unitaires classiques — la valeur ajoutée des batchs 2-6 est la matrice de
   *formulations*, pas la duplication de tests structurels qui existent déjà).
