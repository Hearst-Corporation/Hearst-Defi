# PROJECT_PLAN.md — Outreach Audit Series

> Plan établi par le batch 1/6 (architecte, read-only), 2026-07-04.
> Series: `series_opus_audit_hearst-defi` (famille `audit`), composée par opus.
> Exécution : **séquentielle, manuelle** — Adrien lance chaque loop un par un ; aucun
> auto-dispatch, aucun auto-merge n'est autorisé par cette série.

## Contexte

Le module Outreach (`docs/plan/outreach-engine.md`, ADR-016) est le sous-système le
plus dense du repo : 6 agents (sourcer/enricher/scorer/writer/sender/reply-handler),
un routage d'autonomie à 3 tiers (A/B/C + rejet), un moteur de suppression/désinscription,
une intégration chat (ADR-012/017, read-only + write-draft human-in-the-loop), des jobs
Inngest, ~50 fichiers source pour ~6.8k lignes, et une trentaine de fichiers de test
(~4.8k lignes). Il touche des garde-fous produit non-négociables (CLAUDE.md #4, #5) et
un chemin d'envoi réel (Resend) qui ne doit **jamais** partir par accident.

Cette série d'audit (6 batches) vérifie que le système tient ses garanties — pas de
send non gouverné, pas de valeur en dur qui contredit une config (tier thresholds,
quotas, provenance), pas de régression de couverture de test — sans y ajouter de
fonctionnalité.

## Objectif de ce batch (1/6 — architecte)

Produire les artefacts de planification qui cadrent les 5 batches d'exécution suivants :

1. **`INVENTORY.md`** — inventaire exhaustif des composants Outreach (datasets, agents,
   policy/gouvernance, jobs, UI admin, API, intégration chat, diagnostics) avec chemins
   et compteurs de lignes réels.
2. **`TEST_COVERAGE_MATRIX.md`** — mapping fichier source → fichier(s) de test, avec le
   statut réel (couvert / partiel / aucun test dédié) constaté sur le code actuel.
3. **`BATCHES.md`** — 5 zones de test **disjointes** (aucun chevauchement de fichier)
   pour les batches 2 à 6, avec owner zone, dépendances, et validations attendues.
4. **`ANTI_HARDCODING_CHECKLIST.md`** — checklist concrète (liée à des fichiers réels)
   contre les valeurs en dur et les régressions, à cocher par chaque batch d'exécution.

**Cette loop ne code pas.** Aucun fichier source, `prisma/**`, `.github/workflows/**`,
secret, ou `vercel.json` n'a été modifié. Seuls des artefacts sous
`docs/projects/outreach-audit/` sont produits.

## Méthodologie utilisée pour cet inventaire

- Lecture directe du filesystem (`find`, `wc -l`, `grep`) — pas de supposition sur des
  fichiers qui pourraient avoir été renommés/supprimés depuis les docs existantes.
- Croisement avec les docs déjà en place : `docs/plan/outreach-engine.md` (spec du moteur
  lead-gen, paliers 0-4), `docs/decisions/ADR-016-autonomous-outreach-sending-tiered.md`
  (gouvernance d'envoi), `docs/EMAIL_CONTEXT.md` (règle d'or "pas d'envoi réel"),
  `docs/OWNERSHIP_MATRIX.md` (ligne Email), `AGENTS.md` (routing).
  Ces docs restent la source de vérité produit/architecture ; cet audit constate
  l'état du **code** par rapport à ces contrats, il ne les redéfinit pas.
- Lecture du schéma Prisma (`prisma/schema.prisma`, section `OutreachProspect` →
  `OutreachSuppression`, lignes ~1094-1268) en lecture seule pour documenter les 7
  modèles de données ("datasets"). Aucune migration n'a été touchée.
- Tentative d'exécution de la suite de tests Outreach ciblée : **`node_modules` absent
  sur ce runner** (checkout sans `pnpm install`), donc **aucun test n'a été exécuté**
  par ce batch. La vérification baseline (`pnpm db:generate` + `pnpm typecheck` +
  `pnpm test` sur le périmètre Outreach) est un prérequis explicite du **batch 2**
  (voir `BATCHES.md`) — ne pas supposer la suite verte avant cette étape.

## Non-négociables spécifiques à Outreach (rappel, ne pas re-décider ici)

- **Pas d'envoi réel** pendant un audit : rester en preview/draft (`EMAIL_CONTEXT.md`).
  Aucun batch de cette série ne doit faire passer `OUTREACH_AUTONOMY` au-dessus de
  `SUGGEST` ni déclencher `sendCampaign` / `outreach_trigger_send_run` en conditions
  réelles.
- **Tier A "Prime" n'est jamais auto-envoyé** (ADR-016) — brouillon uniquement.
- **Mots interdits** ("guarantee", "promise", "certain", "will deliver", "risk-free")
  s'appliquent à toute copie générée par `outreach-writer*` / `outreach-reply-handler`.
- **Chat = read-only + write-draft avec confirmation à deux temps** (ADR-012, ADR-017) —
  aucun outil du registry (`outreach_*`) ne doit pouvoir exécuter un envoi sans le
  garde-fou `OUTREACH_AUTONOMY` + cap quotidien.
- **Désinscription et suppression toujours respectées** : tout chemin d'envoi doit
  sauter un destinataire présent dans `OutreachSuppression` ou `opted_out`.

## Prochaine étape

Batch 2 démarre par la vérification baseline (voir `BATCHES.md` → Zone 1) avant tout
travail d'audit substantif, pour ne pas confondre une régression pré-existante avec un
finding de cette série.
