# Plan — Hearst Outreach Engine (chaîne agentique de lead-gen B2B)

## Objectif

Transformer le module Outreach (aujourd'hui : saisie manuelle → écrire → envoyer →
tracker) en **chaîne agentique autonome** qui : trouve des distributeurs B2B
qualifiés via Apollo → enrichit → score → classe en tier d'autonomie → rédige →
envoie (selon le tier) → relance → lit les réponses → qualifie → remonte le chaud.

**Cible persona V1 : Distributeurs** (RIA, family offices, wealth managers, IFA,
plateformes) — ceux qui *placent* le vault auprès de leurs clients (levier AUM max).
Pitch = économie de distribution, pas le rendement direct.

## Décisions actées (avec Adrien)

- **Source de découverte** : Apollo.io (`APOLLO_API_KEY` déjà dans `~/.claude/api-config/SERVICES.md`, réutilisée via `process.env`). Base ~275M contacts ; cible distributeurs adressable ~centaines de milliers.
- **Autonomie routée par qualification — 3 tiers** :
  - **Tier A "Prime" (score 85-100)** : agent source+enrichit+**rédige un BROUILLON**, puis S'ARRÊTE. Adrien réécrit/valide, Adrien envoie, Adrien suit. Brouillon prêt, envoi = humain.
  - **Tier B "Warm" (60-84)** : agent source+enrichit+rédige+**ENVOIE le 1er touch**. Relances + réponses remontent à Adrien. Semi-auto.
  - **Tier C "Cold" (40-59)** : **boucle fermée** — envoie, relance en cadence, lit, qualifie. Ne remonte que le chaud. Mains libres.
  - **Rejeté (<40)** : jeté (hors ICP / doublon / opt-out).
  - **Promotion auto** : tout lead qui répond positivement remonte d'un tier → revient vers la main d'Adrien.
  - **Override manuel** : Adrien peut forcer le tier de n'importe quel lead.
- **Facteur limitant = ENVOI, pas la base.** Resend cold propre ≈ 20-40/j (warm-up) → 200-500/j/domaine en régime établi. D'où : **quota d'envoi quotidien + warm-up automatique + file priorisée par tier** (Prime/Warm passent devant Cold).
- **On construit pour la boucle fermée (`CLOSED`), on roule supervisé jusqu'à validation.** Le tier route déjà l'autonomie ; un flag global `OUTREACH_AUTONOMY` (défaut `SUGGEST`) plafonne en plus le système entier pendant les tests (un cran qu'Adrien tourne, zéro réécriture).

## Contraintes du repo respectées

- **ADR-012** borne le *chat* (read-only, human-in-the-loop). **Ce moteur n'est PAS le chat** : c'est un système d'**agents batch** (comme les 4 agents structurés déjà autorisés) piloté par **Inngest** + **Server Actions admin** (`requireAdmin`). Le chat (système 2) garde seulement la navigation read-only vers `/admin/outreach`.
- **L'envoi automatique (Tier B/C) dépasse l'actuel human-in-the-loop** → **nouvel ADR-016** ("Autonomous outreach sending, tiered") rédigé au Palier 3, AVANT d'activer un envoi non supervisé. CLAUDE.md #4 mis à jour en conséquence.
- Réutilise tout l'existant : `outreach-writer.ts`, Resend (`email/send.ts`) + webhook, HubSpot (`hubspot/*`), Inngest, les 4 tables Prisma, garde-fous (`assertNoForbiddenWords`, APY range, `requireAdmin`).
- Nouveaux agents calqués sur le contrat existant : `callLlm(agentName, LlmParams, {client})` (client injectable pour tests), sortie JSON validée Zod, persistance `LlmRun`.
- Server-only partout où on touche Prisma/Apollo. Pas de `any`. Env validé Zod au boot.

---

## Architecture cible — 6 agents

```
1. SOURCER     ICP distributeur → Apollo search (titre/firme/AUM/géo) → candidats bruts
2. ENRICHER    candidat → Apollo enrich : email VÉRIFIÉ, LinkedIn, signaux (rejette non-vérifiés)
3. SCORER (LLM) prospect → {score 0-100, tier A/B/C/rejet, reasons[]} sur axes ICP + anti-doublon
4. WRITER (LLM) prospect → email perso (persona distributeur) — outreach-writer étendu
5. SENDER      email → envoi gouverné par tier + quota/jour + warm-up + lien désinscription
6. REPLY-HANDLER (LLM) réponse entrante → classe (intéressé/pas maintenant/non/OOO) →
                relance OU promotion tier OU qualified. (Boucle fermée Tier C.)
```

---

## Plan par paliers (chaque palier = livrable, testable, commit isolé)

### Palier 0 — Fondations (AUCUN appel externe, AUCUN crédit)
- `src/lib/apollo/client.ts` : wrapper typé (search + enrich), `process.env.APOLLO_API_KEY`, jamais en dur, erreurs explicites. Client injectable pour tests (mock fetch).
- `src/lib/env.ts` : ajoute `APOLLO_API_KEY` (optionnel, no hard-fail dev), `OUTREACH_AUTONOMY` (enum `SUGGEST|SEND|NURTURE|CLOSED`, défaut `SUGGEST`), `OUTREACH_DAILY_SEND_CAP` (défaut 30).
- Schéma Prisma :
  - `OutreachICP` (persona cible : titres[], firmTypes[], geos[], aumMin, keywords[], seuils tierA/tierB/tierC, langue, actif).
  - `OutreachSuppression` (email/domaine, raison: opt_out|bounce|manual|recent_contact, jusquÀ).
  - `OutreachProspect` : + `qualScore Int?`, `tier String?` (A|B|C), `apolloId String?`, `lastContactedAt`, `sequenceStep Int @default(0)`.
  - `OutreachEmail` : + `tierAtSend String?`, `autonomyAtSend String?` (audit).
- `prisma/schema.prisma` (dev SQLite) + migration. **Régénérer client sqlite après** (piège connu).
- **Test** : unit tests client Apollo (mock), validation env, `pnpm typecheck` + `pnpm test` verts. Aucun appel réseau.
- **Gate Adrien** : valide les modèles + seuils avant Palier 1. (1er appel Apollo réel = au Palier 1, je demande avant — conso crédits.)

### Palier 1 — Sourcer + Enricher + Scorer
- `src/lib/agents/outreach-sourcer.ts` (Apollo search depuis un ICP), `outreach-enricher.ts` (Apollo enrich), `outreach-scorer.ts` (LLM, sortie `{score,tier,reasons}` Zod).
- `src/lib/outreach/events.ts` : + `OUTREACH_EVENTS.SOURCE` (`outreach.source.run`).
- `src/lib/inngest/functions/outreach-source.ts` : job event-driven — search → enrich → score → dédoublonne (vs base + suppression) → crée `OutreachProspect` (statut `new`, source `apollo`, tier assigné). Registre dans `api/inngest/route.ts`.
- `src/app/admin/outreach/actions.ts` : `createIcp`, `runSourcing(icpId)` (émet l'event), `overrideTier(prospectId, tier)`.
- UI `/admin/outreach` : bloc "ICP distributeur" (form) + bouton "Sourcer des leads" + **badge tier (A/B/C)** sur chaque ligne du directory + action "Override tier".
- **Test** : tu définis un ICP, lances un sourcing, vois N prospects qualifiés/scorés/tiers/dédoublés apparaître. (Appel Apollo réel — je demande avant.)
- **Gate Adrien** : juge la qualité des leads + la pertinence des tiers.

### Palier 2 — Writer persona distributeur
- `outreach-writer.ts` : variante prompt "distributeur" (pitch = distribution/économie d'échelle, pas souscription) ; langue depuis l'ICP.
- Câblage : à la fin du sourcing, draft auto par tier (tous tiers reçoivent un draft ; seul l'envoi diffère ensuite).
- **Test** (`OUTREACH_AUTONOMY=SUGGEST`) : N leads → N brouillons distributeurs en review queue, taggés par tier. Tu juges la copie.
- **Gate Adrien** : valide le ton/persona avant tout envoi.

### Palier 3 — Envoi gouverné + désinscription + ADR-016
- `src/lib/outreach/send-policy.ts` : décide par tier × `OUTREACH_AUTONOMY` × quota du jour. Tier A = jamais d'envoi auto (draft + alerte "Prime à valider"). Tier B = 1er touch. Tier C = boucle.
- **Quota + warm-up** : `OUTREACH_DAILY_SEND_CAP` qui monte automatiquement (courbe warm-up), file priorisée Prime > Warm > Cold. Job ne dépasse jamais le cap du jour.
- **Désinscription (conformité P0)** : `email/send.ts` injecte un vrai lien `{{unsubscribe}}` ; route `GET /api/outreach/unsubscribe` (token signé) → passe le prospect `opted_out` + ajoute à `OutreachSuppression`. Le sender saute toute suppression.
- **ADR-016** "Autonomous outreach sending, tiered" + MAJ CLAUDE.md #4.
- **Test** : monte le flag à `SEND`, un batch Tier B part réellement, tracking + désinscription OK, cap respecté.
- **Gate Adrien** : valide avant d'activer la boucle.

### Palier 4 — Séquence + Reply-handler (la boucle se ferme)
- **Inbox entrante** (décision à trancher au Palier 4) : Resend inbound OU IMAP poller sur une boîte dédiée → `POST /api/outreach/inbound`. Sans ça, `NURTURE` (relances) marche, `CLOSED` (qualif sur réponse) non.
- `outreach-reply-handler.ts` (LLM) : classe la réponse → relance/stop/promotion tier/qualified.
- Cadence relance (J+3, J+7, stop) via Inngest scheduled + `sequenceStep`.
- Promotion auto de tier sur réponse positive (cœur du système).
- **Test** : monte à `NURTURE` puis `CLOSED` quand convaincu.
- **Gate Adrien** : validation finale de la boucle fermée.

### Transverse (à partir du Palier 3)
- **Multi-domaines d'envoi** (pour dépasser ~500/j) : flaggé, décision séparée (acheter `go-hearst.com` etc. + warm-up). Pas bloquant pour V1.

---

## Ce que je NE fais PAS (garde-fous)
- Pas d'envoi auto avant ADR-016 + ton GO explicite (on roule `SUGGEST`).
- Pas de write-tool email exposé au LLM du chat (ADR-012 intact).
- Pas de secret en dur (toujours `process.env`).
- Pas de `git push`/`reset`. Commit isolé par palier (staging ciblé).
- 1er appel Apollo réel : je te préviens avant (conso crédits).
- DB dev reste SQLite ; régénérer le client après chaque migrate.

## Démarrage
Palier 0 immédiatement après ton GO (aucun appel externe, aucun crédit consommé).
