# BATCHES.md — Outreach Audit Series Status (`series_opus_audit_hearst-defi`)

`executionMode: sequential-manual` — Adrien lance chaque loop manuellement, aucun
auto-dispatch, aucun auto-merge.

| Batch | Rôle | Zone (voir `PROJECT_PLAN.md`) | Owner-zone fichiers | Statut | PR | Mergé |
|---|---|---|---|---|---|---|
| 1/6 | architect — plan d'audit | — (méta) | `docs/projects/outreach-audit/` | ✅ FAIT (2026-07-04) | — (à ouvrir par le pipeline) | — |
| 2/6 | tester — Domaine & politique | Zone 1 — `src/lib/outreach/*.ts` | idem | ⏳ En attente | — | — |
| 3/6 | tester — Agents LLM pipeline batch | Zone 2 — `src/lib/agents/outreach-{scorer,writer,writer-extended,reply-handler}.ts` | idem | ⏳ En attente | — | — |
| 4/6 | tester — Master Agent / swarm / canvas | Zone 3 — `src/lib/agents/outreach-master-*.ts`, `src/lib/agents/swarms/outreach-swarm-*.ts`, `src/lib/canvas/outreach-*.ts`, `src/lib/agentic/outreach-integration.ts` | idem | ⏳ En attente | — | — |
| 5/6 | tester — Infra (jobs/routes/diagnostics/data) | Zone 4 — `src/lib/inngest/functions/outreach-*.ts`, `src/app/api/outreach/*`, `src/app/api/admin/diagnostics/outreach/*`, `src/lib/admin/diagnostics/outreach-*.ts`, `src/lib/data/outreach.ts`, `src/lib/admin/outreach-kpi-strip.ts` | idem | ⏳ En attente | — | — |
| 6/6 | tester — UI admin | Zone 5 — `src/app/admin/outreach/*`, `src/components/admin/outreach/*`, `src/components/admin/diagnostics/outreach-lifecycle-demo.tsx` | idem | ⏳ En attente | — | — |

## Notes

- Chaque batch 2-6 dépend du batch 1 (ce plan) et doit le lire en entier avant de coder.
- Les batchs 2-6 ne dépendent PAS les uns des autres (zones disjointes, aucun fichier
  partagé) — ils peuvent en théorie tourner en parallèle sur des worktrees séparés, mais
  le mode d'exécution choisi pour cette série est **séquentiel manuel** (voir métadonnées
  de série), donc l'ordre 2→3→4→5→6 ci-dessus est indicatif, pas une dépendance dure.
- Priorité de traitement si un batch veut aller au-delà du strict minimum de sa zone (voir
  `COVERAGE_MATRIX.md` §"Synthèse") : zone 5 (`actions.ts`, 11/13 Server Actions non
  testées) > `suppression.ts` (zone 1) > `outreach-master-agent.ts`/`outreach-master-semantic.ts`
  (zone 3) > `outreach-kpi-strip.ts` (zone 4) > reste de l'UI (zone 5).
- Mettre à jour ce tableau (statut + PR + commit) à la fin de chaque batch.
