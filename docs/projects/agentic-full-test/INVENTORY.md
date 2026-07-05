# INVENTORY.md — Agentic Line Component Inventory

> Batch 1/6 (architect, read-only). Source : lecture exhaustive de `docs/agentic/*.md`
> (17 fichiers), `docs/orchestration/coordination.md`, `docs/prompts/*.md`,
> `docs/spec/09-agents.mdx`, `docs/spec/11-agentic-reporting.mdx`, `AGENTS.md`, et
> vérification croisée avec le code (`src/lib/agents/*`, `src/lib/llm/*`,
> `src/lib/agentic/*`, `src/app/api/cockpit-chat/route.ts`,
> `src/app/api/admin/agentic/*`). Pas de garantie de complétude à 100% (lecture, pas
> exécution) — voir `docs/agentic/*.md` cités pour la source primaire à chaque entrée.

Deux couches distinctes composent "la ligne agentique" :

- **Partie A** — agents produit pilotés par LLM (les 4 agents batch + le moteur de chat
  cockpit unifié + le Master Agent outreach). Ce sont ceux qui *parlent* (génèrent du
  texte/JSON via OpenAI GPT-4.1).
- **Partie B** — infrastructure d'orchestration agentique (`src/lib/agentic/*`) :
  routeur d'intent, garde-fous, simulation de crews/swarms, observabilité, control
  center. Ce sont ceux qui *décident et surveillent*, sans jamais appeler le LLM pour
  exécuter une action (simulation/lecture seule uniquement, sauf le routeur qui fait un
  vrai routage déterministe avant le LLM).

---

## Partie A — Agents produit (LLM, OpenAI GPT-4.1, ADR-011)

### A1. Scenario Narrative Agent
- **Fichier** : `src/lib/agents/scenario-narrative.ts`
- **Rôle** : narrative + PTAI (Projection → Trigger → Action → Impact) pour un scénario
  de l'engine (base/bear/bull/custom).
- **Entrées** : `scenario_id`, `scenario_output` (artefact pur de l'engine), `provenance?`.
- **Sorties** (Zod `.strict()`) : `narrative_md`, `risk_warning`, `confidence`
  (low/medium/high), `key_drivers[]`, `ptai{projection,trigger,action,impact}`.
- **Cas de reject** : mots interdits (6) bloqués sur `narrative_md`/`risk_warning`/PTAI ;
  si `confidence=low`, `narrative_md` doit le mentionner explicitement ; PTAI obligatoire
  (non négociable #3 du CLAUDE.md racine).
- **Statut** : implémenté, testé (`src/__tests__/integration/scenario-lab.integration.test.ts`,
  22 cas), branché sur `/admin/scenario-lab`.

### A2. Mining Health Agent
- **Fichier** : `src/lib/agents/mining-health.ts`
- **Rôle** : alerte santé minage (green/amber/red) à partir des métriques de fleet.
- **Entrées** : `hashprice_usd_per_th`, `difficulty_change_pct`, `margin_pct`,
  `uptime_pct`, `period_days`, `provenance?` (défaut "attested").
- **Sorties** : `alert_level`, `summary` (doit citer ≥1 assumption + ≥1 métrique
  chiffrée), `recommendation` (jamais auto-exécutée).
- **Cas de reject** : rubrique d'alerte fixe (red si margin<5 OU uptime<95 OU
  difficulty_change>10 ; amber si margin<15 OU uptime<97 OU difficulty_change>5) — pas
  de libre arbitre du modèle sur le niveau ; alerte red → notifie un manager, n'exécute
  rien.
- **Déclenchement** : cron Inngest `market-data-hourly` (`0 * * * *`) →
  `mining-health-daily` (`0 8 * * *`, anti-doublon si déjà run le jour).
- **Statut** : implémenté, cron live, testé (loaders + `assumption-citation.test.ts` +
  `agent-parsers.test.ts`).

### A3. Risk Explanation Agent
- **Fichier** : `src/lib/agents/risk-explanation.ts`
- **Rôle** : explique 1-2 risques les plus saillants parmi 5 dimensions canoniques
  (market/mining/liquidity/smart_contract/counterparty).
- **Entrées** : `riskScore` composite, `componentScores` par dimension, `mode` (scénario
  vault), `provenance?`.
- **Sorties** : `top_risks[]` (1-2, avec `risk_id`/`name`/`explanation`/
  `suggested_guardrail`), `overall_summary`.
- **Cas de reject** : garde-fous proposés doivent rester dans les bornes du vault ; ne
  dit jamais "nous allons corriger" — propose seulement. Seuils fixes par dimension
  (ex. market <40/40-65/>65 vert/ambre/rouge, poids 30%).
- **Statut** : implémenté, spec'd (`docs/spec/08-risk-framework.mdx`), testé.

### A4. Investor Memo Agent
- **Fichier** : `src/lib/agents/investor-memo.ts`
- **Rôle** : mémo investisseur complet (8 sections Markdown), lié à un vault id
  (ADR-006 #9).
- **Entrées** : `vault{...}`, `scenarios[]`, `backtests[]`, `generatedAt`, `provenance?`
  par sous-domaine.
- **Sorties** (Zod `.strict()`) : `executive_summary`, `vault_structure`,
  `scenario_analysis`, `risk_section`, `mining_section`, `performance_section`,
  `methodology_note`, `disclaimer` (gabarit légal, **jamais généré par le modèle**,
  reproduit verbatim).
- **Cas de reject** : les 7 sections narratives (hors `disclaimer`) doivent citer ≥1
  assumption ; APY toujours en range ; donnée manquante → dite explicitement, jamais
  inventée.
- **Statut** : implémenté, testé
  (`src/lib/agents/__tests__/investor-memo-model-b.test.ts` + intégration), live sur
  `/admin/vault-[id]/memo`. PDF (Phase 2) spec'd dans `docs/spec/12-investor-memo-pdf.mdx`.

### A5. Cockpit Chat — moteur unique (`runChatAgent`, ADR-017)
- **Fichier** : `src/lib/llm/chat-agent.ts`, route `src/app/api/cockpit-chat/route.ts`.
- **Kill-switch** : `CHAT_MASTER_AGENT` (défaut ON ; `=0` → chat désactivé, 503, aucun
  fallback).
- **Trois modes, un seul moteur** :
  - **LP Master Agent** (mode par défaut) : LP-facing, seul outil = `navigate`
    (client-side, whitelist fermée `NAV_DESTINATIONS`), aucun outil d'écriture
    atteignable.
  - **Admin Ops mode** (`chatMode="admin"`) : copilote interne (archi, fraîcheur data,
    gouvernance, **et outreach** — `/api/outreach-chat` retiré, ADR-017). Outils de
    lecture toujours-on (5, snapshots sans paramètre) + outils de lecture à la demande
    (`generate_chart_spec`, `generate_demo_plan`, `export_demo_pack`,
    `export_briefing_pack`) + outils d'écriture **draft-only avec confirmation en 2
    étapes** (`create_review_note_draft`, `create_governance_proposal_draft`,
    `outreach_source_leads`, `outreach_draft_email`, `outreach_trigger_send_run`).
  - **Review-mode facilitator** (`chatMode="review"`) : facilitation de revue produit,
    aucun outil, navigation désactivée.
- **Cas de reject** : mots interdits (guard sortie, FR∪EN, négation-aware) ; APY toujours
  range ; aucun outil financier/custodial/signature/déploiement/transaction jamais
  exposé ; jetons de confirmation write : TTL court, usage unique, liés à
  `(userId, toolId, payloadHash)` — replay/mismatch rejeté serveur.
- **Statut** : implémenté, très testé (7 fichiers `route.*.test.ts` +
  `chat-agent.test.ts`, `output-guard.test.ts`, `stress-compliance.test.ts`,
  `admin-tools-registry.test.ts`), live. Routeur d'intent déterministe v2 actif par
  défaut (non-shadow) en amont.

### A6. Outreach Master Agent (classifieur d'intent — pas un agent LLM au sens strict)
- **Fichier** : `src/lib/agents/outreach-master-agent.ts`
- **Rôle** : cascade déterministe (regex → HuggingFace sémantique fallback → unknown)
  pour classifier l'intent outreach (email/SMS/WhatsApp/LinkedIn) depuis le chat.
- **Mode** : `OUTREACH_MASTER_MODE` = deterministic_only | semantic_fallback (défaut) |
  ask_clarification.
- **Invariants absolus** (testés séparément par couche, cf. `docs/projects/outreach-audit/`) :
  `sendAllowed` **toujours** false, `requiresUserReview` **toujours** true, intent
  inconnu → `no_action`.
- **Statut** : implémenté, testé au niveau des sous-couches
  (`outreach-master-regex.test.ts`, `outreach-master-safety.test.ts`) — l'audit
  `docs/projects/outreach-audit/COVERAGE_MATRIX.md` (série soeur, même famille
  `series_opus_*`) note que l'orchestrateur lui-même (`outreach-master-agent.ts`) et son
  fallback sémantique (`outreach-master-semantic.ts`) n'ont **aucun test direct comme
  point d'entrée** — gap déjà documenté ailleurs, pertinent pour ce protocole de test
  (voir `PROJECT_PLAN.md` §Coordination avec la série outreach-audit).

### A7. Outreach Writers (email/SMS/WhatsApp/LinkedIn)
- **Fichiers** : `src/lib/agents/outreach-writer.ts`, `outreach-writer-extended.ts`.
- **Rôle** : rédaction B2B cold-outreach personnalisée par canal.
- **Cas de reject** : mots interdits, APY range, aucune allégation non sourcée.
- **Statut** : implémenté, testé (`outreach-writer*.test.ts`).

### A8. Daily Executive Brief Crew — **planifié, non construit**
- **Statut** : design seulement (ADR-018 forward). Entrées prévues : snapshot vault,
  métriques minage, risk framework, snapshot custody, santé cron/jobs (tout read-only).
  Sortie : brief Markdown+JSON, publication interne uniquement (rien d'auto-publié).
  **Ne pas confondre avec le "Reporting Crew" (B10) déjà livré** — celui-ci est une
  composition read-only interne à `/admin/agentic`, le "Daily Brief" produit-final reste
  à construire.

---

## Partie B — Infrastructure d'orchestration agentique (`src/lib/agentic/*`)

### B1. Deterministic Intent Router
- **Fichiers** : `src/lib/agentic/intent-router.ts`, `intent-router-*.ts`.
- **Versions** : V1 (shadow, logge sans piloter) → **V2 (actif, non-shadow) — courant**.
- **Rôle** : classifie l'intent (navigation/dangereux/éducatif/send/vault_readiness/
  outreach/reporting…) **avant** le LLM, décide `actionPolicy` sans rien exécuter.
- **Sorties** : `AgenticIntentDecision` (kind, actionPolicy, confidence, requiresLLM,
  prohibitedAutonomousAction, negated, matchedRuleIds, routeKey).
- **Cas de reject** : intents dangereux (deploy/go-live/sign/governance/migrate/
  formula-change/send/source) → `refuse_autonomous`, aucun LLM, aucune nav, aucun outil.
  Négation d'un intent positif → `cancellation` (n'émet jamais l'action positive).
- **Garantie read-only** : fonction pure, pas d'I/O, pas de DB, pas d'appel LLM.
- **Tests** : `src/lib/agentic/__tests__/intent-router.test.ts`,
  `src/app/api/cockpit-chat/__tests__/route.router-stabilization.test.ts`.
- **Doc source** : `DETERMINISTIC_INTENT_ROUTER_V1.md`, `DETERMINISTIC_INTENT_ROUTER_V2.md`.

### B2. Action Readiness Matrix (v0)
- **Fichiers** : `src/lib/agentic/action-readiness/*`.
- **Rôle** : source de vérité unique de ce que les agents/le chat peuvent faire — 4 tiers
  (`read_only`, `draft_or_proposal`, `confirmed_write`, `forbidden_autonomous`).
- **Cas de reject** : 8 actions `forbidden_autonomous` bloquées **inconditionnellement**
  même avec jeton de confirmation (source_leads_autonomously, deploy_product,
  mark_vault_live, safe_signature, governance_execution, db_migration,
  formula_model_change, tier_a_auto_send).
- **Statut** : implémenté (backend), intégration visuelle V1 (`/admin/agentic`).
- **Tests** : `action-readiness.test.ts` (aucun item forbidden/confirmed-write marqué
  autonome).
- **Doc source** : `ACTION_READINESS_MATRIX_V0.md`.

### B3. Tool Boundary
- **Fichiers** : `src/lib/agentic/tool-boundary/*`.
- **Versions** : v0 (description manuelle) → **v1 (réflexion code-driven) — courant**.
- **Rôle** : reflète en lecture seule le vrai registre d'outils LLM
  (`ADMIN_READ_TOOL_IDS`/`ADMIN_WRITE_TOOL_IDS` dans `src/lib/llm/tools/types.ts`),
  classifie par tiers, détecte les dérives (`unknown` tool / registre non reflété).
- **Cas de reject** : outil réel absent du mapping de métadonnées → tier `unknown` +
  warning de cohérence, risque élevé, jamais autonome.
- **Statut** : implémenté, surfacé dans `/admin/agentic`.
- **Doc source** : `TOOL_BOUNDARY_V1.md`.

### B4. Crew Simulation (v0, read-only)
- **Fichiers** : `src/lib/agentic/crew-simulation/*`.
- **Rôle** : représentation statique/déterministe de ce qu'un crew *ferait* — jamais
  exécuté (`executable: false` sur chaque step, invariant testé).
- **6 scénarios** : reporting_crew_briefing, outreach_draft_flow (draft_only, medium
  risk, gate HITL avant envoi), product_review_flow, risk_explanation_flow,
  vault_readiness_flow (high risk, mainnet deploy hard-bloqué ADR-006), memory_distill_flow.
- **Cas de reject** : scénario inconnu → `CrewSimulationError`, aucun fallback
  d'exécution.
- **Statut** : implémenté, testé (`crew-simulation.test.ts`), surfacé `/admin/agentic`.
- **Doc source** : `CREW_SIMULATION_READONLY_V0.md`.

### B5. Swarm framework (composition de crews)
- **Fichiers** : `src/lib/agentic/swarm/*`.
- **6 swarms** : `platform_reporting_swarm`, `lp_explainer_swarm`,
  `vault_governance_swarm`, `outreach_governed_swarm` (**premier swarm réellement
  enforcing** — gate HITL requis avant envoi), `memory_maintenance_swarm`,
  `product_projection_swarm`.
- **Cas de reject** : swarm inconnu → 404 ; action interdite → bloquée même avec jeton ;
  action inconnue → bloquée par défaut (fail-safe).
- **Discrepancy notée dans les docs sources** : `SWARM_CALIBRATION.md` documente une
  faille structurelle corrigée depuis — `evaluateActionReadiness` ignorait à l'origine
  l'identité du swarm (le `forbiddenActions` du swarm était décoratif). Résolu : un
  swarm peut **resserrer** le plancher global de tier, jamais l'assouplir. Ordre
  d'enforcement : `forbidden_autonomous` (plancher global) → `forbiddenActions`
  (spécifique au swarm) → `allowedActionIds` (scope) → décision de tier.
- **Statut** : implémenté, testé (`swarm-calibration.test.ts` +
  `src/app/api/admin/agentic/__tests__/`), simulé via
  `POST /api/admin/agentic/simulate` (admin-gated, no-store).
- **Doc source** : `SWARM_CALIBRATION.md`.

### B6. Agentic Read-only API
- **Fichiers** : `src/app/api/admin/agentic/*`.
- **Endpoints** : `GET registry`, `POST simulate`, `GET simulations`,
  `GET simulations/aggregates`, `POST projection`.
- **Garanties** : admin-gated, rate-limité, `sideEffects: false` partout, aucun
  prompt/texte utilisateur/secret stocké.
- **Statut** : implémenté.
- **Doc source** : `AGENTIC_READONLY_API.md`.

### B7. Agentic Simulation Observability
- **Fichiers** : `src/lib/agentic/observability/*` (traces de simulation, distinctes de
  l'observabilité du routeur).
- **Rôle** : audit optionnel (opt-in via `observability:{record:true}`), append-only,
  métadonnées uniquement (jamais de prompt/texte/payload).
- **Storage** : Redis (200 entrées, TTL 7j) + fallback mémoire. Pas de Prisma.
- **Statut** : implémenté.
- **Doc source** : `AGENTIC_SIMULATION_OBSERVABILITY.md`.

### B8. Router Observability
- **Fichiers** : `src/lib/agentic/observability/*` (traces de décision du routeur).
- **Versions** : V0 (Redis volatile) → **V1 (table Prisma durable) — courant** → V1.1
  (fenêtre 30j, rétention configurable) → V1.2 (agrégats SQL Postgres, fallback
  in-memory sur SQLite).
- **Ce qui n'est JAMAIS enregistré** : message utilisateur, message normalisé, réponse
  assistant, system prompt, raison de décision en texte libre, payloads d'outils,
  secrets.
- **Statut** : implémenté (migration `20260625120000_add_agentic_router_decision_trace`),
  testé (`observability.test.ts` — vie privée + parité agrégation SQL/mémoire).
- **Doc source** : `ROUTER_OBSERVABILITY_V0.md`, `ROUTER_OBSERVABILITY_V1.md`.

### B9. Router Quality Review (v0)
- **Fichiers** : `src/lib/agentic/observability/quality-review.ts`.
- **Rôle** : interprète les stats du routeur en taux de santé + watchlist (seuils : taux
  d'unknown ≥20% = watch, taux de refus dangereux ≥15% = alert, fallback/dégradé ≥10% ou
  storage fallback = watch, aucune donnée récente = info).
- **Statut** : implémenté, surfacé `/admin/agentic`.
- **Doc source** : `ROUTER_QUALITY_REVIEW_V0.md`.

### B10. Reporting Crew (v0, read-only)
- **Fichiers** : `src/lib/agentic/reporting/*`.
- **Rôle** : premier "crew" applicatif (pas CrewAI) — compose control-center +
  observability + quality review + tool boundary + gates + safety en un briefing exécutif.
- **Statut dérivé** : alert si un signal de section est alert ; sinon watch ; sinon
  no_data ; sinon healthy.
- **Statut** : implémenté, testé (`reporting-crew.test.ts` — pas de verbe d'écriture
  interdit dans les recommandations), surfacé `/admin/agentic`.
- **Doc source** : `REPORTING_CREW_READONLY_V0.md`.

### B11. Product Projection Swarm
- **Fichiers** : `src/lib/agentic/product-projection/*`, crew dans
  `crew-simulation/scenarios.ts`, swarm dans `swarm/registry.ts`, action dans
  `action-readiness/actions.ts`, API `POST /api/admin/agentic/projection`.
- **Versions** : v0 (déterministe) → v2 (méthodologie seedée p5/p50/p95, opt-in).
- **Garanties toujours actives** : déterministe (même entrée → artefact identique),
  APY range only (single-point rejeté), aucun chiffre inventé, mots interdits bloqués,
  disclaimers + provenance obligatoires.
- **Résolution d'une discrepancy documentée** : `SWARM_CALIBRATION.md` signalait à
  l'origine "action projection manquante, ne pas construire le swarm avant que
  l'action/le crew/le swarm enforcing existent" — `PRODUCT_PROJECTION_SWARM.md`
  confirme que les 3 sont maintenant en place.
- **UI** : `/admin/projection/preview` (toggle v0/v2, entrées bornées, validation locale).
- **Statut** : implémenté.
- **Doc source** : `PRODUCT_PROJECTION_SWARM.md`, `PROJECTION_METHODOLOGY_V2.md`.

### B12. Agentic Control Center
- **Fichiers** : `src/lib/agentic/control-center/*`, page `src/app/admin/agentic/page.tsx`.
- **Versions** : v0.1 (registre statique, 9 sections) → **v2 "Control Tower" — courant**
  (résumé de commande, carte de topologie ~8 blocs, tableau de capacités, agents/crews
  par domaine, actions & gates, simulations, observabilité, reporting crew, limite de
  sécurité).
- **Garantie read-only** : `export const dynamic = "force-static"`, pas de requête DB, pas
  d'appel LLM, pas d'exécution d'outil, pas de scan filesystem runtime.
- **Statut** : implémenté.
- **Doc source** : `AGENTIC_CONTROL_CENTER_V0.md`.

### B13. Agentic Visual Control Center
- **Fichiers** : `src/lib/agentic/system-map/*`, composants
  `src/components/admin/agentic/*`.
- **Versions** : v0 (carte système + inspecteur) → **v2 (Control Tower, remplace la
  grille de cartes v0) — courant**.
- **Garantie read-only** : pas de CrewAI, pas de runtime autonome, pas de bouton
  Run/Execute/Launch/Send/Deploy/Mark-live, aucun changement router/guard/HITL/chat.
- **Statut** : implémenté.
- **Doc source** : `AGENTIC_VISUAL_CONTROL_CENTER_V0.md`.

### B14. Output / Compliance Guard (couche existante, non spécifique à l'agentique)
- **Fichiers** : `src/lib/llm/output-guard.ts`, `src/lib/agents/apy-range.ts`,
  `src/lib/agents/forbidden-words.ts`.
- **Rôle** : garde post-LLM sur le flux de réponse streamée — bloque mots interdits, APY
  single-point, conseil financier personnalisé. Pas de paramètre d'intent, ne peut pas
  être assoupli par intent (l'indice éducatif du routeur V2 ajoute un hint de prompt
  système, **n'assouplit jamais** ce guard — c'est la dernière ligne de défense).
- **Statut** : implémenté, testé.

### B15. Agentic Backend Foundation (umbrella)
- **Fichiers** : `src/lib/agentic/*` dans son ensemble.
- **Modes d'exécution possibles** : simulation / dry_run / gated uniquement — jamais
  `autonomous_write`.
- **Contrat de sécurité** : `evaluateActionReadiness(actionId, context, swarm?)` est LA
  porte. Décision par tier : read_only→allow, draft→gated, confirmed_write→
  besoin-humain/jeton, forbidden→bloqué. Ne retourne jamais un fallback permissif.
- **Doc source** : `BACKEND_AGENTIC_FOUNDATION.md`.

---

## Taxonomie transverse des cas de reject (résumé pour le protocole de test)

| Catégorie | Déclencheur | Comportement attendu |
|---|---|---|
| Intent dangereux | deploy/go-live/sign/governance/migrate/formula-change/send/source | `refuse_autonomous`, aucun LLM, refus fixe |
| Négation d'intent positif | "ne fais pas X", "don't Y" | `cancellation`, jamais l'action positive |
| Action forbidden_autonomous | 8 actions du catalogue (B2) | Bloqué même avec jeton de confirmation |
| Action confirmed_write sans jeton | ex. `outreach_trigger_send_run` | Gated, demande confirmation |
| Mots interdits en sortie | guarantee/promise/certain/will deliver/risk-free/no risk | Guard sortie bloque avant émission (FR∪EN, négation-aware) |
| APY single-point | absence de range | Rejeté par validateur (`apy-range.ts`) |
| Assumption non citée | section narrative sans citation | Rejeté par validateur (`assumption-citation.ts`) |
| Scénario/swarm/outil inconnu | id non catalogué | Fail-safe : 404 / tier `unknown` / bloqué, jamais de fallback permissif |
| Kill-switch chat | `CHAT_MASTER_AGENT=0` | 503, chat désactivé, aucun fallback |
| Autonomie outreach | `OUTREACH_AUTONOMY` < SEND (défaut SUGGEST) | Rien n'est auto-envoyé ; Tier A jamais auto-envoyé quel que soit le réglage |

## Discrepancies documentées entre versions (déjà résolues dans le code)

1. **Intent Router V1→V2** : V1 shadow-only (logge sans piloter) → V2 actif. V1 conservé
   comme référence pipeline, pas de code mort à supprimer sans arbitrage (hors scope de
   ce batch).
2. **Router Observability V0→V1/V1.1/V1.2** : migration volatile→durable, puis fenêtres
   et agrégats SQL. V0 reste comme couche de fallback (pas déprécié au sens "à retirer").
3. **Swarm enforcement gap (SWARM_CALIBRATION.md)** : déjà corrigé — voir B5.
4. **Product Projection Swarm** : lacune "action manquante" déjà comblée — voir B11.

## Statut d'implémentation — synthèse

**Implémenté et déployé** : A1-A7, B1-B15 (tous les composants ci-dessus sauf A8).
**Planifié / non construit** : A8 (Daily Executive Brief Crew, design ADR-018 forward),
crew runtime complet (CrewAI réel), extraction du chat engine/context composer, split du
tool boundary (roadmap #9), product workspace crew, investor pipeline crew, inspecteur
interactif (sélection de nœud côté client).

15 composants distincts en Partie B, 8 en Partie A (dont 1 planifié) — **22 entrées au
total** dans cet inventaire.
