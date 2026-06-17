# validation-before-live/

Dossier de **validation pré-go-live** de Hearst Connect. Source de vérité pour un agent
(ou humain) qui re-vérifie que la plateforme marche avant un déploiement.

## Contenu

| Fichier | Quoi |
|---|---|
| [VALIDATION_BEFORE_LIVE.md](VALIDATION_BEFORE_LIVE.md) | **Le doc principal** : tout ce qui a été testé et prouvé (KYC Sumsub custom UI, onboarding, admin deploy, dépôt on-chain réel, cockpit), les flows exacts, les commandes de repro, les transactions Basescan, les garde-fous prod, et le TODO go-live. |
| [scripts/kyc-webhook.py](scripts/kyc-webhook.py) | Script de repro du webhook **Sumsub** signé HMAC (`x-payload-digest`, `HMAC_SHA256_HEX`) vers `/api/sumsub/webhook`. Prouve KYC pending→approved. ⚠️ L'ancien script Persona est remplacé par ce fichier. |
| VAULT_WIRING_AUDIT.md | (ajouté après l'audit de câblage vault) — où chaque donnée vault est affichée/calculée, admin + client + engine + on-chain. |

## Comment l'utiliser

1. Lis `VALIDATION_BEFORE_LIVE.md` en entier — il a une checklist §9 pour re-vérifier vite.
2. Si un check échoue, le doc dit l'état attendu et comment reproduire → distingue une
   vraie régression d'un état local non réinitialisé.
3. Avant un vrai go-live, suis le **TODO §8** (notamment : remettre `minDeposit` on-chain à 250k).

## Périmètre

Validé en **dev local** (`pnpm dev`, SQLite) + **Base Sepolia testnet** pour l'on-chain.
Mainnet reste gated sur l'audit Spearbit (ADR-006).
