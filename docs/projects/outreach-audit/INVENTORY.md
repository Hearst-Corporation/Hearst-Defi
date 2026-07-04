# INVENTORY.md — Outreach Component Inventory

> Batch 1/6 (architect, read-only). État constaté au 2026-07-04 sur `origin/main`
> (HEAD `552c8a0d`). Recensement exhaustif par `find`/`grep`, pas par mémoire — toute
> ligne ci-dessous a été vérifiée sur le fichier réel au moment de l'audit.

## 1. Vue d'ensemble — deux systèmes distincts sous un même nom

Le mot "Outreach" recouvre **deux sous-systèmes indépendants**, à ne jamais confondre
dans les zones de test (voir `PROJECT_PLAN.md` §zones) :

- **A. Le pipeline batch de lead-gen** (Sourcer → Enricher → Scorer → Writer → Sender →
  Reply-handler, cf. `docs/plan/outreach-engine.md`) — agents structurés JSON, jobs
  Inngest, Server Actions admin. Autorisé à envoyer réellement (tiers B/C), gouverné par
  ADR-016.
- **B. Le Master Agent outreach du chat cockpit** (`outreach-master-*.ts`) — classificateur
  d'intent (regex → semantic fallback → swarm) qui décide *navigation* / *ouverture de
  canvas* dans le chat. **N'envoie jamais rien**, `sendAllowed` et invariants figés à
  `false`/`true` par construction (ADR-012/ADR-017). Aucun rapport de code direct avec le
  pipeline A hormis le fait qu'il peut *afficher* des données du pipeline A via des
  canvas/actions cards.

## 2. Prisma — modèles de données (`prisma/schema.prisma`)

| Modèle | Rôle | Champs notables |
|---|---|---|
| `OutreachProspect` | Le lead — CRM outreach | `source` (manual/csv/import/apollo), `status` (new→contacted→…→qualified/converted/opted_out/bounced), `qualScore`, `tier` (A/B/C), `apolloId`, `sequenceStep` |
| `OutreachCampaign` | Groupe d'envoi | `kind` (cold/newsletter/direct), `status` (draft/review/sending/sent) |
| `OutreachEmail` | Un envoi (campagne × destinataire) | `status`, `tierAtSend`, `autonomyAtSend` (audit gouvernance), `resendEmailId` |
| `OutreachEmailEvent` | Événement webhook Resend | `type` (delivered/opened/clicked/bounced/complained) |
| `OutreachReply` | Réponse entrante (Palier 4, boucle fermée) | `intent`, `confidence`, `actionTaken` |
| `OutreachICP` | Persona cible + seuils de tier | `tierAMin`/`tierBMin`/`tierCMin` (85/60/40 par défaut), filtres Apollo (JSON strings) |
| `OutreachSuppression` | Liste de suppression envoi | `email`/`domain`, `reason` (opt_out/bounce/complaint/manual/recent_contact), `until` |

**Pas de modèle "reject" dédié.** Les candidats rejetés (score < `tierCMin`, ou email
Apollo non vérifié) ne sont **jamais persistés** — ils sont comptés en agrégat
(`rejectedUnverified`, `rejectedTier` dans le retour de `icp.ts`) et jetés. C'est
cohérent avec la politique "pas de fausse donnée" du repo (pas de ligne fantôme pour un
lead qui n'existe pas), mais signifie qu'**aucun audit trail des rejets individuels
n'existe** — un futur audit de "pourquoi ce prospect a-t-il été rejeté" ne peut se fier
qu'aux logs de run, pas à la base. À documenter comme limite connue, pas un bug.

**Pas de seed Outreach** dans `prisma/seed.ts` / `prisma/seed-admin-only.ts` — aucune
donnée de démo pré-chargée pour ce module ; tout est créé à l'exécution (sourcing réel ou
saisie manuelle admin).

## 3. Domaine & politique — `src/lib/outreach/*` (zone 1, pure logic)

| Fichier | Lignes | Rôle |
|---|---|---|
| `icp.ts` | 448 | Pipeline sourcing→enrich→score→dédoublonnage, calcule les stats de rejet |
| `tier.ts` | 80 | Résout un score en tier A/B/C/rejeté depuis les seuils de l'ICP |
| `lifecycle.ts` | 128 | États du cycle de vie prospect/email |
| `send-policy.ts` | 183 | Décision d'envoi par tier × `OUTREACH_AUTONOMY` × quota jour + warm-up (`WARMUP_FLOOR=10`, `WARMUP_DAYS=14`) |
| `suppression.ts` | 40 | Vérifie l'appartenance à la liste de suppression |
| `unsubscribe.ts` | 95 | Token signé de désinscription (génère/valide) |
| `cta-url.ts` | 70 | Construit l'URL de call-to-action des emails |
| `autonomy-status.ts` | 167 | Dérive un statut lisible du dial `OUTREACH_AUTONOMY` + cap du jour |
| `mailbox-readiness.ts` | 177 | Vérifie la préparation d'une boîte d'envoi (warm-up, quota) |
| `events.ts` | 21 | Constantes de nom d'événement Inngest |
| `status-variants.ts` | 44 | Constantes de présentation (badge variant par statut) — pas de logique métier |

## 4. Agents LLM du pipeline batch — zone 2 (`src/lib/agents/`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `outreach-scorer.ts` | 222 | LLM → `{score, tier, reasons[]}` Zod-validé |
| `outreach-writer.ts` | 328 | LLM → email persona distributeur (base) |
| `outreach-writer-extended.ts` | 378 | Variante étendue du writer |
| `outreach-reply-handler.ts` | 190 | LLM → classe une réponse entrante (intent + action) |

## 5. Master Agent (intent chat) + swarm + canvas — zone 3

| Fichier | Lignes | Rôle |
|---|---|---|
| `agents/outreach-master-agent.ts` | 298 | Orchestrateur : regex → semantic fallback → swarm. Invariants figés `sendAllowed=false`, `requiresUserReview=true` |
| `agents/outreach-master-regex.ts` | 533 | Classification déterministe (priorité absolue sur le semantic) |
| `agents/outreach-master-semantic.ts` | 355 | Fallback HuggingFace zero-shot (seuil strict 0.85, timeout 4s) |
| `agents/outreach-master-safety.ts` | 312 | Garde-fous de sécurité de la décision |
| `agents/outreach-master-types.ts` | 168 | Types partagés (pas de logique) |
| `agents/swarms/outreach-swarm-orchestrator.ts` | 303 | Orchestration multi-agent du swarm |
| `agents/swarms/outreach-swarm-types.ts` | 389 | Types du swarm |
| `canvas/outreach-action-cards.ts` | 520 | Rendu des cartes d'action outreach dans le canvas chat |
| `canvas/outreach-turn.ts` | 277 | Tour de conversation outreach dans le canvas |
| `agentic/outreach-integration.ts` | 351 | Point de jonction agentic ↔ outreach |

## 6. Infra : jobs, routes, diagnostics, data layer — zone 4

| Fichier | Lignes | Rôle |
|---|---|---|
| `inngest/functions/outreach-send.ts` | 264 | Job d'envoi (campagne `sending` → délivre les emails `approved`) |
| `inngest/functions/outreach-auto-send.ts` | 318 | Envoi autonome tiers B/C gouverné par `send-policy` |
| `inngest/functions/outreach-followups.ts` | 310 | Relances programmées (J+3, J+7…) |
| `app/api/outreach/inbound/route.ts` | — | Webhook réponse entrante (Palier 4) |
| `app/api/outreach/unsubscribe/route.ts` | — | Route de désinscription (token signé) |
| `app/api/admin/diagnostics/outreach/route.ts` | 58 | Endpoint diagnostics admin |
| `admin/diagnostics/outreach-diagnostics.ts` | 233 | Calcul des diagnostics outreach |
| `admin/diagnostics/outreach-lifecycle.ts` | 222 | Calcul du cycle de vie pour diagnostics |
| `data/outreach.ts` | 618 | Requêtes/agrégats data layer (stats, listes) |
| `admin/outreach-kpi-strip.ts` | 54 | Dérive les KPIs honnêtes du header (provenance "manual", rates masqués tant que `sent=0`) |

## 7. UI admin — zone 5 (`src/app/admin/outreach/*`, `src/components/admin/outreach/*`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `app/admin/outreach/page.tsx` | 263 | Page racine du directory outreach |
| `app/admin/outreach/actions.ts` | 1031 | **13 Server Actions** : `addProspect`, `importProspects`, `createCampaign`, `approveEmail`, `updateEmail`, `sendCampaign`, `draftAllCampaignEmails`, `draftDirectEmail`, `draftEmailForProspect`, `sendDirectEmail`, `createIcp`, `runSourcing`, `overrideTier` |
| `app/admin/outreach/compose/page.tsx` | — | Page de composition |
| `app/admin/outreach/[campaignId]/page.tsx` + `loading.tsx` | — | Détail campagne |
| `app/admin/outreach/prospects/[id]/page.tsx` + `loading.tsx` | — | Fiche prospect |
| `app/admin/outreach/loading.tsx`, `error.tsx` | 78 / 17 | États de chargement/erreur |
| `components/admin/outreach/campaign-form.tsx` | 132 | Formulaire campagne |
| `components/admin/outreach/direct-send-form.tsx` | 207 | Formulaire envoi direct (seul composant testé) |
| `components/admin/outreach/draft-campaign-button.tsx` | 43 | Bouton brouillon |
| `components/admin/outreach/email-review-card.tsx` | 259 | Carte de review d'email |
| `components/admin/outreach/icp-form.tsx` | 154 | Formulaire ICP |
| `components/admin/outreach/icp-list.tsx` | 48 | Liste des ICP |
| `components/admin/outreach/prospect-add-form.tsx` | 130 | Ajout manuel prospect |
| `components/admin/outreach/prospect-import-form.tsx` | 98 | Import CSV |
| `components/admin/outreach/send-campaign-button.tsx` | 83 | Bouton envoi campagne |
| `components/admin/outreach/source-more-button.tsx` | 49 | Bouton "sourcer plus" |
| `components/admin/outreach/tier-badge.tsx` | 102 | Badge tier A/B/C |
| `components/admin/outreach/bento-form.ts` | 17 | Helper de layout de formulaire |
| `components/admin/diagnostics/outreach-lifecycle-demo.tsx` | 131 | Démo du cycle de vie (diagnostics admin) |

## 8. Dépendance externe

- `src/lib/apollo/client.ts` — wrapper Apollo (search + enrich), client injectable pour
  tests (mock fetch), `APOLLO_API_KEY` via `process.env` uniquement. **Testé**
  (`apollo/__tests__/client.test.ts`).

## 9. Env vars gouvernant Outreach (`src/lib/env.ts`)

`APOLLO_API_KEY` (optionnel), `OUTREACH_AUTONOMY` (enum `SUGGEST|SEND|NURTURE|CLOSED`,
défaut `SUGGEST`), `OUTREACH_DAILY_SEND_CAP` (défaut 30), `OUTREACH_MASTER_MODE`
(`deterministic_only|semantic_fallback|ask_clarification`, lu directement depuis
`process.env` dans `outreach-master-semantic.ts` — **pas** validé par le schéma Zod de
`env.ts`, à noter dans `ANTI_HARDCODING_CHECKLIST.md`).

## 10. Documentation existante à connaître avant tout travail sur cette zone

- `docs/plan/outreach-engine.md` — plan produit d'origine (Paliers 0-4)
- `docs/decisions/ADR-016-autonomous-outreach-sending-tiered.md` — gouvernance de l'envoi
- `docs/EMAIL_CONTEXT.md` — règle d'or "pas d'envoi réel" pendant un audit
- `docs/OWNERSHIP_MATRIX.md` (ligne "Email") — `src/lib/email/*` + `actions.ts` + `outreach-send.ts` sont owner "Email"/Backend, cross-review UI-Layout/DeFi
- `docs/VALIDATION_MATRIX.md` — validation minimale : `pnpm test src/lib/email` + `pnpm test` (jamais d'envoi réel)
