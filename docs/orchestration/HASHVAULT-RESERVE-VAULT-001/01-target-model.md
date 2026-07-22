# 01 — Modèle cible : Hearst Bitcoin Reserve Vault — Series 1

Dérivé de **ADR-019** + **methodology v3.0** + **VAULT_SPEC_V2.1**, resserré au périmètre
Series 1 (sans borrow/LTV/liquidation). C'est l'état-cible que les 9 missions font converger.

---

## 1. Nature

Instrument d'**accumulation de Bitcoin** adossé au minage réel, sur `PermissionedDynaVault v2.1`
(Base Sepolia testnet ; mainnet gaté audit Spearbit — ADR-006). Asset = **USDC** (6 décimales).
Ce **n'est pas** un ERC-4626 (signatures `Deposit`/`Redeem` divergent). **Series 1 ne comporte
aucun emprunt, aucun LTV, aucune liquidation, aucun effet de levier.**

## 2. Structure — 3 pockets fixes

| Pocket | Nom | Allocation | bps on-chain |
|---|---|---|---|
| **B1** | Mining Power | 40 % | 4000 |
| **B2** | BTC Pouch | 27 % | 2700 |
| **B3** | Reserve USDC | 33 % | 3300 |

Allocation **fixe on-chain**. Les outcomes sont façonnés par **3 mécanismes** (pas par
réallocation de sleeve) : take-profit (B2), vending curve (B3), curtailment (B1).

## 3. Rendement & livraison

- **Accumulation de BTC sur 24 mois, livraison à maturité.**
- **Aucune distribution cash périodique. Aucun APY fixe.**
- Rendement estimé = **toujours une RANGE**, exprimée en **BTC accumulé** (jamais un point
  unique, jamais un %-APY promis). Provenance `Estimated`, méthodologie liée, disclaimer
  "not guaranteed" verbatim (v3.0 §10).

## 4. KPI investisseur cibles (Series 1)

Remplacent les KPI yield/APY partout sur les surfaces Series 1 :

- **BTC delivered / BTC delivered (target)** — le BTC accumulé livrable à maturité (range).
- **All-in BTC acquisition cost** — coût moyen tout compris d'acquisition du BTC (USDC investi ÷
  BTC accumulé), le KPI signature d'un produit "reserve".
- **Accumulated BTC to date** (provenance `Attested`/`Estimated` selon source).
- Composition 40/27/33 (donut honnête, refuse de fabriquer si ownership indisponible).
- Term / mois écoulés (`currentMonth` / `productDurationMonths`).

**Interdits sur ces surfaces** : "Est. yield range", `apyLow/apyHigh`, "monthly distribution",
"next distribution", ".ics", "Stressed APY", et tout borrow/LTV/liquidation/collateral/Morpho.

## 5. Termes

- **Ticket minimum $250k** et **soft lock-up 60 jours** = **contractuels / applicatifs**, **non
  enforced on-chain**. Les gates on-chain sont `tvlCap` (capacité) + `whitelist` (accès).
- KYC approuvé → `addToWhitelist` **human-in-the-loop**.

## 6. Provenance ladder (v3.0 §7)

`Live > Oracle > Attested > Estimated > Manual > Stale` (+ `partial`/`simulated` déjà présents).
Une métrique hérite du badge le plus faible de ses inputs.

## 7. Ce qui MEURT au pivot

- Couche distribution : models `Distribution` / `DistributionLedgerEntry` / `DistributionApproval`
  / `Pcap` ; cron `distribution-executed` ; `atomic-exec` ; Pcap PDF ; pages
  `/admin/distributions` + `/portfolio/distributions` ; cluster "Total distributed" ; copie
  "next distribution".
- Vocabulaire yield/APY sur surfaces Series 1 : "Est. yield range", `apyTarget {8,15}`, ticker
  "HYV", `formatApyRange` sur les surfaces investisseur.
- Borrow/LTV/liquidation sur surfaces Series 1 : sandbox `preview` (Morpho/LLTV), "Collateralised
  pockets", modèles à levier consommés par Series 1.
- Demo Zandbank actuelle (12 distributions mensuelles + APY + 4-buckets) → refonte mining note.

## 8. Ce qui NAÎT au pivot

- Models DB : take-profit history, curtailment events, BTC-accumulation (satoshis réalisés).
- Ingest Inngest on-chain : `reportMiningMetrics` / take-profit / curtailment → persistance.
- Guards chat : "single-point BTC accumulation" (aujourd'hui APY/yield-only).
- KPI "all-in BTC acquisition cost" + "BTC delivered" sur term-sheet / position / portfolio.
- Companion Monte-Carlo BTC-accumulation seedé (le champ `seed` est déjà réservé).
- Déploiement `PermissionedDynaVault` Base Sepolia (aujourd'hui non déployé → mode `legacy`).
- (Si décision #1) rebrand "Bitcoin Reserve Vault — Series 1".

## 9. Ce qui est DÉJÀ cible (à préserver, ne pas casser)

Route `/btc`, `/dashboard`, `src/features/investor-ui/*`, engine `mining-note-projection.ts` +
types, README pitch, specs 00/04/05/07, methodology v1/v2/v3 + cross-refs, PDF memo (corps),
`COCKPIT_ADMIN_SYSTEM_PROMPT`, agent Investor Memo, provenance-badge, kill-switch
`CHAT_MASTER_AGENT`, tous les zero/error-states honnêtes et disclaimers "delivered at
maturity — not guaranteed". **Pureté engine (#6) : intacte, ne rien y introduire.**
