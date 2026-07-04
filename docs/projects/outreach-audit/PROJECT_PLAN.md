# PROJECT_PLAN.md — Outreach Audit Series (`series_opus_audit_hearst-defi`)

> Établi le 2026-07-04 par le batch 1/6 (architect, read-only, no code).
> Lecture préalable pour les batchs 2-6 : ce fichier + `INVENTORY.md` + `COVERAGE_MATRIX.md`
> + `ANTI_HARDCODING_CHECKLIST.md`. Voir aussi `docs/EMAIL_CONTEXT.md` (règle d'or : pas
> d'envoi réel), `docs/plan/outreach-engine.md` (plan produit d'origine, Paliers 0-4) et
> `docs/decisions/ADR-016-autonomous-outreach-sending-tiered.md` (gouvernance de l'envoi).

## Contexte

Le module Outreach (lead-gen B2B distributeurs) est le sous-système le plus vaste et le
plus récemment construit du repo : sourcing Apollo → enrichissement → scoring LLM → tier
d'autonomie (A/B/C/rejet) → rédaction LLM → envoi gouverné par tier/quota → relances →
lecture des réponses → qualification. Il porte aussi une couche distincte : un agent de
classification d'intent pour le **chat cockpit** ("Master Agent" outreach) qui décide
navigation / ouverture de canvas — jamais d'envoi, jamais d'exécution autonome
(cf. ADR-012 / ADR-017).

C'est un système qui touche à la fois : logique métier pure (tiers, quotas, désinscription),
agents LLM structurés (ADR-011), jobs Inngest asynchrones, Server Actions admin (828 → 1031
lignes dans `actions.ts`), et une UI admin à ~15 composants. Sa surface de test est inégale
(voir `COVERAGE_MATRIX.md`) : des modules de conformité (désinscription, garde-fous
d'envoi) sont bien couverts, d'autres (le layer chat "Master Agent", la quasi-totalité de
l'UI, `suppression.ts`) n'ont **aucun** test dédié.

## Objectif de la série (6 batchs)

1. **Batch 1 (architect, ce batch)** — inventaire + matrice de couverture + zones de test
   disjointes + checklist anti-hardcoding. Aucun code.
2. **Batchs 2-6 (executants)** — chacun prend une zone disjointe (voir `BATCHES.md`),
   audite en profondeur (tests manquants, valeurs en dur, régressions potentielles),
   propose/ajoute des tests dans son owner-zone uniquement, sans jamais toucher le code
   applicatif hors tests sauf accord explicite (cette série est un audit, pas une
   feature — un fix de bug réel découvert doit être documenté et proposé, pas
   silencieusement mergé, sauf si le batch en question a explicitement ce mandat).

**Exécution strictement séquentielle et manuelle** (`executionMode: sequential-manual`) —
Adrien lance chaque loop l'une après l'autre ; aucun dispatch automatique de la loop
suivante par un batch précédent.

## Non-négociables applicables à cette série (rappel, voir CLAUDE.md racine)

- **#4** : aucun outil d'écriture auto-exécuté depuis le chat ; le Master Agent outreach
  est `sendAllowed: false` / `requiresUserReview: true` **toujours** — invariant à tester
  explicitement, pas seulement à supposer correct en lisant le code.
- **#5** : mots interdits ("guarantee", "promise", "certain", "will deliver", "risk-free")
  — s'applique aux emails générés par `outreach-writer*` ET aux réponses du chat qui
  mentionnent l'outreach.
- **ADR-016** : `OUTREACH_AUTONOMY` off par défaut (`SUGGEST`), cap quotidien, warm-up,
  Tier A jamais auto-envoyé — invariants testables, pas seulement documentés.
- **Règle d'or `docs/EMAIL_CONTEXT.md`** : pendant tout ce travail d'audit, rester en
  preview/draft — **aucun envoi réel**, aucune campagne réelle, aucun appel Apollo réel
  (consommation de crédits) sans confirmation explicite d'Adrien.

## Zones de test disjointes (détail : `BATCHES.md`)

Cinq zones couvrant l'intégralité de l'inventaire (`INVENTORY.md`), sans recouvrement de
fichiers entre elles — un batch peut donc travailler sans verrou sur le scope d'un autre :

| # | Zone | Racine des fichiers |
|---|---|---|
| 1 | Domaine & politique (pur, sans I/O) | `src/lib/outreach/*.ts` (hors composants) |
| 2 | Agents LLM du pipeline batch | `src/lib/agents/outreach-scorer.ts`, `outreach-writer.ts`, `outreach-writer-extended.ts`, `outreach-reply-handler.ts` |
| 3 | Master Agent (intent chat) + swarm + canvas | `src/lib/agents/outreach-master-*.ts`, `src/lib/agents/swarms/outreach-swarm-*.ts`, `src/lib/canvas/outreach-*.ts`, `src/lib/agentic/outreach-integration.ts` |
| 4 | Infra : jobs, routes, diagnostics, data layer | `src/lib/inngest/functions/outreach-*.ts`, `src/app/api/outreach/*`, `src/app/api/admin/diagnostics/outreach/*`, `src/lib/admin/diagnostics/outreach-*.ts`, `src/lib/data/outreach.ts`, `src/lib/admin/outreach-kpi-strip.ts` |
| 5 | UI admin (pages, Server Actions, composants) | `src/app/admin/outreach/*`, `src/components/admin/outreach/*`, `src/components/admin/diagnostics/outreach-lifecycle-demo.tsx` |

Chaque zone est mappée sur exactement un batch (2→zone 1, 3→zone 2, 4→zone 3, 5→zone 4,
6→zone 5 — voir `BATCHES.md` pour la table à jour et l'ordre réel choisi). Aucun fichier
n'apparaît dans deux zones ; les tests transversaux déjà existants (ex. `icp.test.ts` qui
exerce `tier.ts` indirectement) restent dans la zone du fichier testé, pas du fichier
testeur.

## Ce que cette série ne fait pas

- Pas de refonte du pipeline Outreach (le plan produit `docs/plan/outreach-engine.md`
  reste la source pour ça).
- Pas de nouvel ADR (sauf si un batch découvre une lacune de gouvernance nécessitant une
  décision Adrien — alors documenter dans `DECISIONS.md` et proposer, ne pas trancher seul).
- Pas de modification de `prisma/schema.prisma`, `.github/workflows/**`, `vercel.json`,
  secrets — hors scope de toute la série.
