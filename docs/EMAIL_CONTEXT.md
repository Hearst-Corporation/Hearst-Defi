# EMAIL_CONTEXT — outreach / emailing sans envoi accidentel

Charger ce fichier + `src/app/admin/outreach/actions.ts` + `src/lib/email/send.ts` + le template ciblé.

## Où est quoi
- **Pages outreach** : `src/app/admin/outreach/` — `page.tsx`, `compose/`, `[campaignId]/`,
  `actions.ts` (828 l. : draft / send / campaign).
- **Service email** : `src/lib/email/send.ts` (envoi Resend), `src/lib/email/resend-signature.ts`
  (vérif signature webhook). Webhook entrant : `src/app/api/resend/webhook/route.ts`.
- **Événements outreach** : `src/lib/outreach/events.ts`.
- **Rédaction assistée** : `src/lib/agents/outreach-writer.ts` (génère du texte, n'envoie rien).

## Règle d'or — pas d'envoi réel
- **Pendant un audit ou toute tâche non explicitement "envoyer" : rester en preview / draft.**
  L'envoi via Resend est une action externe (publie du contenu) → **confirmation explicite obligatoire**.
- Flux : compose → draft → preview → (validation humaine) → send. Ne jamais court-circuiter vers send.
- Pas de campagne réelle, pas de send en masse sans accord.

## Règles
- Secrets via `process.env` (`RESEND_API_KEY`) — jamais en dur.
- Conserver la vérification de signature des webhooks Resend.
- Templates : centraliser/réutiliser (helpers) plutôt que dupliquer — canonisation = P1.

## Validation
`pnpm test src/lib/email` (+ tests outreach si présents). Pas de build complet.

## STOP
Tout déclenchement d'envoi, toute campagne réelle, toute rotation de clé Resend → s'arrêter et demander.
