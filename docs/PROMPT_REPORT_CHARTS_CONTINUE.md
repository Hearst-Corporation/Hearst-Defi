# MISSION — Finir le « Report Product » de création de Vault : charts harmonieux, présentation premium

Tu reprends un chantier UI déjà bien avancé. Lis ce prompt en entier avant de coder.
Le repo est `connect — Hearst Defi` (Hearst Connect). Dev server sur **http://localhost:4105**.

## Contexte produit

Quand un admin demande « créer un vault » dans le chat cockpit, il arrive sur
`/admin/product-workspace?autostart=1&objective=...`. Là, **5 specialists**
s'exécutent côté serveur (NDJSON streamé) et un **stepper vertical** se révèle pas
à pas, puis un **« Report Product »** se déroule en dessous (décorrélé du stepper).

URL de travail (déjà loggé en dev via `/api/auth/dev-login`) :
```
http://localhost:4105/admin/product-workspace?autostart=1&objective=Créer un vault BTC mining défensif&intent=product_creation
```
Galerie de tous les charts candidats :
```
http://localhost:4105/admin/chart-gallery
```

## Les 5 steps (pipeline serveur — NE PAS toucher la logique de calcul)

Définis dans `src/lib/agentic/swarm/live/stream-types.ts` (`CONSTRUCTION_STEPS`) et
orchestrés dans `src/lib/agentic/swarm/live/stream-orchestrator.ts` :

1. **Bitcoin Price Specialist** — prix BTC live (oracle puis spot). ✅ FAIT : box avec
   logo Bitcoin + strip `Spot / 24h (flèche ↑↓) / Sources (3 logos CoinGecko/Binance/Kraken)`.
2. **Hashprice Specialist** — hashprice $/TH/jour + difficulté réseau. ⏳ À FINIR.
3. **Mining Infrastructure Specialist** — prix machines (landed cost) + marges. ⏳ À FINIR.
4. **DeFi Specialist** — meilleurs yields stables/BTC + bande scénario BTC. ⏳ À FINIR.
5. **Data Scientist** — thèse + projection + allocation. ⏳ Le report se déroule sous le stepper.

## Où en est le code (état actuel)

- **Stepper** : `src/components/admin/product-workspace/construction-stepper.tsx`
  - Connecteur vertical continu (ligne au niveau `<ol>`, hors du `overflow-hidden` des `BentoPanel`).
  - Chaque step = un `BentoPanel` (compartiment DS canonique). Rail gauche large
    (`calc(var(--ct-space-32)+var(--ct-space-8))`) avec le rond du stepper centré.
  - Chargement par step (≥ `MIN_STEP_MS` = 5s) : spinner + narration **typewriter** +
    rangée de **logos sources**. Step 1 a ses vrais logos ; steps 2–5 ont des
    `StepLogoPlaceholder` (chips ronds avec initiale) → **à remplacer par les vrais logos**.
  - Le rond « next-up » tourne pendant que le pipeline avance vers lui ; les ronds en
    file pulsent.
- **Report** : `src/components/admin/product-workspace/data-scientist-output.tsx`
  - **DESIGN IMPÉRATIF : flat, AUCUNE box-dans-box.** Sections séparées par des
    hairlines (`border-t border-[var(--ct-border-soft)]`). KPI = `BentoKpiStrip`.
    Charts rendus **NUS** (pas de card autour).
  - Step 1 du report ✅ FAIT : la projection fan maison a été remplacée par
    `ProjectionAreaChart` (recharts) branché sur les **vraies** bandes p5/p50/p95
    (`draft.charts` kind="fan", `fanBands: {m,p5,p50,p95}[]`).
  - Reste dans le report : les **rings d'allocation** (`HcCompositionRing`) des 3
    scénarios + la canonical allocation (déjà en `BentoKpiStrip`) + targets.
- **Socle charts** (déjà installé et tokenisé, RÉUTILISE-LE) :
  - `recharts` (v3) + wrapper shadcn tokenisé `src/components/ui/chart.tsx`
    (`ChartContainer / ChartTooltip / ChartTooltipContent / ChartLegend / ChartConfig`)
    + `src/components/ui/card.tsx`.
  - `chart.js` + `react-chartjs-2` pour le **Monte-Carlo spaghetti** :
    `src/components/admin/product-workspace/monte-carlo-chart.tsx` (220 trajectoires
    GBM **seedées** mulberry32, médiane en gras — NE JAMAIS utiliser `Math.random`,
    le seed est injecté).
  - Galerie de démo : `src/components/admin/product-workspace/chart-gallery.tsx`
    (Area / Bar / Bar stacked / Pie / Radar / Line step / Line dots / Radial).
  - `ProjectionAreaChart` : `src/components/admin/product-workspace/projection-area-chart.tsx`.
- **Logos officiels déjà téléchargés** dans `public/sources/` (icônes carrées) :
  - Crypto : `bitcoin.svg`, `binance.svg`, `coingecko.svg`, `kraken.svg`, `usdc.svg`, `usdt.svg`, `dai.svg`.
  - Mining HW : `bitmain.png`, `microbt.png`, `canaan.png`.
  - Hosting : `core-scientific.png`, `riot.png`, `marathon.png`, `compass-mining.png`.
  - DeFi : `morpho.svg`, `aave.svg`, `compound.svg`, `ethena.svg`, `sky.svg`.
  - Le composant `BrandLogo` (dans construction-stepper.tsx) rend un logo par id sur
    un chip rond. **Étends le registre `BRAND_LOGOS`** pour ajouter les ids manquants.

## CE QU'IL FAUT FAIRE (par ordre)

### A. Brancher les logos partenaires dans les steps 2–4 (chargement)
Remplace les `StepLogoPlaceholder` par les vrais `BrandLogo` :
- Step 2 (hashprice) « Sources réseau » : choisis 3 sources crédibles parmi ce qu'on a
  ou ajoute-en (Luxor / Hashrate Index / mempool.space — si pas de logo, garde un
  placeholder propre, NE FABRIQUE PAS de SVG à la main).
- Step 3 (mining_infra) « Fournisseurs » : `bitmain`, `microbt`, `canaan`.
- Step 4 (defi) « Protocoles » : `morpho`, `aave`, `compound` (et/ou `ethena`, `sky`).
Étends `BRAND_LOGOS` avec les nouveaux ids → `{ label, src: "/sources/xxx.png|svg" }`.

### B. Finir le RÉSULTAT de chaque step (comme le step 1 « BitcoinResultStrip »)
Chaque step, une fois fini, affiche `result.headline` + un strip de metrics. Les
metrics serveur (labels exacts dans stream-orchestrator.ts) :
- hashprice : `Hashprice`, `Difficulty`, `Block reward`.
- mining_infra : `Top by margin`, `Best margin`, `Customs dest.`, `Energy`.
- defi : `USDC yield`, `Source`, `Mining net yield` (vérifie dans le fichier).
Donne à chaque step un strip **aligné, calé sur `BentoKpiStrip`** (PAS de mini-box
bricolée). Optionnel : un logo pertinent à gauche d'une valeur (comme Bitcoin/Spot).

### C. Finir le REPORT PRODUCT — charts harmonieux, présentation premium
C'est le cœur de la mission. Le report doit devenir une **belle présentation
institutionnelle harmonieuse**, pas un empilement de blocs. Step by step :
1. **Projection** ✅ déjà en area chart recharts (p5/p50/p95). Vérifie le rendu, polish
   si besoin (grille discrète, axes %, gradient doux).
2. **Allocation** : remplace les 3 rings `HcCompositionRing` par un visuel recharts
   harmonisé avec le reste — soit **pie/donut**, soit **radial bar**, sur les **vraies**
   données `draft.scenarios[].allocation` (mining/btc/usdc/reserve) + la
   `draft.canonicalAllocation`. UN SEUL style de chart pour toute la section.
3. **Monte-Carlo** : branche le spaghetti (`MonteCarloChart`) sur les **vrais paramètres
   du vault** (seed, horizon, vol, rendement issus de `draft.quant` / l'engine) au lieu
   des constantes démo. Ajoute-le au report comme section « Dispersion (Monte-Carlo) ».
4. **Distribution mensuelle** (optionnel) : un bar chart de la cible de distribution.
Tous les charts : **mêmes tokens, même langage visuel, mêmes tailles, mêmes paddings**.
Harmonie totale — c'est une présentation, pas une galerie.

### D. Harmonisation finale (cliner)
- Tous les steps : **même taille de box, même style de chargement, même typo** (déjà
  amorcé — vérifie et corrige les divergences).
- Le report : un rythme visuel régulier (espacements `--ct-space-*` cohérents, hairlines
  entre sections, titres `SectionLabel` uniformes).
- Le tout doit « arriver sur de belles présentations » : calme, dense mais lisible,
  premium, vert accent `--ct-accent` (#A7FB90) comme seule couleur d'accent.

## RÈGLES NON NÉGOCIABLES (CLAUDE.md + invariants produit)

- **Design system STRICT** : tokens `--ct-*` UNIQUEMENT (cf. `src/app/cockpit.css`).
  Un seul vert = `--ct-accent`. Dark only. PAS de hex hardcodé (sauf Chart.js canvas
  qui résout les tokens au runtime — voir monte-carlo-chart.tsx pour le pattern).
- **AUCUNE box-dans-box** dans le report. Hairlines, pas de cards imbriquées.
- **Honnêteté produit** : APY TOUJOURS en fourchette (jamais un point), chaque chiffre
  porte sa provenance, « not guaranteed » présent, jamais les mots interdits
  ("guarantee", "promise", "certain", "will deliver", "risk-free").
- **Pas de Math.random / Date.now** dans toute logique de simulation — seed injecté.
- **Pas de cross-project import** (interdit d'importer depuis `Dev/Projects/hearst-connect`).
- **Réutilise** le socle existant (`ui/chart`, `ui/card`, recharts, BrandLogo, BentoKpiStrip,
  ProjectionAreaChart, MonteCarloChart). NE réinstalle PAS recharts/chart.js (déjà là).
- **Pas de Math.random pour les logos** : si tu n'as pas le vrai logo officiel d'une
  source, NE le dessine PAS à la main — garde un placeholder propre et signale-le.

## MÉTHODE DE TRAVAIL (importante)

- **Step by step.** Fais UN graphique / UNE section à la fois, vérifie le rendu en live
  (Playwright : `/api/auth/dev-login` puis l'URL workspace, full screen 1728×1117),
  puis passe au suivant. Ne refonds pas tout d'un bloc.
- Après chaque modif CSS/composant : `browser_close` puis re-navigate (cache Turbopack).
- Valide en continu : `pnpm typecheck` (le vrai gate). Tests : `pnpm test` (Vitest).
- **Git** : laisse l'intégration à l'orchestrateur / Adrien. Ne commit/push/merge pas
  toi-même sauf demande explicite. Un process concurrent (nexus-bot) réécrit l'historique
  et reset le working tree — committe tôt si on te le demande, et vérifie
  `git status` / `git log origin/main` avant de supposer quoi que ce soit.

## CRITÈRE DE SUCCÈS

Un admin tape « créer un vault BTC mining défensif » → le stepper se révèle proprement
(5 boxes harmonieuses, vrais logos, chargement vivant) → le Report Product se déroule
en une **présentation premium harmonieuse** : projection (area), allocation (un chart
recharts cohérent), Monte-Carlo (spaghetti seedé sur vrais params), targets, le tout
flat, tokenisé, vert accent, sans box-dans-box, honnête (fourchettes + provenance +
not guaranteed). Beau, calme, institutionnel.
