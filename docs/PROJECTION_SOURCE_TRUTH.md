# Projection / Scenario Lab / Preview — source de vérité

Trois pages, trois rôles distincts. Ne pas les confondre.

```
Scenario Lab       = exploration live (bac à sable).
Projection         = source officielle / studio de production.
Projection Preview = aperçu rapport investisseur — live si branché au
                     dernier study, DÉMO (fixture) sinon.
```

## Rôles exacts

- **`/admin/scenario-lab` — Exploration live.** L'admin bouge les inputs, l'engine
  pur calcule un APY range. Inputs live : BTC (oracle/Coingecko), hashprice
  (mempool), **stable yield (DeFiLlama médian USDC)**. Persiste chaque run en
  `ScenarioRun`. Ne produit PAS de vault.

- **`/admin/projection` — Source officielle.** Même engine + batch sensibilité
  1D/2D + **promote-to-vault-draft** (`VaultDeployment` status=draft). C'est la
  page qui produit un vrai vault. **La vérité de production vit ici.**

- **`/admin/projection/preview` — Aperçu rapport (DÉMO).** Aujourd'hui alimenté
  par une **fixture** (`PREVIEW_PROJECTION_INPUT`), pas par la projection active.
  Marqué explicitement « Demo — not linked to current projection ». Brancher au
  dernier `ProjectionStudyRun` (Option A) reste un TODO ; tant que ce n'est pas
  fait, le label DÉMO empêche tout malentendu.

## Source metadata (machine-readable)

Chaque sortie porte sa provenance, jamais un fallback déguisé en live :

- **Stable yield (Scenario Lab)** : `stableYieldSource: "live" | "fallback"`,
  `fallbackReason` (`defillama_unavailable` / `defillama_stale` / `live_fetch_threw`).
  Live = DeFiLlama médian ; fallback = 4.5% explicite.
- **Engine V2** : `usdcAnnualYield` / `stableAnnualYield` injectables ;
  défauts documentés `DEFAULT_USDC_ANNUAL_YIELD` (4.8%) /
  `DEFAULT_STABLE_ANNUAL_YIELD` (4.5%). L'engine reste pur (le live est injecté
  par l'appelant, jamais fetché dans l'engine).
- **Artifact projection** : `provenance[]` + `source` par input + `methodology.seed`
  (v2 seeded p5/p50/p95, déterministe).

## Mocks restants assumés

- `vol_index` (Scenario Lab) : pas de feed vol BTC 30j live dans le repo → reste
  une **hypothèse** (`VOL_INDEX_ASSUMPTION = 45`), jamais présentée comme live.
- Preview = fixture tant qu'Option A (branchement au dernier study) n'est pas fait.
- Risk baselines smart-contract/counterparty (`risk.ts`) : pré-audit Spearbit,
  baseline volontaire.
- Coûts mining (`mining.ts`) : encore des constantes ; le vrai cost-model
  (Telegram) existe et peut y être injecté dans une passe suivante.
