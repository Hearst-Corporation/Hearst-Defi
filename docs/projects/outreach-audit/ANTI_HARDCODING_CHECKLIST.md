# ANTI_HARDCODING_CHECKLIST.md — Outreach

> Checklist concrète, liée à des fichiers réels du module (pas générique). Chaque
> batch d'exécution (2-6) coche les points de sa zone dans son propre rapport final
> (`docs/projects/outreach-audit/PROJECT_STATE.md`, à créer par le batch 2) — ne pas
> cocher ici, ce fichier reste la définition de la checklist, pas son état.

## 1. Secrets & config — jamais en dur

- [ ] `APOLLO_API_KEY` n'apparaît que via `process.env` (client Apollo), jamais en
      chaîne littérale dans `src/lib/agents/outreach-scorer.ts`, `outreach-writer*.ts`,
      les jobs Inngest, ou un test qui ne serait pas mocké.
- [ ] `RESEND_API_KEY` idem — jamais en dur dans `outreach-send.ts`/`outreach-auto-send.ts`.
- [ ] `OUTREACH_AUTONOMY` (enum `SUGGEST|SEND|NURTURE|CLOSED`, défaut `SUGGEST`) et
      `OUTREACH_DAILY_SEND_CAP` (défaut 30) sont lus depuis `src/lib/env.ts` (Zod) —
      aucun batch/composant ne doit relire `process.env.OUTREACH_AUTONOMY` en direct
      ailleurs ni recopier une valeur par défaut différente en dur.
- [ ] Aucune adresse d'envoi (`fromEmail`) ni domaine de test codé en dur hors config/env
      (`OutreachCampaign.fromEmail` a un override légitime en DB — ce n'est pas un hardcode ;
      vérifier qu'il n'y a pas de fallback littéral genre `"test@hearst.app"` dans le code).

## 2. Seuils de tier — source unique de vérité

- [ ] Les seuils `tierAMin` (85), `tierBMin` (60), `tierCMin` (40) ne sont définis
      **que** dans `OutreachICP` (Prisma, valeurs par défaut) et lus via `tier.ts`.
      Vérifier qu'aucun agent (`outreach-scorer.ts`, `outreach-writer*.ts`, jobs
      Inngest, Server Actions) ne recopie `85`/`60`/`40` en dur pour re-décider un
      tier au lieu d'appeler `resolveTier()`.
- [ ] `overrideTier` (Server Action, `actions.ts:1002`) reste le seul chemin de
      dérogation manuelle documentée — pas de logique parallèle qui court-circuite
      silencieusement le tier calculé.

## 3. Mock / preview vs données réelles — ne jamais confondre

- [ ] Le générateur de score mock de `src/lib/outreach/icp.ts` (~L165, "Spread across
      35-98") reste strictement cantonné à la prévisualisation d'un ICP (avant tout
      run Apollo réel) — vérifier qu'aucun code de production ne peut recevoir ce mock
      comme un `qualScore` réel persisté sur un `OutreachProspect`.
    - **Comment vérifier** : tracer les appelants de la fonction de preview dans
      `icp.ts` — doivent tous être des routes/composants UI de simulation, jamais
      `outreach-source.ts`/le job de sourcing réel.
- [ ] Si ce mock est surfacé dans l'UI (aperçu de seuils), il porte un badge de
      provenance explicite (`Estimated` a minima) — non-négociable CLAUDE.md #2, même
      si "APY range" ne s'applique pas ici, le principe de provenance s'applique à
      toute métrique affichée.

## 4. Mots interdits & conformité contenu

- [ ] La sortie de `outreach-writer.ts`, `outreach-writer-extended.ts` et
      `outreach-reply-handler.ts` (texte destiné à un tiers réel) passe par le garde
      mots-interdits (CLAUDE.md #5 : "guarantee", "promise", "certain", "will deliver",
      "risk-free") avant tout `status: approved`/`sent`.
- [ ] Le pitch distributeur (persona V1, `docs/plan/outreach-engine.md`) reste
      "économie de distribution", pas une promesse de rendement — pas de phrase
      copiée-collée avec un chiffre d'APY en dur dans un template email.

## 5. Envoi gouverné — pas de bypass

- [ ] Tout chemin qui flip un `OutreachEmail.status` vers `sending`/`sent` passe par
      `send-policy.ts` (tier × `OUTREACH_AUTONOMY` × quota) — pas de Server Action ni
      de job qui appelle directement Resend sans consulter la policy.
- [ ] `sendCampaign` (`actions.ts:355`) et `sendDirectEmail` (`actions.ts:703`) restent
      un flip de statut humain (`approved` → fan-out Inngest), pas un envoi direct
      synchrone dans la Server Action elle-même.
- [ ] Le cap quotidien (`OUTREACH_DAILY_SEND_CAP`) et la file priorisée
      Prime>Warm>Cold sont appliqués **dans le job** (`outreach-auto-send.ts`), pas
      recalculés/dupliqués ailleurs avec un chiffre en dur différent.
- [ ] Tier A ("Prime") ne peut **jamais** atteindre un statut auto-envoyé — vérifier
      qu'aucun chemin (registry chat, job, Server Action) ne peut faire passer un
      prospect tier A directement en `sent` sans validation humaine explicite (ADR-016).

## 6. Désinscription & suppression — jamais silencieusement contournées

- [ ] Chaque template email injecte un lien `{{unsubscribe}}` **dynamique**
      (`cta-url.ts`/`unsubscribe.ts` — token signé), jamais une URL statique.
- [ ] `outreach-auto-send.ts` / `outreach-send.ts` / `outreach-followups.ts`
      interrogent `OutreachSuppression` (via `suppression.ts`) **avant** chaque envoi
      — pas de cache/liste en dur de domaines/emails supprimés dans le code du job.
- [ ] `api/outreach/unsubscribe/route.ts` écrit bien dans `OutreachSuppression` +
      passe le prospect `opted_out` (pas seulement un flag en mémoire/log).

## 7. Chat / registry (ADR-012, ADR-017) — bornes intactes

- [ ] Les outils `outreach_*` de `src/lib/llm/tools/registry.ts` restent : lecture
      libre (`outreach_list_prospects`, `outreach_stats`), écriture **toujours**
      brouillon/HITL (`outreach_draft_email`), envoi **toujours** gouverné par
      `OUTREACH_AUTONOMY` avec confirmation à deux temps (`outreach_trigger_send_run`).
      Aucun outil ne doit gagner un mode d'exécution directe sans ce garde.
- [ ] `outreach-master-agent.ts` : `sendAllowed` toujours `false`,
      `requiresUserReview` toujours `true` en sortie — sur **tous** les chemins,
      y compris ceux non testés aujourd'hui (`outreach-master-semantic.ts` fallback,
      voir `TEST_COVERAGE_MATRIX.md`).

## 8. Anti-régression (couverture de test)

- [ ] Aucun batch de cette série ne **réduit** la couverture existante — si un test
      est déplacé/renommé, l'ancien fichier ne doit pas disparaître sans que le
      nouveau couvre au moins les mêmes cas.
- [ ] Toute nouvelle fonction ajoutée dans une zone auditée (ex. correction d'un
      trou de `TEST_COVERAGE_MATRIX.md`) vient avec son test dans le même commit —
      pas de "je teste plus tard".
- [ ] `pnpm typecheck` reste à 0 erreur après chaque batch (gate réel, cf. CLAUDE.md
      "lint is advisory, typecheck is the real gate").
- [ ] Baseline (`pnpm test`) : le nombre de tests verts ne régresse jamais d'un batch
      à l'autre sur le périmètre Outreach — le batch 2 fixe le nombre de référence
      dans `PROJECT_STATE.md`, chaque batch suivant compare contre ce nombre.

## 9. Secrets-scan / sécurité (rappel transverse)

- [ ] Lancer (ou faire lancer) le skill `secrets-scan` sur les fichiers touchés par
      chaque batch avant de considérer la zone close — cohérent avec
      `docs/EMAIL_CONTEXT.md` ("Secrets via `process.env`, jamais en dur").
