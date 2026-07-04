# COVERAGE_MATRIX.md — Outreach Test Coverage

> Batch 1/6 (architect, read-only). Méthode : pour chaque fichier source non-test sous
> les répertoires Outreach, recherche d'un fichier `__tests__/<name>.test.ts(x)` colocalisé
> **et** recherche par `grep` d'un import du module dans n'importe quel fichier `*.test.*`
> du repo (couverture indirecte). "Couvert" = au moins un test exécute ce module ;
> ça ne mesure pas le % de branches, juste présence/absence de tout test.

## Légende

- ✅ **Direct** — fichier `__tests__/<name>.test.*` colocalisé dédié.
- 🟡 **Indirect** — pas de test dédié, mais importé/exercé par un test d'un autre module.
- ❌ **Aucun** — aucune trace de test, directe ou indirecte, trouvée dans tout le repo.

## Zone 1 — Domaine & politique (`src/lib/outreach/*`)

| Fichier | Couverture | Note |
|---|---|---|
| `icp.ts` | ✅ Direct | `icp.test.ts` — dédoublonnage, stats de rejet, seuils tier testés |
| `send-policy.ts` | ✅ Direct | `send-policy.test.ts` |
| `autonomy-status.ts` | ✅ Direct | `autonomy-status.test.ts` |
| `mailbox-readiness.ts` | ✅ Direct | `mailbox-readiness.test.ts` |
| `unsubscribe.ts` | ✅ Direct | `unsubscribe.test.ts` — round-trip token, tamper, malformed |
| `cta-url.ts` | ✅ Direct | `cta-url.test.ts` |
| `lifecycle.ts` | ✅ Direct | `lifecycle.test.ts` |
| `tier.ts` | 🟡 Indirect | Pas de `tier.test.ts` dédié, mais exercé via `icp.test.ts` + `send-policy.test.ts`. Risque : les cas limites propres à `tier.ts` (clamp d'ordre des seuils défensif, cf. commentaire ligne 37) ne sont testés qu'en creux via les scénarios d'`icp`/`send-policy`, pas isolément. |
| `suppression.ts` | ❌ Aucun | **Gap réel.** Utilisé dans 4 call-sites critiques (`actions.ts`, `outreach-send.ts`, `outreach-auto-send.ts`, `outreach-followups.ts`) mais aucun test n'exerce directement sa logique de correspondance email/domaine/`until`. Les tests des call-sites (`outreach-send.test.ts` etc.) mockent probablement Prisma sans forcer les branches de `suppression.ts` elles-mêmes. **Priorité haute** — c'est une brique de conformité (opt-out/bounce). |
| `events.ts` | ❌ Aucun | 21 lignes, constantes de nom d'événement — risque faible, priorité basse. |
| `status-variants.ts` | ❌ Aucun | Constantes de présentation pures (mapping statut→badge) — risque faible, priorité basse (mais facile à tester : une assertion "toutes les clés `PROSPECT_VARIANT` couvrent les statuts Prisma valides" aurait de la valeur pour éviter un badge par défaut silencieux sur un nouveau statut). |

**Zone 1 : 7/11 direct, 1/11 indirect, 3/11 aucun.**

## Zone 2 — Agents LLM du pipeline batch (`src/lib/agents/`)

| Fichier | Couverture | Note |
|---|---|---|
| `outreach-scorer.ts` | ✅ Direct | `outreach-scorer.test.ts` |
| `outreach-writer.ts` | ✅ Direct | `outreach-writer.test.ts` |
| `outreach-writer-extended.ts` | ✅ Direct | `outreach-writer-extended.test.ts` |
| `outreach-reply-handler.ts` | ✅ Direct | `outreach-reply-handler.test.ts` |

**Zone 2 : 4/4 direct.** La zone la mieux couverte de tout le module — cohérent avec le
statut "agents structurés JSON" déjà mature (Paliers 0-2 du plan produit).

## Zone 3 — Master Agent (intent chat) + swarm + canvas

| Fichier | Couverture | Note |
|---|---|---|
| `outreach-master-regex.ts` | ✅ Direct | `outreach-master-regex.test.ts` |
| `outreach-master-safety.ts` | ✅ Direct | `outreach-master-safety.test.ts` |
| `outreach-master-agent.ts` | ❌ Aucun | **Gap notable.** C'est l'orchestrateur qui porte les invariants absolus documentés en tête de fichier (`sendAllowed` TOUJOURS false, `requiresUserReview` TOUJOURS true, unknown→no_action, regex prioritaire sur HF). Ces invariants sont testés *par construction* dans `outreach-master-regex.test.ts`/`outreach-master-safety.test.ts` pour chacune de leurs couches, mais **rien ne teste l'orchestrateur lui-même** (le point d'entrée réellement appelé) : pas de garantie que le câblage regex→semantic→swarm respecte l'ordre de priorité documenté, ni que le mode `AGENT_MODE` (lu depuis `process.env.OUTREACH_MASTER_MODE`) bascule correctement entre `deterministic_only`/`semantic_fallback`/`ask_clarification`. |
| `outreach-master-semantic.ts` | ❌ Aucun | Fallback HuggingFace (seuil 0.85, timeout 4s, hypothèses zero-shot FR+EN) — aucun test, y compris pas de test du comportement "fail-open" revendiqué en commentaire (réseau HF indisponible → ne doit jamais bloquer). |
| `outreach-master-types.ts` | N/A | Types uniquement, pas de logique — pas de gap. |
| `swarms/outreach-swarm-orchestrator.ts` | ✅ Direct | `outreach-swarm-orchestrator.test.ts` |
| `swarms/outreach-swarm-types.ts` | ✅ Direct | `outreach-swarm-types.test.ts` |
| `canvas/outreach-action-cards.ts` | ✅ Direct | `outreach-action-cards.test.ts` |
| `canvas/outreach-turn.ts` | ✅ Direct | `outreach-turn.test.ts` |
| `agentic/outreach-integration.ts` | ✅ Direct | `outreach-integration.test.ts` |

**Zone 3 : 7/9 direct (hors types), 2/9 aucun — mais les 2 manquants sont l'orchestrateur
principal et son fallback réseau, donc plus significatifs que leur simple ratio ne le
suggère.** `src/app/api/cockpit-chat/__tests__/route.outreach.test.ts` existe et teste le
chat de bout en bout, mais n'importe/n'exerce ni `outreach-master-agent.ts` ni
`outreach-master-semantic.ts` directement (vérifié par grep sur ses imports) — donc ne
comble pas ce gap.

## Zone 4 — Infra : jobs, routes, diagnostics, data layer

| Fichier | Couverture | Note |
|---|---|---|
| `inngest/functions/outreach-send.ts` | ✅ Direct | `outreach-send.test.ts` |
| `inngest/functions/outreach-auto-send.ts` | ✅ Direct | `outreach-auto-send.test.ts` |
| `inngest/functions/outreach-followups.ts` | ✅ Direct | `outreach-followups.test.ts` |
| `admin/diagnostics/outreach-diagnostics.ts` | ✅ Direct | `outreach-diagnostics.test.ts` |
| `admin/diagnostics/outreach-lifecycle.ts` | ✅ Direct | `outreach-lifecycle.test.ts` |
| `data/outreach.ts` | ✅ Direct | `data/__tests__/outreach.test.ts` |
| `app/api/outreach/inbound/route.ts` | 🟡 Indirect / à vérifier | Pas de `__tests__` colocalisé dans `app/api/outreach/` ; à confirmer batch 4 si un test existe ailleurs (ex. suite reply-handler) qui frappe réellement la route HTTP. |
| `app/api/outreach/unsubscribe/route.ts` | 🟡 Indirect / à vérifier | Idem — `unsubscribe.test.ts` teste la fonction token, pas la route elle-même (validation query param, redirect, statut HTTP). |
| `app/api/admin/diagnostics/outreach/route.ts` | ❌ Aucun | Endpoint diagnostics admin, aucun test de route trouvé. |
| `admin/outreach-kpi-strip.ts` | ❌ Aucun | Logique honnêteté ("pas de rate tant que `sent=0`") non testée — c'est exactement le genre de règle qui régresse silencieusement si quelqu'un refactore `data/outreach.ts` sans remarquer la dépendance. |

**Zone 4 : 6/10 direct, 2/10 indirect à vérifier, 2/10 aucun.**

## Zone 5 — UI admin

| Fichier | Couverture | Note |
|---|---|---|
| `app/admin/outreach/actions.ts` | 🟡 Partiel (2/13 actions) | Deux fichiers de test existent (`run-sourcing.test.ts`, `send-direct-email.test.ts`) mais ne couvrent que `runSourcing` et `sendDirectEmail`. **11 des 13 Server Actions exportées n'ont aucun test dédié** : `addProspect`, `importProspects`, `createCampaign`, `approveEmail`, `updateEmail`, `sendCampaign`, `draftAllCampaignEmails`, `draftDirectEmail`, `draftEmailForProspect`, `createIcp`, `overrideTier`. C'est le fichier le plus volumineux du module (1031 lignes) et le moins couvert proportionnellement — **priorité la plus haute de toute la série**. |
| `components/admin/outreach/direct-send-form.tsx` | ✅ Direct | `direct-send-form.test.tsx` |
| `components/admin/outreach/campaign-form.tsx` | ❌ Aucun | |
| `components/admin/outreach/draft-campaign-button.tsx` | ❌ Aucun | |
| `components/admin/outreach/email-review-card.tsx` | ❌ Aucun | |
| `components/admin/outreach/icp-form.tsx` | ❌ Aucun | |
| `components/admin/outreach/icp-list.tsx` | ❌ Aucun | |
| `components/admin/outreach/prospect-add-form.tsx` | ❌ Aucun | |
| `components/admin/outreach/prospect-import-form.tsx` | ❌ Aucun | |
| `components/admin/outreach/send-campaign-button.tsx` | ❌ Aucun | |
| `components/admin/outreach/source-more-button.tsx` | ❌ Aucun | |
| `components/admin/outreach/tier-badge.tsx` | ❌ Aucun | |
| `components/admin/outreach/bento-form.ts` | ❌ Aucun | Helper, risque faible. |
| `components/admin/diagnostics/outreach-lifecycle-demo.tsx` | ❌ Aucun | Composant de démo diagnostics, risque faible (pas de logique métier). |
| `app/admin/outreach/page.tsx`, `compose/page.tsx`, `[campaignId]/page.tsx`, `prospects/[id]/page.tsx`, `loading.tsx`×N, `error.tsx` | ❌ Aucun | Pages Server Components — cohérent avec le reste du repo (peu de pages ont des tests dédiés, souvent couvertes par Playwright E2E plutôt que Vitest ; à confirmer si un test E2E outreach existe — recherche `pnpm test:e2e` grep à faire par le batch 6). |

**Zone 5 : 1/14 (fichiers testables non-page) direct, 1/13 (actions) partiellement direct
— la zone la plus sous-testée du module, et celle qui porte le plus grand fichier de
logique métier (`actions.ts`).**

## Synthèse — priorités pour les batchs 2-6

1. **Zone 5 (`actions.ts`)** — 11 Server Actions non testées dans le fichier le plus gros
   du module. Risque de régression silencieuse sur `approveEmail`/`sendCampaign` (chemin
   d'envoi de campagne) particulièrement sensible.
2. **`suppression.ts` (zone 1)** — brique de conformité opt-out/bounce sans aucun test
   direct malgré 4 call-sites.
3. **`outreach-master-agent.ts` + `outreach-master-semantic.ts` (zone 3)** — l'orchestrateur
   qui porte les invariants absolus de sécurité (jamais d'envoi auto depuis le chat) n'est
   testé qu'indirectement via ses sous-couches, jamais comme point d'entrée.
4. **`outreach-kpi-strip.ts` (zone 4)** — logique d'honnêteté (masquage de rate à 0 envoi)
   non testée.
5. Reste de l'UI (zone 5, composants de formulaire) — risque plus faible (UI pure, peu de
   logique métier), priorité basse sauf si un batch UI a de la marge après le point 1.
