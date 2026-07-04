# TEST_COVERAGE_MATRIX.md — Outreach

> Mapping fichier source → fichier(s) de test, constaté par lecture directe du
> filesystem (2026-07-04, batch 1/6). **Non exécuté** : `node_modules` absent sur ce
> runner (voir `PROJECT_PLAN.md` → Méthodologie). "Couvert" ci-dessous signifie *"un
> fichier de test dédié existe et importe ce module"* — pas *"tous les tests passent"*.
> Le batch 2 doit installer les deps, exécuter la suite, et corriger ce statut si un
> test existant échoue.

Légende : ✅ couvert (test dédié) · 🟡 partiel (couvert indirectement / partiellement) ·
❌ aucun test dédié trouvé.

## Agents LLM (`src/lib/agents/`)

| Source | Test(s) | Statut |
|---|---|---|
| `outreach-scorer.ts` | `__tests__/outreach-scorer.test.ts` (319 l.) | ✅ |
| `outreach-writer.ts` | `__tests__/outreach-writer.test.ts` (176 l.) | ✅ |
| `outreach-writer-extended.ts` | `__tests__/outreach-writer-extended.test.ts` (244 l.) | ✅ |
| `outreach-reply-handler.ts` | `__tests__/outreach-reply-handler.test.ts` (118 l.) | ✅ |
| `outreach-master-regex.ts` | `__tests__/outreach-master-regex.test.ts` (436 l.) | ✅ |
| `outreach-master-safety.ts` | `__tests__/outreach-master-safety.test.ts` (333 l.) | ✅ |
| `outreach-master-agent.ts` (orchestrateur) | — | ❌ **aucun test direct** de l'orchestration regex→semantic→unknown ; seules les couches individuelles (regex, safety) sont testées |
| `outreach-master-semantic.ts` | — | ❌ **aucun test dédié** trouvé pour le fallback HuggingFace |
| `outreach-master-types.ts` | — | — (types uniquement, pas d'exécution attendue) |
| `swarms/outreach-swarm-orchestrator.ts` | `swarms/__tests__/outreach-swarm-orchestrator.test.ts` (435 l.) | ✅ |
| `swarms/outreach-swarm-types.ts` | `swarms/__tests__/outreach-swarm-types.test.ts` (221 l.) | ✅ |

## Gouvernance / policy (`src/lib/outreach/`)

| Source | Test(s) | Statut |
|---|---|---|
| `tier.ts` | couvert indirectement via `icp.test.ts` / `send-policy.test.ts` (pas de `tier.test.ts` dédié) | 🟡 |
| `send-policy.ts` | `__tests__/send-policy.test.ts` | ✅ |
| `autonomy-status.ts` | `__tests__/autonomy-status.test.ts` | ✅ |
| `mailbox-readiness.ts` | `__tests__/mailbox-readiness.test.ts` | ✅ |
| `suppression.ts` | — | ❌ **aucun test dédié** (40 l. — logique de lookup email/domaine, chemin critique désinscription) |
| `unsubscribe.ts` | `__tests__/unsubscribe.test.ts` | ✅ |
| `cta-url.ts` | `__tests__/cta-url.test.ts` | ✅ |
| `lifecycle.ts` | `__tests__/lifecycle.test.ts` | ✅ |
| `icp.ts` | `__tests__/icp.test.ts` | ✅ |
| `events.ts` | — | ❌ aucun test dédié (21 l. — constantes, risque faible) |
| `status-variants.ts` | — | ❌ aucun test dédié (44 l. — mapping UI, risque faible) |

## Jobs Inngest (`src/lib/inngest/functions/`)

| Source | Test(s) | Statut |
|---|---|---|
| `outreach-send.ts` | `__tests__/outreach-send.test.ts` (243 l.) | ✅ |
| `outreach-auto-send.ts` | `__tests__/outreach-auto-send.test.ts` (213 l.) | ✅ |
| `outreach-followups.ts` | `__tests__/outreach-followups.test.ts` (183 l.) | ✅ |

## Couche données

| Source | Test(s) | Statut |
|---|---|---|
| `src/lib/data/outreach.ts` (618 l.) | `__tests__/outreach.test.ts` (171 l.) | 🟡 — un test existe mais 171 l. de test pour 618 l. de source ; à vérifier batch dédié si toutes les requêtes exportées sont couvertes |

## UI Admin — pages & Server Actions (`src/app/admin/outreach/`)

| Source | Test(s) | Statut |
|---|---|---|
| `page.tsx` (263 l.) | — | ❌ aucun test dédié (page = Server Component, souvent testé en e2e plutôt qu'unit — vérifier si `e2e/outreach-master-agent.spec.ts` couvre un chemin UI réel) |
| `actions.ts` (1031 l., **13 Server Actions**) | `__tests__/run-sourcing.test.ts` (couvre `runSourcing`), `__tests__/send-direct-email.test.ts` (couvre `sendDirectEmail`) | ❌ **11 des 13 actions exportées n'ont pas de test dédié identifié** : `addProspect`, `importProspects`, `createCampaign`, `approveEmail`, `updateEmail`, `sendCampaign`, `draftAllCampaignEmails`, `draftDirectEmail`, `draftEmailForProspect`, `createIcp`, `overrideTier`. `sendCampaign` en particulier est un chemin d'envoi réel (cf. `EMAIL_CONTEXT.md`) — priorité haute pour la zone qui en hérite. |
| `compose/page.tsx`, `[campaignId]/page.tsx`, `prospects/[id]/page.tsx` | — | ❌ aucun test dédié trouvé |
| `error.tsx`, `loading.tsx` (×3) | — | — (états UI standards, risque faible, pas de logique métier) |

## Composants admin (`src/components/admin/outreach/`, 12 fichiers)

| Source | Test(s) | Statut |
|---|---|---|
| `direct-send-form.tsx` | `__tests__/direct-send-form.test.tsx` | ✅ |
| `bento-form.ts`, `campaign-form.tsx`, `draft-campaign-button.tsx`, `email-review-card.tsx`, `icp-form.tsx`, `icp-list.tsx`, `prospect-add-form.tsx`, `prospect-import-form.tsx`, `send-campaign-button.tsx`, `source-more-button.tsx`, `tier-badge.tsx` (11 fichiers, ~1115 l. cumulées) | — | ❌ **aucun test dédié** trouvé pour ces 11 composants |

## API routes

| Source | Test(s) | Statut |
|---|---|---|
| `api/outreach/inbound/route.ts` | — | ❌ aucun test de route dédié trouvé (la logique de classification est testée via `outreach-reply-handler.test.ts`, mais pas le handler HTTP lui-même : parsing payload, matching prospect par from-address) |
| `api/outreach/unsubscribe/route.ts` | — | 🟡 la logique token/suppression est testée via `lib/outreach/unsubscribe.test.ts`, mais pas le handler `route.ts` (validation query param, réponse HTTP) |
| `api/admin/diagnostics/outreach/route.ts` | `lib/admin/diagnostics/__tests__/outreach-diagnostics.test.ts` (40 l.) couvre la logique sous-jacente | 🟡 |

## Diagnostics / KPI

| Source | Test(s) | Statut |
|---|---|---|
| `admin/diagnostics/outreach-diagnostics.ts` | `__tests__/outreach-diagnostics.test.ts` (40 l. pour 233 l. source) | 🟡 — ratio faible, à vérifier |
| `admin/diagnostics/outreach-lifecycle.ts` | `__tests__/outreach-lifecycle.test.ts` (70 l. pour 222 l. source) | 🟡 |
| `outreach-lifecycle-demo.tsx` | — | ❌ (composant démo, risque faible) |
| `admin/outreach-kpi-strip.ts` | — | ❌ aucun test dédié (54 l., agrégats affichés en admin — vérifier absence de valeur en dur) |

## Intégration chat / canvas / agentique

| Source | Test(s) | Statut |
|---|---|---|
| `llm/tools/registry.ts` (outils `outreach_*`) | `llm/tools/__tests__/outreach-tools.test.ts` (85 l.) | ✅ |
| `canvas/outreach-turn.ts` | `canvas/__tests__/outreach-turn.test.ts` (157 l.) | ✅ |
| `canvas/outreach-action-cards.ts` | `canvas/__tests__/outreach-action-cards.test.ts` (288 l.) | ✅ |
| `agentic/outreach-integration.ts` | `agentic/__tests__/outreach-integration.test.ts` (382 l.) | ✅ |
| Route cockpit-chat (chemin outreach) | `api/cockpit-chat/__tests__/route.outreach.test.ts` (286 l.) | ✅ |
| E2E master agent | `e2e/outreach-master-agent.spec.ts` (382 l.) | ✅ (à confirmer verte — Playwright, pas exécuté ce batch) |

## Synthèse des trous prioritaires (pour répartition batches 2-6)

1. **`actions.ts`** — 11/13 Server Actions sans test dédié, dont `sendCampaign` (envoi réel).
2. **11 des 12 composants** `components/admin/outreach/*` sans test dédié.
3. **`outreach-master-agent.ts`** (orchestrateur) et **`outreach-master-semantic.ts`** sans test direct.
4. **`suppression.ts`** (chemin critique désinscription/CAN-SPAM) sans test dédié.
5. Routes API `inbound` et `unsubscribe` — logique métier testée, handler HTTP non testé.
6. Pages admin (`page.tsx`, `compose`, `[campaignId]`, `prospects/[id]`) sans test dédié.
