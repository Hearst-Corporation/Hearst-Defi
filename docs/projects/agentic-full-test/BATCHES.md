# BATCHES.md — Agentic Full Test Series Status (`series_opus_agentic_hearst-defi`)

`executionMode: sequential-manual` — Adrien lance chaque loop manuellement, aucun
auto-dispatch, aucun auto-merge.

| Batch | Rôle | Zone (voir `PROJECT_PLAN.md`) | Owner-zone fichiers | Statut | PR | Mergé |
|---|---|---|---|---|---|---|
| 1/6 | architect — plan de test | — (méta) | `docs/projects/agentic-full-test/` | ✅ FAIT (2026-07-04) | — (à ouvrir par le pipeline) | — |
| 2/6 | tester — Routeur d'intent + observabilité routeur + quality review | Zone 1 — `src/lib/agentic/intent-router*.ts`, `src/lib/agentic/observability/*` (traces routeur), `route.router-stabilization.test.ts`, `route.observability.test.ts` | idem | ⏳ En attente | — | — |
| 3/6 | tester — Action readiness / tool boundary / crew simulation / swarm (générique) | Zone 2 — `src/lib/agentic/{action-readiness,tool-boundary,crew-simulation,swarm}/*` (hors `outreach-swarm-*`) | idem | ⏳ En attente | — | — |
| 4/6 | tester — API read-only agentic + control center + control tower + simulation observability | Zone 3 — `src/app/api/admin/agentic/*`, `src/lib/agentic/{control-center,system-map}/*`, `src/components/admin/agentic/*` | idem | ⏳ En attente | — | — |
| 5/6 | tester — 4 agents batch + reporting crew + product projection swarm | Zone 4 — `src/lib/agents/{scenario-narrative,mining-health,risk-explanation,investor-memo}.ts`, `src/lib/agentic/{reporting,product-projection}/*` | idem | ⏳ En attente | — | — |
| 6/6 | tester — Cockpit chat core (moteur + guards + tool registry), hors outreach | Zone 5 — `src/lib/llm/{chat-agent,openai,output-guard}.ts`, `src/lib/agents/{apy-range,forbidden-words}.ts`, `src/lib/llm/tools/{registry,types}.ts`, `src/app/api/cockpit-chat/route.ts` + tests (hors `route.outreach.test.ts`) | idem | ⏳ En attente | — | — |

## Notes

- Chaque batch 2-6 dépend du batch 1 (ce plan) et doit lire en entier `PROJECT_PLAN.md` +
  `INVENTORY.md` + `COVERAGE_MATRIX.md` avant de coder.
- Les batchs 2-6 ne dépendent PAS les uns des autres (zones disjointes, aucun fichier
  partagé) — ils pourraient en théorie tourner en parallèle sur des worktrees séparés,
  mais le mode d'exécution choisi pour cette série est **séquentiel manuel** (voir
  métadonnées de série), donc l'ordre 2→3→4→5→6 ci-dessus est indicatif, pas une
  dépendance dure.
- **Budget DLLM partagé** (voir `PROJECT_PLAN.md` §Protocole de test) : 50 requêtes
  réelles maximum pour l'ensemble des batchs 2-6, jamais 100. Chaque batch qui consomme
  du budget DOIT le logger dans son propre `HANDOFF.md` (nombre exact, agent ciblé,
  formulation) pour que le batch suivant sache combien il reste.
- Priorité de traitement si un batch veut aller au-delà du strict minimum de sa zone (voir
  `COVERAGE_MATRIX.md` §Synthèse) : zone 4 (Mining Health / Risk Explanation sans test de
  seuils isolé) > zone 5 (kill-switch `CHAT_MASTER_AGENT=0` isolé) > zone 1
  (`quality-review.ts` isolé) > zone 3 (opt-in observability des simulations) > reste.
- **Ne pas dupliquer la série sœur `docs/projects/outreach-audit/`** — tout fichier
  `outreach-*`/`outreach-swarm-*`/`outreach-integration.ts` reste hors périmètre de cette
  série (voir `PROJECT_PLAN.md` §Coordination).
- **`electron/__tests__/` et `contracts/test/` sont hors périmètre** (confirmé sans
  rapport avec la ligne agentique par ce batch — voir `PROJECT_PLAN.md` §Zones exclues).
  Aucun batch 2-6 ne doit y écrire de test agentique.
- Mettre à jour ce tableau (statut + PR + commit) à la fin de chaque batch.
