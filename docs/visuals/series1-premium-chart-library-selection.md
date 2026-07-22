# Series 1 — Premium Data Visual Library · Selection & Integration Plan

Date: 2026-07-23 · Companion to `series1-premium-chart-library-proposal.html`
(the 3 visual directions) · No runtime change — research and decision only.
Prices/licences verified against official sources July 2026 (links at end of
the research; anything unverifiable is marked "sur devis").

## Phase 2 — Matrice de sélection

Critère éliminatoire appliqué : une lib qui impose ses couleurs/cards/identité
est disqualifiée, quelle que soit sa qualité.

| Composant | Source | Licence / prix | Qualité visuelle | Compat React 19 / Next 16 | Compatible DS `--ct-*` | Décision |
|---|---|---|---|---|---|---|
| Courbe hero (reserve) | **visx v4** (Airbnb) | MIT | Aucune par défaut — 100 % à nous (atout) ; `@visx/annotation` = meilleures annotations React | ✅ (CI React 19 verte) · SSR SVG ok | ✅ trivial (blank canvas) | **RETENIR** — moteur courbe hero |
| Courbes/aires rapides | Recharts 3.x (pattern shadcn) | MIT | Propre mais générique | ✅ v3 fixe React 19 · `use client` | ✅ props = `var(--ct-*)` | **RETENIR** — charts secondaires, aligné sur `ui/chart.tsx` existant |
| Sankey capital flow | **Apache ECharts 6** (tree-shaké) | Apache 2.0 | Meilleur Sankey OSS clé en main ; thème 6.0 pro | ✅ client component, pas de SSR (canvas) | ⚠️ bridge JS ~30 lignes (`getComputedStyle` → thème) | **RETENIR** — Sankey uniquement, jamais comme moteur général |
| Flow nodal / état contrat | **React Flow (xyflow)** | MIT (Pro optionnel, prix : voir site) | Nodes = nos composants React | ✅ | ✅ total | **RETENIR** — topologie contrat/proof |
| Motion | **Motion** (ex-Framer) + Motion Primitives | MIT | — (couche animation) | ✅ | ✅ (aucun style imposé) | **RETENIR** — draw-in, flow trace, staged reveal |
| Stepper / timeline preuve | Maison (DS + Motion) | — | Contrôle total | ✅ | ✅ | **RETENIR** — aucune lib ne fait ça bien |
| Nivo | nivo | MIT | Beau Sankey mais projet **stagnant** (0.99, ~1 an sans release) | ⚠️ risque React 19 | ⚠️ thème JS | **ÉCARTER** (maintenance) |
| Tremor | Vercel | MIT | Bon catalogue | ✅ | ⚠️ apporte son système couleurs/cards Tailwind à démonter | **ÉCARTER comme dépendance** ; garder comme catalogue de référence |
| lightweight-charts | TradingView | Apache 2.0 **+ attribution obligatoire** | Terminal-grade | ✅ client | ⚠️ bridge JS | **ÉCARTER** — logo TradingView sur produit white-label institutionnel |
| TradingView Advanced Charts | TradingView | Gratuit sur candidature, **interdit derrière auth/paywall** | — | — | — | **ÉCARTER** (clause incompatible avec l'espace investisseur) |
| plotly.js | Plotly | MIT | Scientifique | ❌ react-plotly pin React 18, ~1 MB | ❌ | **ÉCARTER** |
| Highcharts Stock | Highsoft | **833 $/dev** (Stock v13, 2026) ; Core 416,50 $ | Institutionnel out-of-box, annotations/navigator natifs, mode "styled" = theming CSS pur | ✅ wrapper officiel | ✅ (styled mode → classes CSS) | **RÉSERVE** — seule option payante justifiable, uniquement si la courbe hero doit être terminal-grade avec budget temps réduit |
| AG Charts Enterprise | AG Grid | 499 $/dev (bundle Grid+Charts 1 498 $) | Solide, jeune | ✅ | ⚠️ thème JS | **ÉCARTER** sauf si AG Grid (tables) est adopté par ailleurs |
| FusionCharts / Syncfusion / KendoReact | — | ~499–2 499 $/an · suites | Datée / suite-lourde | — | ⚠️ systèmes de thème propres | **ÉCARTER** |

Fintech réelle 2026 (signal marché) : Highcharts domine les dashboards
financiers d'entreprise ; D3/visx le sur-mesure haut de gamme (FT, Bloomberg
web) ; lightweight-charts le monde exchange/trading ; la génération Next.js
converge sur shadcn/Recharts. Notre choix (visx hero + ECharts Sankey +
maison) est la combinaison "sur-mesure haut de gamme" — cohérente avec un
family-office product, pas un SaaS.

## Phase 3 — Règle d'intégration (contrainte dure)

Aucun moteur n'apparaît jamais dans une page. Chaque visual est un composant
Hearst qui possède ses tokens, son empty state honnête et sa provenance ; le
moteur est un détail d'implémentation substituable :

```
Series1ReserveChart        → wrapper DS (tokens, axis ghost, maturity marker,
                             empty state premium, provenance) → visx dessous
Series1CapitalFlow         → wrapper DS (couleurs B1/B2/B3 = accent/amber/info,
                             légende, disclaimer target-vs-live) → ECharts sankey dessous
Series1EvidenceStepper     → wrapper DS (5 éléments doctrine §9) → DS + Motion, zéro lib chart
Series1ContractTopology    → wrapper DS (nodes = composants Hearst) → React Flow dessous
Series1AllocationBars      → pattern shadcn/ui chart.tsx existant → Recharts dessous
```

Bridge tokens pour les moteurs canvas (ECharts) : un module unique
`chart-theme-bridge.ts` lit les `--ct-*` via getComputedStyle au mount et
produit le thème JS — jamais de couleur dupliquée en dur. Doctrine §8 reste :
courbes/aires consomment `--ct-chart-curve-color` / `--ct-chart-area-*`,
jamais `--ct-accent` en direct ; `--ct-asset-btc` (ambre) à créer dans
cockpit.css au moment du premier chart BTC (nommé §3 doctrine, toujours
manquant).

Honnêteté (non-négociable, inchangée) : pas de fake curve — un chart sans
série réelle rend l'empty state premium (message + axis ghost) ; le fork
s'annonce (« Indexed on fork — not mainnet ») ; target ≠ live toujours
libellé.

## Phase 4 — Design target

Rejeté : dashboard SaaS, 20 petites cards, donuts génériques, sparklines dans
les KPI (règle Adrien).
Cible : cockpit institutionnel — par surface :

1. **Grand BTC reserve chart** → /dashboard, l'objet L1 (Direction A du
   prototype) — la série vient de l'indexeur, jamais reconstruite.
2. **Capital flow animé** → /vaults/[id] (Direction B) — Sankey B1/B2/B3,
   un tracé lumineux subtil, largeurs = policy targets.
3. **B1/B2/B3 allocation** → stacked pair target-vs-on-chain (le gap EST
   l'information), pas un donut.
4. **Maturity timeline** → M0 → lock-up → halving → M24, marker pulsant.
5. **Proof event timeline** → /proof-center (Direction C) — stepper premium
   5-éléments, events indexés dockés par étape.
6. **Portfolio evolution** → réactivable UNIQUEMENT quand une vraie série
   per-investor existe (InvestorNavSnapshot `computed` — table vide
   aujourd'hui, donc empty state premium en attendant).
7. **Asset identity** → BTC = ambre (`--ct-asset-btc` à créer), USDC = bleu
   (`--ct-status-info`), Hearst = le seul vert. Verrouillé partout.

Motion : UNE idée par surface — draw-in (A), flow trace (B), staged reveal
(C). Icons : lucide (déjà dans le repo, Series1Nav) — pas de 2ᵉ set.

## Phase 6 — Recommandation

### Top 5 composants recommandés

1. **Series1ReserveChart (visx)** — pourquoi : la courbe hero est LA pièce
   du produit et mérite une signature maison ; `@visx/annotation` couvre
   deposit/halving/maturity nativement. Coût : 0 $ (MIT). Intégration :
   moyenne (tout le rendu à écrire, mais notre chart layer SVG existe déjà).
   Risque : faible — Airbnb-maintenu, bundle 20-60 kB tree-shaké.
2. **Series1EvidenceStepper (maison + Motion)** — pourquoi : ferme doctrine
   §9/§12 (le stepper premium listé manquant) ; aucune lib ne fait mieux que
   du DS pur. Coût : 0 $. Intégration : la plus rapide du lot. Risque : nul.
3. **Series1CapitalFlow (ECharts 6 sankey, tree-shaké)** — pourquoi :
   meilleur Sankey OSS clé en main, thème 6.0 par design tokens. Coût : 0 $
   (Apache 2.0). Intégration : bridge thème ~30 lignes + wrapper ; client
   component (pas de SSR — acceptable pour un visual). Risque : moyen-faible
   (canvas, +80-100 kB gzip — chargé UNIQUEMENT sur /vaults/[id] en dynamic
   import).
4. **Series1ContractTopology (React Flow)** — pourquoi : nodes = nos
   composants React, thémabilité totale, parfait pour vault↔pockets↔events.
   Coût : 0 $ (MIT, Pro non nécessaire). Intégration : simple. Risque :
   faible.
5. **Series1AllocationBars + KPI (pattern shadcn/Recharts + Motion
   count-up)** — pourquoi : continuité avec `ui/chart.tsx` existant, zéro
   friction DS. Coût : 0 $. Intégration : immédiate. Risque : nul.

Option premium en réserve : **Highcharts Stock (833 $/dev, mode styled CSS)**
— à activer seulement si (1) doit atteindre le niveau terminal avec un budget
temps réduit ; sinon inutile.

### Architecture recommandée

```
Chart engine : visx (hero/courbes signature) + Recharts 3 via le pattern
               ui/chart.tsx (charts standards) — deux moteurs, UNE grammaire
               de wrappers Hearst
Flow engine  : Apache ECharts 6 tree-shaké (Sankey) · React Flow (topologie
               nodale) — chacun derrière son wrapper, en dynamic import
Stepper      : maison (DS + doctrine §9), base construction-stepper/kyc-stepper
Motion       : Motion (motion/react, MIT) + Motion Primitives en copy-paste
Icons        : lucide-react (déjà en place — pas de second set)
```

Total licences : **0 $**. Prochaine étape (séparée, après ta validation des
3 directions du HTML) : installer visx + Motion, construire
Series1EvidenceStepper puis Series1ReserveChart, un composant validé à la
fois.
