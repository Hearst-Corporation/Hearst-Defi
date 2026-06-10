# BACKLOG — Hearst Connect (post-QA 2026-06)

Brief de reprise. Plateforme DeFi single-vault (Next.js 16 / TS strict / Prisma / Tailwind v4).
Lire `CLAUDE.md` (non-négociables : APY en range, badges de provenance, format PTAI, agents = JSON
structuré only, mots interdits, engine pur, pas d'import cross-projet). Le rapport QA complet (40 défauts,
24 surclaims) a déjà été traité en partie.

## ✅ Déjà fait — sur `origin/main`, NE PAS refaire
- **11 P1** : vol_index 0-100 · forbidden-words (crash memo) · distribution atomic-exec + emails Inngest ·
  governance routing (`routeForTransaction`) · nav Governance · onboarding (gate `/onboarding`, trim
  `StepProgressBar` 4 étapes, suppression Tree A orphelin + migration actions → `src/lib/onboarding`) ·
  gate `/debug`. **#9 notif matrix délibérément différé.**
- **6 P2** : docusign webhook 503 · `AUTH_TOTP_KEY` validé au boot · allowlist case-insensitive ·
  PoR badge `verified` câblé · admin vault detail résout par id OU ticker · TOTP same-step replay guard.
- `docs/roadmap.json` requalifié vs réalité (90 validated / 17 in_progress / 8 todo, 0 placeholder).
- action-queue : 4 producteurs câblés (`multisig.sign`, `vault.paused`, `distribution.approve`, `kyc.review`) = 8/10 types.

## ⚠️ Impédiment bloquant à régler EN PREMIER pour tout schéma
**dev.db driftée vs schema** : la dev.db manque des contraintes uniques (`Distribution[period,vaultRef]`,
`InvestorTransaction[txHash]`, `Position[txHashOpen]`) + index (`UserAgentProfile`, `VaultDraft`).
→ `prisma db push` est bloqué (réclame `--accept-data-loss`), `prisma migrate dev` veut **RESET** (perte
de données — INTERDIT). Le projet maintient dev.db en `db push` (cf. CLAUDE.md), les `prisma/migrations`
sont stale. **Avant tout changement de schéma** : vérifier l'absence de doublons violant ces contraintes,
puis réaligner dev.db (`db push --accept-data-loss` OU `CREATE INDEX` chirurgicaux additifs), et décider
d'un baseline de migration propre pour la prod.
(Note prod en attente : `ALTER TABLE "User" ADD COLUMN "totpLastUsedStep" INTEGER;` pour le TOTP replay.)

## Lot 1 — Fixes code sûrs (pas de schéma, pas de collision) — à faire tout de suite
1. **Search href cassé** : `src/lib/search/indexer.ts:283` → `/admin/governance/${r.proposalId}` doit être
   `/admin/governance/proposal/${r.proposalId}` (route réelle = `/admin/governance/proposal/[id]`). Sinon clic = 404.
2. **NavSparkline label trompeur** : le fan-chart p5/p50/p95 dérive de l'APY range, PAS de Monte Carlo —
   reformuler le label/sous-titre pour ne plus impliquer "Monte Carlo".
3. **command registry** `src/lib/power/commands.ts:111` (`nav-governance`) : vérifier href = `/admin/governance`
   (valeur faible — palette UI non câblé, cf. Lot 5).

## Lot 2 — À schéma (après réalignement dev.db)
4. **EIP-712 signing** (`multisig-safe-eip712`) : `src/lib/governance/eip712.ts` (safeTxTypedData/hashSafeTx/
   SafeTxSchema) = 0 appelant ; `signProposal` enregistre une décision sans bytes de signature ; `ProposalSignature`
   n'a pas de colonne `signature`. Câblage CORRECT = signature typée côté WALLET du signataire (Privy) + vérif
   serveur + stockage → vraie feature UI+wallet, fait partie de l'épic on-chain (Lot 3).
5. **vaultRef → FK relationnelle** (`distributions-vault-fk`) : `vaultRef` = slug String dénormalisé ; convertir
   en FK vers `VaultDeployment` (schéma + migration de données). Le back-link 404 a déjà été corrigé (id OU ticker).

## Lot 3 — Épic gouvernance on-chain (interdépendant, nécessite décision de scope)
6. **Tenderly sim** (`multisig-tenderly-sim`) : SimulationPanel/simulateProposal seulement sur
   `/admin/governance/simulate-demo` (mocks) ; l'exécution réelle n'est pas gatée sur une sim → intégration
   Tenderly API + gate execute.
7. **TimelockController on-chain** + EIP-712 (Lot 2 #4) + **"verify on-chain link"** sur
   `src/components/governance/timelock-countdown.tsx` (aucun lien explorer — il n'y a actuellement PAS
   d'opération on-chain à lier).

## Lot 4 — Décisions produit / méthodo (NE PAS inventer — demander Adrien d'abord)
8. **engine-backtest rules-vs-no-rules** (`engine-backtest`) : `hearstRulesMode` hardcodé `true` dans les 3 SPECS
   et JAMAIS consommé (`src/lib/engine/backtest.ts`) ; `/api/backtest/run` accepte `compareRules` mais l'ignore.
   **Nécessite de DÉFINIR la baseline "sans règles"** (touche Methodology v1.0 immuable) → produire les deux
   résultats + comparaison + câbler `compareRules` + l'UI.
9. **Share Class B atteignable** (`share-class-b`) : modélisée/seedée mais `invest-form` hardcode classe 'A' ;
   ajouter un sélecteur de share-class au flux invest. (Zone vaults — coordonner avec la session active.)
10. **advanced-metrics LP** (`advanced-metrics`) : Sharpe/Sortino/VaR seulement sur le dashboard admin ;
    construire un `RiskMetricsPanel` côté LP (le composant référencé n'existe pas). (Zone portfolio/LP.)
11. **confirmed page hardcode** : `src/app/(product)/vaults/[id]/invest/confirmed/page.tsx` hardcode
    "Hearst Yield Vault"/60j/8-15% quel que soit le vault → lire depuis le vault. (Zone vaults — collision.)
12. **action-queue restants** : `lp.redemption` (aucun modèle Redemption) + `memo.publish` (aucun champ
    publish-state) → créer les modèles puis câbler les 2 derniers types dans `src/lib/data/cockpit.ts`.

## Lot 5 — Intentional-unwired (décision Adrien 2026-06-10 : "plus tard" — NE PAS câbler sans feu vert)
13. command palette ⌘K UI (`command-palette-cmdk`) — registre `src/lib/power/commands.ts` existe, pas de composant UI.
14. batch actions multi-select (`batch-actions-multi-select`) — shell seulement ; manque undo/toast/10s/x-select + montage.
15. keyboard shortcuts (`keyboard-shortcuts-cheatsheet`) — registre statique ; pas de dispatcher clavier global ; overlay non monté.
16. global search ⌘/ (`global-search-cmd-slash`) — GlobalSearch + /api/search existent mais non montés.
17. notifications bell feed (`notifications-bell-feed`) — bell non monté + backend 0 consommateur.
18. saved views 8 templates (`saved-views-8-templates`) — templates+actions existent, SavedViewsPicker non monté.

## Lot 6 — #9 Notification matrix (différé Adrien — gros, lié au bell feed)
19. `src/lib/notifications/router.ts` (NOTIFICATION_MATRIX/resolveChannels/renderTemplate) = 0 consommateur,
    aucun `Notification.create`. Câbler des fonctions Inngest par event gouvernance → email (Resend, pattern dans
    `src/lib/auth/password-reset.ts`) + in_app (`Notification.create`) + telegram (sender À CONSTRUIRE).

## Lot 7 — Divers / dette
20. DocuSign réutilise UN Subscription Agreement hardcodé pour ~10 types de docs ; pas de Side Letter (onboarding docusign).
21. `/signup` (S1 onboarding) n'existe pas (le funnel démarre à accreditation, post-auth).
22. `lp-s9-institutional-confirmation` : spec-complète mais sous `/vaults/[id]/invest/confirmed`, inatteignable
    tant qu'aucun vault "live" (non-placeholder) n'existe.
23. forbidden-words `NEGATION_WORDS` ignore `cannot`/`nothing` → "We cannot guarantee" flaggé à tort (pré-existant).
24. Breadcrumb sticky vault retiré (commit `e9d6d46`, intentionnel) → ré-ajouter si voulu.

## Règles d'exécution
- Travailler sur `main`. Stage en paths explicites (jamais `git add -A`). ⚠️ Une session UI concurrente édite
  en parallèle (profile, vaults/confirmed, portfolio, dashboard) — ne JAMAIS committer ses fichiers.
- Aucun `git commit/push` sans accord explicite. Tests : `pnpm typecheck && pnpm lint && pnpm vitest run`.
  (Note : 2 erreurs résiduelles dans `.next/types` généré = cache stale des routes onboarding supprimées, se
  vide au prochain `next build` — zéro erreur source.)
- Lots 4/5/6 = NE PAS exécuter sans décision d'Adrien (méthodo / lever ses différés).

**Priorité** : Lot 1 (3 fixes sûrs) → réaligner dev.db → puis Adrien tranche sur Lots 4/5/6.
