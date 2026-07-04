# BATCHES.md — Outreach Audit Series (6 batches)

> Exécution **séquentielle et manuelle** (Adrien lance chaque loop). Les 5 zones
> ci-dessous sont **disjointes en fichiers** (aucun chevauchement) pour que chaque
> batch reste sûr même si l'ordre réel diffère de la numérotation, et pour permettre
> un futur dispatch parallèle sans conflit de lock — sans que ce soit l'hypothèse par
> défaut de cette série (`executionMode: sequential-manual`).

| Batch | Rôle | Zone | Statut |
|---|---|---|---|
| 1 | Architecte — plan d'audit (ce batch) | `docs/projects/outreach-audit/` uniquement | ✅ FAIT (2026-07-04) |
| 2 | Baseline + Gouvernance/Policy | Zone 1 | ⏳ En attente |
| 3 | Agents + Master-Agent (orchestration chat) | Zone 2 | ⏳ En attente |
| 4 | Jobs Inngest + Couche données | Zone 3 | ⏳ En attente |
| 5 | UI Admin — Server Actions + pages + composants | Zone 4 | ⏳ En attente |
| 6 | API routes + intégration chat/canvas + diagnostics | Zone 5 | ⏳ En attente |

Avant de coder, chaque batch **doit** :
- lire `docs/agent-file-locks.md`, réserver sa zone, vérifier qu'aucun autre agent actif
  ne détient déjà un des chemins listés ;
- confirmer `origin/main` propre / à jour (worktree isolé si les règles §1 du workflow
  multi-agent l'exigent) ;
- lire `TEST_COVERAGE_MATRIX.md` pour la liste précise des trous de sa zone et
  `ANTI_HARDCODING_CHECKLIST.md` pour les points à vérifier.

---

## Zone 1 (Batch 2) — Baseline + Gouvernance/Policy

**Pourquoi en premier** : sans baseline vérifiée, impossible de distinguer une
régression pré-existante d'un finding de cette série. Combinée avec la zone
policy/gouvernance (`src/lib/outreach/`) car c'est la plus petite en surface et la
plus critique niveau garde-fous (rejet/tier/suppression).

**Owner zone (fichiers)** :
- `src/lib/outreach/tier.ts`, `suppression.ts`, `events.ts`, `status-variants.ts`
  (+ leurs tests à créer/compléter)
- Vérification (pas forcément modification) de : `send-policy.ts`, `autonomy-status.ts`,
  `mailbox-readiness.ts`, `icp.ts`, `unsubscribe.ts`, `cta-url.ts`, `lifecycle.ts`
  (déjà testés — confirmer verts, ne pas dupliquer leur test)

**Tâches** :
1. `pnpm install` (si `node_modules` absent) → `pnpm db:generate` → `pnpm typecheck`.
2. `pnpm test -- src/lib/outreach` — noter le compte pass/fail réel dans
   `PROJECT_STATE.md` (à créer par ce batch, même format que
   `docs/projects/hearst-defi/PROJECT_STATE.md`).
3. Combler les trous de `TEST_COVERAGE_MATRIX.md` §Gouvernance : `suppression.ts`
   (❌, chemin critique désinscription), `tier.ts` (🟡, pas de test dédié),
   `events.ts`/`status-variants.ts` (❌, risque faible — au moins un smoke test).
4. Checklist anti-hardcoding sur cette zone (seuils tier, quotas, suppression).

**Validations** : `pnpm typecheck && pnpm test -- src/lib/outreach`
**Dépend de** : batch 1 (ce plan)
**STOP** : ne pas toucher `prisma/schema.prisma`, ne pas monter `OUTREACH_AUTONOMY`.

---

## Zone 2 (Batch 3) — Agents LLM + Master-Agent (orchestration chat)

**Owner zone (fichiers)** :
- `src/lib/agents/outreach-scorer.ts`, `outreach-writer.ts`, `outreach-writer-extended.ts`,
  `outreach-reply-handler.ts`
- `src/lib/agents/outreach-master-agent.ts`, `outreach-master-regex.ts`,
  `outreach-master-semantic.ts`, `outreach-master-safety.ts`, `outreach-master-types.ts`
- `src/lib/agents/swarms/outreach-swarm-orchestrator.ts`, `outreach-swarm-types.ts`

**Trous prioritaires (voir `TEST_COVERAGE_MATRIX.md`)** :
- `outreach-master-agent.ts` — aucun test direct de l'orchestration regex→semantic→unknown.
- `outreach-master-semantic.ts` — aucun test dédié du fallback HuggingFace.

**Checklist spécifique** :
- Confirmer que `sendAllowed` reste toujours `false` et `requiresUserReview` toujours
  `true` en sortie de `outreach-master-agent.ts`, y compris sur les chemins non
  couverts aujourd'hui (unknown intent, fallback semantic).
- Confirmer `assertNoForbiddenWords` (ou équivalent) appliqué à la sortie de
  `outreach-writer.ts` / `outreach-writer-extended.ts` / `outreach-reply-handler.ts`.

**Validations** : `pnpm test -- src/lib/agents/__tests__/outreach- src/lib/agents/swarms`
**Dépend de** : batch 2 (baseline verte)
**STOP** : ne pas changer `OPENAI_API_KEY`/modèle (ADR-011, GPT-4.1 unique).

---

## Zone 3 (Batch 4) — Jobs Inngest + Couche données

**Owner zone (fichiers)** :
- `src/lib/inngest/functions/outreach-send.ts`, `outreach-auto-send.ts`, `outreach-followups.ts`
- `src/lib/data/outreach.ts`

**Trous prioritaires** :
- `src/lib/data/outreach.ts` (618 l., test existant = 171 l. seulement — vérifier que
  toutes les requêtes exportées sont exercées, pas seulement un sous-ensemble).
- Confirmer que `outreach-auto-send.ts` respecte le cap quotidien + la file
  Prime>Warm>Cold et saute toute ligne `OutreachSuppression`/`opted_out` **au moment
  de l'exécution du job**, pas seulement en test unitaire mocké.

**Validations** : `pnpm test -- src/lib/inngest/functions/__tests__/outreach- src/lib/data/__tests__/outreach.test.ts`
**Dépend de** : batch 2 (baseline verte)
**STOP** : ne jamais faire tourner ces jobs contre un vrai provider Resend/Apollo
pendant l'audit (mock uniquement).

---

## Zone 4 (Batch 5) — UI Admin : Server Actions + pages + composants

**Owner zone (fichiers)** :
- `src/app/admin/outreach/actions.ts`, `page.tsx`, `compose/page.tsx`,
  `[campaignId]/page.tsx`, `prospects/[id]/page.tsx`, `error.tsx`, `loading.tsx` (×3)
- `src/components/admin/outreach/*` (12 fichiers)

**C'est la zone avec le plus gros trou de couverture** (voir
`TEST_COVERAGE_MATRIX.md` §Synthèse) : 11 des 13 Server Actions et 11 des 12
composants n'ont aucun test dédié identifié.

**Priorité dans la zone** (ordre suggéré, du plus risqué au moins risqué) :
1. `sendCampaign` — chemin d'envoi réel, priorité absolue.
2. `createCampaign`, `approveEmail`, `updateEmail`, `draftAllCampaignEmails`,
   `draftDirectEmail`, `draftEmailForProspect` — chemin de rédaction/approbation.
3. `createIcp`, `overrideTier` — gouvernance tier (croise Zone 1, ne pas dupliquer
   les tests `tier.ts` — tester seulement le branchement Server Action → policy).
4. `addProspect`, `importProspects` — ingestion manuelle.
5. Les 11 composants sans test (au minimum : rendu + interaction de base).

**Validations** : `pnpm test -- src/app/admin/outreach src/components/admin/outreach`
**Dépend de** : batch 2 (baseline) — peut tourner en parallèle logique des zones 2/3
si un jour cette série passe en dispatch parallèle (pas le cas aujourd'hui).
**STOP** : `sendCampaign`/`sendDirectEmail` restent testés en mock — jamais d'appel
Resend réel pendant l'audit (`EMAIL_CONTEXT.md`).

---

## Zone 5 (Batch 6) — API routes + intégration chat/canvas + diagnostics

**Owner zone (fichiers)** :
- `src/app/api/outreach/inbound/route.ts`, `unsubscribe/route.ts`
- `src/app/api/admin/diagnostics/outreach/route.ts`
- `src/lib/canvas/outreach-turn.ts`, `outreach-action-cards.ts`
- `src/lib/agentic/outreach-integration.ts`
- `src/lib/admin/diagnostics/outreach-diagnostics.ts`, `outreach-lifecycle.ts`
- `src/components/admin/diagnostics/outreach-lifecycle-demo.tsx`
- `src/lib/admin/outreach-kpi-strip.ts`
- `e2e/outreach-master-agent.spec.ts` (confirmer vert, Playwright)
- **Section `outreach_*` de `src/lib/llm/tools/registry.ts` uniquement** — voir garde
  ci-dessous.

**⚠️ Fichier sensible single-owner (`CLAUDE.md`)** : `src/lib/llm/tools/registry.ts`
est listé "sensitive single-owner". Ce batch ne doit **ni éditer ni committer** ce
fichier sans réservation explicite dans `docs/agent-file-locks.md` et sans
arbitration si un autre agent le détient. Si l'audit ne fait que *lire* la section
`outreach_*` pour vérifier la conformité ADR-012/017 (pas d'édition), aucun lock
n'est nécessaire — mais toute correction doit passer par la procédure de lock.

**Trous prioritaires** :
- `inbound/route.ts` : parsing payload + matching prospect par from-address non
  testés au niveau handler HTTP (la classification elle-même est testée via
  `outreach-reply-handler.test.ts`, zone 2).
- `unsubscribe/route.ts` : handler HTTP (validation query, réponse) non testé
  directement (la logique token/suppression l'est via `lib/outreach/unsubscribe.test.ts`,
  zone 1).
- `outreach-kpi-strip.ts` (54 l.) : aucun test — vérifier absence de valeur en dur
  dans les agrégats affichés.

**Validations** :
`pnpm test -- src/app/api/outreach src/app/api/admin/diagnostics/outreach src/lib/canvas/__tests__/outreach- src/lib/agentic/__tests__/outreach-`
+ `pnpm test:e2e -- outreach-master-agent` si l'environnement Playwright est disponible.
**Dépend de** : batch 2 (baseline), batch 3 (regex/safety déjà vérifiés avant de
toucher la section registry).
**STOP** : jamais de dispatch de la loop suivante, jamais de merge — cette série reste
`sequential-manual`.
