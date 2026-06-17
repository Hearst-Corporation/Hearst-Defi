# PROOF_COMPLIANCE_CONTEXT — provenance, attestation, chain reads, output compliance

Charger ce fichier + les points d'entrée. Ne pas charger CSS / data portfolio / composants de présentation.

## Provenance — vocabulaire (source unique)

Chaque métrique porte **exactement une** provenance (Non-négociable #2). Union de 8 kinds,
définie dans `src/components/ui/provenance-badge.tsx` (`type Provenance`) :

| Kind | Sens |
|---|---|
| `live` | intégration directe temps-réel |
| `oracle` | vérifié par oracle décentralisé |
| `attested` | attestation tierce signée (voir fail-closed) |
| `estimated` | projection sur historique |
| `partial` | données incomplètes / dégradées (≈ pending) |
| `manual` | saisie humaine |
| `stale` | périmé (au-delà du seuil de fraîcheur) |
| `simulated` | démo / fallback, jamais de la prod réelle |

- **Une seule définition du type.** Ne pas redéclarer l'union ailleurs ni inventer un 9ᵉ kind.
- Le primitive `ProvenanceBadge` est le seul rendu autorisé — pas de badge `Live`/`Verified` fabriqué à la main.

## Honnêteté fail-closed (attestation)

- `"attested"` n'est légitime que si **frais (<24h) ET signataire allowlisté** (`isAttestorAllowlisted`,
  voir `src/lib/attestation/stored.ts` + `src/lib/env.ts`).
- **Un badge de panneau prend la ligne la PLUS FAIBLE** (weakest-row) — jamais la plus forte. Une seule
  ligne `stale`/`manual` dégrade tout le panneau.
- En prod, **allowlist manquante = fail-closed** (`no_allowlist_configured`), jamais fail-open. Pas de
  signataire allowlisté ⇒ on n'affiche pas `attested`, on rétrograde.

## Lectures on-chain (TESTNET)

- `src/lib/chain/*` (`client.ts`, `event-logger.ts`, `por-registry.ts`, `deployments.ts`, `abis.ts`,
  `publisher.ts`) lit **Base Sepolia TESTNET uniquement**.
- **Ne JAMAIS relabeliser le testnet en mainnet** — mainnet reste gaté sur audit Spearbit (ADR-006 / #8).
- `config/deployments.base-sepolia.json` = **données** (adresses on-chain réelles). Ne pas éditer à la main
  sans raison ; régénéré par le flux de déploiement.

## Isolation démo

- `src/lib/demo/guard.ts` — `canRunDemoProvider(nodeEnv, enableFlag)` : NODE_ENV absent → fail-closed
  (prod supposée) ; `production` → OFF même flag posé ; sinon opt-in explicite `DEMO_PROVIDER_ENABLED=1`.
- La démo est **toujours simulée** : hashes **SENTINEL** (`src/lib/demo/markers.ts`), **aucun lien explorer**,
  provenance `simulated`.
- `canRunDemoProvider()` doit **rester fail-closed**. La démo ne doit JAMAIS atteindre la data de prod.

## Mots interdits (5 + variantes)

- `src/lib/agents/forbidden-words.ts` = **matcher UNIQUE** (pas de fork). Liste EN canonique :
  guarantee / promise / certain / will deliver / risk-free (+ `no risk`).
- **Négation FR subtile** : `"non garanti"` / `"sans garantie"` sont **EXEMPTÉS** (fenêtre de négation
  AVANT), `"garanti"` nu est **attrapé**. Les needles qui commencent par une négation (`sans risque`)
  ne sont jamais exemptés sauf double-négation (`n'est pas sans risque`).
- Deux matchers, **un seul moteur** (`scanForbidden`) : `containsForbidden` (EN, fenêtre bidirectionnelle)
  et `containsForbiddenChat` (FR∪EN, fenêtre AVANT seule).
- Consommé par : les 4 agents, disclaimers vault, `AgentMemory`, et l'output guard. Toute ré-implémentation
  divergente est interdite.

## Output guard (streaming chat)

- `src/lib/llm/output-guard.ts` — `guardChatStream()` retient une fenêtre **SETTLE = 64** chars avant
  émission, pour scanner à cheval sur les chunks.
- **Ne pas réduire SETTLE** : il doit dépasser le plus long needle ET gérer les paires de surrogates UTF-16
  (ne jamais couper une demi-paire).

## Duplication connue (à signaler — P2)

- Le calcul `latestAttestationVerified` est **DUPLIQUÉ** dans :
  - `src/app/(product)/proof-center/page.tsx` (investor)
  - `src/app/admin/proof-center/page.tsx` (admin)
- Toute modif **doit toucher les DEUX**. Candidat à un helper partagé (P2) — ne pas diverger.

## Pages légales

- `src/app/legal/*` (`disclaimer`, `privacy`, `terms`) = **draft de revue en cours**, en attente de validation
  par le conseil juridique. Ne pas traiter comme texte juridique final.

## Validation

`pnpm test` sur le périmètre proof / chain / attestation :
- `src/lib/agents/__tests__/forbidden-words.test.ts`
- `src/lib/llm/__tests__/output-guard.test.ts`
- tests por-summary-truth / proof-card-onchain-provenance (proof + chain attestation).

## STOP

Ne pas relabeliser testnet→mainnet. Ne pas ouvrir l'allowlist d'attestation ni rendre la démo/allowlist
fail-open. Ne pas forker le matcher de mots interdits ni réduire la fenêtre SETTLE. Pas d'appel API Anthropic.
