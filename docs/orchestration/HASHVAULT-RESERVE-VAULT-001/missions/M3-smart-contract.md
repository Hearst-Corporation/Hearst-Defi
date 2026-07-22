# M3 — Smart-contract : deploy DynaVault Base Sepolia, vérif ABI/decimals, getters manquants

**Owner** : `sc-dev` · **Vague** : 1 · **Dépend de** : — · **Périmètre** : `contracts/*`,
`src/lib/chain/*`, `config/deployments.base-sepolia.json`

## Objectif
Faire passer l'app du mode `legacy` (ERC-4626) au mode `v2` (PermissionedDynaVault), en déployant
le contrat cible sur Base Sepolia et en vérifiant l'adapter contre le bytecode réel. **La couche
on-chain est déjà conforme Series 1 (0 borrow/LTV) — aucun retrait de dette requis ici.**

## Contexte
Voir `02-cartography.md §A`. Contrat écrit + testé (44/44) mais **jamais broadcast**.
`NEXT_PUBLIC_DYNAVAULT_ADDRESS` absente → mode `legacy`, DynaVault dormant. Mainnet reste gaté
Spearbit (ADR-006) — **M3 s'arrête au testnet**.

## Tâches (fichier:ligne)
1. **Déployer `PermissionedDynaVault`** sur Base Sepolia : exécuter
   `contracts/script/DeployDynaVault.s.sol --broadcast` (params conformes : 40/27/33, élec 16408,
   curtail 35968/72318, halving 21, durée 24). Remplir `config/deployments.base-sepolia.json`.
   Poser `NEXT_PUBLIC_DYNAVAULT_ADDRESS` → bascule `legacy`→`v2` (`vault-mode.ts:97`).
   **Bloquant #1** de tout le mode v2. Nécessite clé de déploiement + ETH testnet — **confirmer
   avec Adrien** (action on-chain).
2. **Vérifier `V2_SHARE_DECIMALS=6`** contre bytecode déployé (`dynavault.ts:114` @todo) — sinon
   NAV/share faux ×1e12 silencieux.
3. **Vérifier l'ABI complète** contre bytecode (`dynavault.ts:266` "NOT VERIFIED AGAINST DEPLOYED
   BYTECODE") + trancher encodage `swapAndReport` `bytes32[]` vs `bytes` (spec §9.5).
4. **Câbler les 10 setters+getters owner manquants** (spec §9.2) : `setCurtailmentThresholds`,
   `setHalvingMonth`, `setTakeProfitTier` + leurs getters — l'adapter exécute mais ne peut ni lire
   ni écrire ces paramètres. Nécessaire pour que M7 (Proof Center) et le front pilotent
   curtailment/take-profit.
5. **Getter de solde par pocket** : `strategies()` n'expose que l'allocation *cible*, pas le solde
   LBTC par poche (`smart-contract-v2-status.md:35`). Pour un produit "Reserve" affichant les
   holdings BTC réels, ajouter un getter de solde par adapter (contrat + adapter).
6. **Adapters** (Q5) : `USDCMiningAdapter`/`LBTCPouchAdapter` = stubs USDC. Series 1 v1 = **rester
   stub testnet** ; vrai LBTC/cbBTC + oracle + router = chantier mainnet gaté Spearbit, hors M3.

## Invariants
- **Testnet uniquement.** Aucun mainnet (gate ADR-006). Le contrat porte "TESTNET ONLY"
  (`PermissionedDynaVault.sol:21`).
- Foundry + OpenZeppelin, phased rollout (scope `sc-dev`).
- Toute tx on-chain (deploy inclus) = **confirmer avec Adrien** avant broadcast.
- Ne pas introduire de borrow/LTV/liquidation (Series 1 = sans levier).

## Gate
`forge build && forge test` (44/44 maintenus) + `pnpm typecheck` (adapter TS). Après deploy :
un read réel sur testnet (ex `readVaultCore`) prouvant le mode `v2` actif — pas seulement un
typecheck.

## Définition de fini
DynaVault déployé Base Sepolia + adresse dans config + `NEXT_PUBLIC_DYNAVAULT_ADDRESS` posée ;
decimals + ABI vérifiés contre bytecode ; setters/getters curtailment/take-profit/halving câblés ;
getter solde par pocket ; mode `v2` prouvé par un read testnet.
