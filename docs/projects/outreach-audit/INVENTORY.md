# INVENTORY.md — Outreach System Component Map

> Constaté sur le code au 2026-07-04 (batch 1/6, lecture seule). Chemins et comptes de
> lignes vérifiés par `find` / `wc -l` sur ce checkout. Recompter si un batch ultérieur
> a modifié ces fichiers — ce document est un instantané, pas une source vivante.

## A. Datasets (Prisma, `prisma/schema.prisma` ~L1094-1268)

| Modèle | Rôle | Champs clés |
|---|---|---|
| `OutreachProspect` | Le lead — manuel/CSV/import/Apollo | `status` (new→…→opted_out/bounced), `qualScore`, `tier` (A/B/C/null), `icpId`, `sequenceStep`, `lastContactedAt`, snapshot Apollo (`apolloData`, `emailStatus`, `linkedinUrl`, `companyDomain`) |
| `OutreachCampaign` | Un run d'envoi (cold/newsletter/direct) | `kind`, `status` (draft→review→sending→sent) |
| `OutreachEmail` | Une ligne (campagne × destinataire) | `status` (draft→approved→sent→delivered→opened→clicked→bounced/failed), `tierAtSend`, `autonomyAtSend` (audit du policy au moment de l'envoi) |
| `OutreachEmailEvent` | Event Resend webhook | `type` (delivered/opened/clicked/bounced/complained) |
| `OutreachReply` | Réponse entrante (Palier 4, boucle fermée) | `intent` (interested/not_now/question/unsubscribe/bounce/auto_reply/other), `actionTaken` (promoted/stopped/qualified/suppressed/none) |
| `OutreachICP` | Persona cible + **seuils de tier** | `tierAMin` (déf. 85), `tierBMin` (déf. 60), `tierCMin` (déf. 40) — sous ce dernier seuil = **rejeté** |
| `OutreachSuppression` | Liste do-not-contact (distincte du rejet ICP) | `email`/`domain`, `reason` (opt_out/bounce/complaint/manual/recent_contact), `until` (null = permanent) |

**Deux mécaniques de "rejet" distinctes à ne pas confondre dans l'audit** (voir aussi
`ANTI_HARDCODING_CHECKLIST.md`) :
1. **Rejet par score** (`tier.ts::resolveTier` → `null` si `score < tierCMin`) — le
   prospect n'est jamais créé/qualifié, compté dans `icp.ts` via `rejectedTier` et
   `rejectedUnverified` (email Apollo non vérifié, `src/lib/outreach/icp.ts:120-122`).
2. **Suppression** (`OutreachSuppression`) — un prospect déjà connu, qu'on ne recontacte
   plus jamais (opt-out RGPD/CAN-SPAM, bounce, manuel), indépendamment de son score.

## B. Agents LLM (`src/lib/agents/`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `outreach-scorer.ts` | 222 | Score 0-100 + tier + `reasons[]` (sortie Zod) |
| `outreach-writer.ts` | 328 | Rédaction email (persona distributeur) |
| `outreach-writer-extended.ts` | 378 | Variante étendue du writer |
| `outreach-reply-handler.ts` | 190 | Classe une réponse entrante → action (Palier 4) |
| `outreach-master-agent.ts` | 298 | Orchestrateur du classifieur d'intent chat (regex → semantic → unknown) |
| `outreach-master-regex.ts` | 533 | Couche déterministe (priorité, haute confiance) |
| `outreach-master-semantic.ts` | 355 | Fallback HuggingFace pour intents ambigus |
| `outreach-master-safety.ts` | 312 | Garde-fous : `sendAllowed` toujours `false`, `requiresUserReview` toujours `true` |
| `outreach-master-types.ts` | 168 | Types partagés du classifieur |
| `swarms/outreach-swarm-orchestrator.ts` | 303 | Orchestration multi-agent (invoquée par le master agent si besoin) |
| `swarms/outreach-swarm-types.ts` | 389 | Types du swarm |

## C. Gouvernance / policy (non-LLM, `src/lib/outreach/`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `tier.ts` | 80 | `resolveTier(score, icp)` → A/B/C/`null` (rejet) |
| `send-policy.ts` | 183 | Décide envoi auto par tier × `OUTREACH_AUTONOMY` × quota du jour |
| `autonomy-status.ts` | 167 | État courant du flag `OUTREACH_AUTONOMY` pour l'UI/diagnostics |
| `mailbox-readiness.ts` | 177 | Vérifie l'état de warm-up de la boîte d'envoi |
| `suppression.ts` | 40 | Lookup `OutreachSuppression` (email/domaine) |
| `unsubscribe.ts` | 95 | Génère/valide le token signé de désinscription |
| `cta-url.ts` | 70 | Construit les URLs (dont le lien `{{unsubscribe}}`) injectées dans l'email |
| `lifecycle.ts` | 128 | Machine d'états `OutreachProspect.status` |
| `icp.ts` | 448 | Simulation de sourcing/scoring pour l'UI ICP (preview) + stats `rejectedUnverified`/`rejectedTier` |
| `events.ts` | 21 | Constantes d'events (`OUTREACH_EVENTS.SOURCE`, etc.) |
| `status-variants.ts` | 44 | Mapping statut → variant visuel (badges) |

> **Point d'attention** : `icp.ts` contient un générateur de scores **mock** ("Spread
> across 35-98 so the mock yields a realistic A/B/C/reject mix", `icp.ts:165`) utilisé
> pour prévisualiser un ICP avant un vrai run Apollo. À vérifier par le batch concerné :
> ce mock ne doit jamais être confondu avec un score réel ni afficher un badge de
> provenance autre que `Estimated`/mock explicite (non-négociable CLAUDE.md #2).

## D. Jobs Inngest (`src/lib/inngest/functions/`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `outreach-send.ts` | 264 | Fan-out d'envoi des lignes `approved` (chemin `SUGGEST`, humain a validé) |
| `outreach-auto-send.ts` | 318 | Envoi autonome tier B/C gouverné par `send-policy.ts` (ADR-016) |
| `outreach-followups.ts` | 310 | Cadence de relance (J+3/J+7/stop), `sequenceStep` |

## E. Couche données (`src/lib/data/outreach.ts`, 618 lignes)

Requêtes Prisma consommées par les Server Components admin (directory, KPI, détail
prospect/campagne). Pas de fetch client — cohérent avec `CLAUDE.md` (pas de data
fetching côté client).

## F. UI Admin (`src/app/admin/outreach/`, `src/components/admin/outreach/`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `page.tsx` | 263 | Directory prospects + KPI strip + form ICP |
| `actions.ts` | 1031 | **13 Server Actions** : `addProspect`, `importProspects`, `createCampaign`, `approveEmail`, `updateEmail`, `sendCampaign`, `draftAllCampaignEmails`, `draftDirectEmail`, `draftEmailForProspect`, `sendDirectEmail`, `createIcp`, `runSourcing`, `overrideTier` |
| `compose/page.tsx` | 62 | Compose direct |
| `[campaignId]/page.tsx` | 194 | Détail campagne |
| `prospects/[id]/page.tsx` | 441 | Fiche prospect (CRM sheet, snapshot Apollo) |
| `error.tsx`, `loading.tsx`, `[campaignId]/loading.tsx`, `prospects/[id]/loading.tsx` | — | États UI standards |
| `components/admin/outreach/*.tsx` (12 fichiers, 1322 l.) | — | `campaign-form`, `direct-send-form`, `draft-campaign-button`, `email-review-card`, `icp-form`, `icp-list`, `prospect-add-form`, `prospect-import-form`, `send-campaign-button`, `source-more-button`, `tier-badge`, `bento-form` (helper) |

## G. API routes (`src/app/api/outreach/`, `src/app/api/admin/diagnostics/outreach/`)

| Route | Rôle |
|---|---|
| `outreach/inbound/route.ts` | Webhook réponse entrante (Palier 4) → crée `OutreachReply` |
| `outreach/unsubscribe/route.ts` | `GET` token signé → `opted_out` + `OutreachSuppression` |
| `admin/diagnostics/outreach/route.ts` | Lecture diagnostics (lifecycle/autonomy) pour l'admin |

## H. Intégration chat (ADR-012/017, `src/lib/llm/tools/registry.ts` ~L839-1240)

Outils exposés au **cockpit chat unique** (pas un chemin séparé) :
`outreach_list_prospects`, `outreach_stats` (lecture), `outreach_source_leads`,
`outreach_draft_email` (write — brouillon, HITL), `outreach_trigger_send_run` (le
seul outil qui touche l'envoi — reste borné par `OUTREACH_AUTONOMY`, jamais
auto-exécuté sans confirmation ; Tier A jamais auto-envoyé, cf. commentaire
`registry.ts:842-843`).

Support canvas : `src/lib/canvas/outreach-turn.ts` (277 l.), `outreach-action-cards.ts`
(520 l.). Intégration agentique transverse : `src/lib/agentic/outreach-integration.ts`
(351 l.).

## I. Diagnostics / démo admin

| Fichier | Rôle |
|---|---|
| `src/lib/admin/diagnostics/outreach-diagnostics.ts` (233 l.) | Snapshot diagnostics (pipeline, quotas) |
| `src/lib/admin/diagnostics/outreach-lifecycle.ts` (222 l.) | Étapes de cycle de vie pour l'UI diagnostics |
| `src/components/admin/diagnostics/outreach-lifecycle-demo.tsx` (131 l.) | Composant de démonstration (admin diagnostics) |
| `src/lib/admin/outreach-kpi-strip.ts` (54 l.) | Agrégats KPI affichés sur `/admin/outreach` |

## J. Docs / ADR de référence (à ne pas dupliquer, seulement lier)

- `docs/plan/outreach-engine.md` — spec du moteur (6 agents, paliers 0-4)
- `docs/decisions/ADR-016-autonomous-outreach-sending-tiered.md` — gouvernance d'envoi
- `docs/EMAIL_CONTEXT.md` — règle d'or "pas d'envoi réel" + fichiers à charger
- `docs/OWNERSHIP_MATRIX.md:17` — ligne Email (owner Backend, conflits UI-Layout/DeFi)

## Totaux constatés (ce batch, 2026-07-04)

- **Source** (hors tests) : ~50 fichiers distincts sur les répertoires ci-dessus
  (21 fichiers au nom `outreach-*` = 6774 lignes, + 11 fichiers `src/lib/outreach/*`
  = 1453 lignes, + 5 pages/actions admin = 1991 lignes, + 12 composants = 1322 lignes,
  + 3 routes API).
- **Tests dédiés outreach** : 23 fichiers de test (20 unit/intégration Vitest +
  `e2e/outreach-master-agent.spec.ts`), ~4782 lignes. Détail et écarts réels dans
  `TEST_COVERAGE_MATRIX.md`.
