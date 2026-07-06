# Data-viz references — best-in-class chart library (Portfolio mining lens)

Curated reference set behind the `/portfolio/preview` sandbox (PROMPT 109A). Ten focused
research passes, one per portfolio module. Every chart in the sandbox is **recoded from scratch**
as pure-SVG on our `--ct-*` tokens (CLAUDE.md #11) — nothing below is imported or embedded; these
are study/benchmark sources only. Licensing is noted so the execution phase knows what is safe to
lift as code (MIT/ISC/Apache-2.0) vs reference-only (FT, commercial products, CC-BY-NC).

**Cross-cutting design language** (converged across all 10 passes):
- **One green + neutral graphite.** `#A7FB90` reserved for the primary/verified series; everything
  secondary is graphite/white-alpha. Ordered categories use a single-hue *sequential* ramp (lightness
  steps), never a rainbow (ColorBrewer/Datawrapper).
- **Bands for anything Estimated.** Center line inside a faint band + `Estimated` badge — never a
  false-precise single line (CBECI, BoE).
- **Moving averages** on noisy series (hashrate/difficulty); **step, don't interpolate** epoch data.
- **Bullet graphs, never radial gauges** for target-bearing KPIs (Few).
- **Small multiples, not a risk matrix / filled radar** for multi-dimension risk (Cox, Tufte).
- **Grey = unknown/estimated** so absence-of-evidence never reads as green (Carbon, Grafana).
- **Provenance on every number; APY always a range; no forbidden words.**

---

## 1. Portfolio value / NAV time-series
- **FT Visual Vocabulary / Chart Doctor** — https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary — *MIT code / FT poster* — ink discipline, direct end-of-line labeling, zero-baseline for absolute $.
- **Robinhood baseline chart** — https://robinhood.com/us/en/support/articles/using-charts/ — *ref only* — cost-basis diverging fill (the one justified 2nd color: muted neutral-red below baseline).
- **Koyfin Historical Graph** — https://www.koyfin.com/help/charts-and-graphs/ — *ref only* — log/linear toggle + crosshair value/date readout, dark boardroom.
- **Bloomberg Terminal GP/G** — https://professional.bloomberg.com/products/bloomberg-terminal/charts/ — *ref only* — event annotations on the curve (distributions/attestations), green-up/red-down.
- **Underwater / Drawdown** — https://gregorygundersen.com/blog/2021/08/27/drawdown/ — *ref* — paired underwater panel; `(value − running peak)/peak`, downward area, never green.
- **Bank of England fan chart** — https://www.bankofengland.co.uk/quarterly-bulletin/1998/q1/the-inflation-report-projections-understanding-the-fan-chart — *OGL* — percentile-band uncertainty.
- **Observable Plot (area/band/difference/missing-data marks)** — https://observablehq.com/plot/marks/area — *ISC* — honest missing-data gaps (don't interpolate over unverified windows).

## 2. Allocation / composition
- **FT Visual Vocabulary — part-to-whole** — https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary — *MIT/FT* — donut/treemap/marimekko/sunburst decision matrix.
- **Addepar sample reports** — https://addepar.com/sample-reports — *ref only* — target-vs-actual allocation (ghost target track).
- **Datawrapper donut craft** — https://www.datawrapper.de/academy/customizing-your-donut-chart — *ref* — order slices largest→smallest, center = total, direct labels, "Other" past ~7.
- **Datawrapper color-scale guidance** — https://www.datawrapper.de/blog/which-color-scale-to-use-in-data-vis — *ref* — single-hue sequential ramp for ordered categories (our green→neutral bucket tiers).
- **Observable Plot / D3 treemap + `d3-hierarchy`** — https://observablehq.com/@d3/treemap/2 — *ISC/BSD* — layout engine for treemap/sunburst; render in HIS SVG.
- **Adobe Spectrum / Michelin DS donut** — https://spectrum.adobe.com/page/donut-chart/ — *ref* — token-governed donut rules (≤4–6 slices, direct labels, center total).

## 3. Bitcoin mining production & hashrate
- **Luxor Hashrate Index / Hashprice** — https://data.hashrateindex.com/network-data/bitcoin-hashprice-index — *proprietary (license to embed)* — the category-defining unit ($/TH/day), energy-adjusted hashprice, ASIC J/TH tiers.
- **mempool.space hashrate & difficulty** — https://mempool.space/graphs/mining/hashrate-difficulty · API https://mempool.space/docs/api/rest — *free, self-hostable* — hashrate area+MA co-plotted with **difficulty as a stepped line**. The most directly copyable pattern.
- **Glassnode BTC Miners** — https://studio.glassnode.com/dashboards/btc-miners — *tiered/paid* — multi-SMA ribbon (single hue, varied opacity) for trend.
- **Cambridge CBECI** — https://ccaf.io/cbnsi/cbeci — *CC-BY-NC-SA* — energy/efficiency as a lower/best-guess/upper **band** (the estimated-with-range model).
- **Braiins Insights** — https://insights.braiins.com/en/pools-blocks — *ref* — fleet/worker roll-up, uptime health.
- **Foundry USA (via mempool)** — https://mempool.space/mining/pool/foundryusa — *public* — share-of-network + cumulative reward framing.
- **Public-miner production reports (Riot/TeraWulf/CoinShares)** — https://www.riotplatforms.com/ — *public, cite* — operation-level BTC-produced bars + **downtime decomposed by cause** (online/curtailed/scheduled/unscheduled).

## 4. Waterfall / bridge (mining → yield)
- **IBCS / Hichert Standards** — https://www.ibcs.com/resource/horizontal-waterfall-chart/ — *CC-BY-SA* — canonical grammar: base/total full-height pillars, floating deltas, signed labels, green+/red−/grey-total.
- **FT Visual Vocabulary — Flow / Part-to-whole** — https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary — *MIT/FT* — layout/typography north star.
- **think-cell waterfall** — https://www.think-cell.com/en/product/waterfall — *ref* — dashed connectors, mandatory data labels, column-break for disproportionate scale.
- **Observable/d3 waterfall** — https://observablehq.com/@rudzinski/waterfall-chart — *ISC* — running-total accumulation + `stroke-dasharray` connector recipe.
- **Highcharts / Plotly waterfall APIs** — https://www.highcharts.com/docs/chart-and-series-types/waterfall-series — *docs free / lib licensed* — `isSum` computed-total pattern, connector object model.

## 5. Sparklines / bullet / dense KPI micro-charts
- **Tufte — Sparklines (*Beautiful Evidence*)** — https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/ — *ref* — min/max/last colored dots + normal reference band.
- **Stephen Few — Bullet Graph Design Spec** — https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf — *© free-to-read* — the gauge replacement: featured bar + target tick + grayscale qualitative bands.
- **Matthew Ström — Tiny data viz** — https://matthewstrom.com/writing/tiny-data-viz/ — *ref* — `area=false` at small sizes (min/max/last-dot line has higher data-ink).
- **Tremor KPI cards** — https://github.com/tremorlabs/tremor — *Apache-2.0* — tile anatomy (label/value/delta/spark).
- **Protovis / Observable sparkline** — https://observablehq.com/@d3/sparkline — *ISC* — min/max-dot SVG recipe.

## 6. Energy / efficiency
- **Electricity Maps** — https://app.electricitymaps.com/ · datasets https://portal.electricitymaps.com/datasets — *ODbL (attrib+share-alike)* — grid-mix stacked signal (collapse to one muted green stacked micro-bar).
- **Grid Status** — https://www.gridstatus.io/live/caiso — *lib BSD / platform paid* — LMP price + **curtailment windows as shaded x-bands** (cheap/curtailed = ambient green, ramp-able).
- **EIA Hourly Grid Monitor (Form 930)** — https://www.eia.gov/electricity/gridmonitor/ · API https://www.eia.gov/opendata/ — *public domain* — demand-vs-forecast shaded delta (power MW vs capacity).
- **Google Data Center PUE** — https://datacenters.google/efficiency/ — *ref* — efficiency-vs-industry-benchmark (bullet + TTM line).
- **Cambridge CBECI** — https://ccaf.io/cbnsi/cbeci — *CC-BY-NC-SA* — power GW / TWh as an uncertainty band.
- **Our World in Data — energy** — https://ourworldindata.org/energy · repo https://github.com/owid/energy-data — *CC-BY* — the calm, single-accent styling north star.

## 7. Distribution / cashflow calendar
- **Sharesight Future Income** — https://help.sharesight.com/future_income/ — *ref* — 5-level status taxonomy (Announced→Pending→Paid-Unconfirmed→Paid-Confirmed→Estimated) → **status-driven bars, not boolean**.
- **Snowball Analytics dividend calendar** — https://snowball-analytics.com/dividend-calendar — *ref* — increase/cut delta annotations.
- **Simply Safe Dividends** — https://simplysafedividends.com — *ref* — confidence score on each projected payment.
- **Observable/D3 calendar heatmap** — https://observablehq.com/@d3/calendar — *ISC* — 12-cell month strip (secondary density view; bars stay the magnitude truth).
- **Addepar Navigator** — https://addepar.com/navigator — *ref* — deterministic distribution forecast with surfaced assumptions.
- **HighRadius / Ripple Treasury** — https://treasury.ripple.com/posts/cash-flow-dashboard — *ref* — forecast-vs-actual variance chip (owning the miss builds trust).

## 8. Uncertainty / projection fan / Monte Carlo
- **Bank of England fan chart** — https://www.bankofengland.co.uk/monetary-policy-report/2025/august-2025 — *OGL* — graded density banding, fade with horizon, **no bold median**.
- **Fed SEP** — https://www.federalreserve.gov/monetarypolicy/timeline-summary-of-economic-projections.htm — *public* — fan width calibrated from empirical forecast error + risk/uncertainty histograms (assumption ledger).
- **FiveThirtyEight 2020 forecast design** — https://fivethirtyeight.com/features/how-we-designed-the-look-of-our-2020-forecast/ — *ref* — de-emphasize median, emphasize spread; spaghetti/HOPs.
- **NHC cone of uncertainty** — https://news.miami.edu/stories/2024/02/cone-of-uncertainty-graphic-to-feature-more-information.html — *ref* — cautionary "containment effect": fade tails, don't draw a hard edge.
- **ProjectionLab / Portfolio Visualizer** — https://projectionlab.com/monte-carlo — *ref* — p10/p50/p90 finance UI; lead with probability-of-success, not a point.
- **Wilke — Fundamentals of DataViz Ch.16** — https://clauswilke.com/dataviz/visualizing-uncertainty.html — *CC-BY-NC-ND text* — graded shading + alternative paths; single bold interval reads as "the answer".
> **Honesty fix flagged:** the shipped `HcFanChart` draws its p50 median in **accent green** (`--ct-chart-curve-color` → `--ct-accent`) — a promised-return color down the center of a projection. P0 fix: muted/dashed median; reserve green for realized history only. The sandbox's local fan does this correctly.

## 9. Risk / severity / signal
- **Stephen Few — Bullet Graph Spec** — https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf — *© free-to-read* — coverage-ratio bullet (grayscale bands, target tick, green only above target + Live/Attested).
- **Cox — "What's Wrong with Risk Matrices?"** — https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1539-6924.2008.01030.x — *academic, cite* — don't force categorical dimensions into a 2-axis matrix.
- **Radar caveats** — https://www.data-to-viz.com/caveat/spider.html — *ref* — radar only for 4–7 comparable dims on shared scale, stroke-only ≤15% fill, locked axis order.
- **Grafana thresholds + State Timeline** — https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/configure-thresholds/ — *AGPL, ref* — ordered thresholds + explicit grey unknown state.
- **Datadog / PagerDuty severity discipline** — https://response.pagerduty.com/before/severity_levels/ — *ref* — status dot + rail, few levels, anti-alarm-fatigue.
- **Tufte small multiples** — https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/ — *ref* — five risk dimensions as uniform tiles.
- **IBM Carbon status tokens** — https://carbondesignsystem.com/elements/color/overview/ — *Apache-2.0* — grey=unknown, distinct amber tier, dark-mode tag pattern (muted fill + brighter dot + thin border).

## 10. Charting-library landscape (execution-phase decision)
Recommendation for the *real* implementation (NOT the sandbox, which is pure-SVG, zero-dep):
- **Keep HIS** (hand-SVG) for brand primitives (KPI tiles, sparklines, provenance micro-charts).
- **Adopt Observable Plot** — https://observablehq.com/plot/ — **ISC** — for the 4 complex charts (timeline, heatmap, band/ribbon, bullet). SSR-capable via the `document` option → Server Components. One nuance: Plot sets `fill` as a presentation *attribute*, which does NOT resolve `var(--ct-accent)`; wrap in a `HearstPlot` that resolves tokens to hex or targets emitted classes from `cockpit.css`.
- **visx (MIT)** — https://github.com/airbnb/visx — scalpel for bespoke React-managed interaction (crosshair/brush/linked hover).
- **Retire Recharts** after porting its one distribution chart. **Reject** Highcharts (commercial), AG Charts Enterprise (commercial+canvas), ECharts/Nivo-canvas/VChart (canvas-first, config-driven, fight token-honesty), Tremor (own Tailwind palette).
- **Download-first reference manifest:** FT Visual Vocabulary poster + templates (MIT), IBCS 1.2 (CC-BY-SA), ColorBrewer (Apache-2.0), Plot/D3 galleries (ISC). Read-only: Datawrapper Academy, Nightingale, Storytelling with Data. Non-commercial (do NOT ship): Information is Beautiful (CC-BY-NC), CBECI data (CC-BY-NC-SA).

> **Sandbox note:** `/portfolio/preview` ships **zero new dependencies** — all charts are local pure-SVG
> on `--ct-*` tokens, reusing the existing HIS geometry helpers. The Observable Plot / visx adoption
> above is a Phase-2 recommendation for the real page, gated on a `package.json` change (single-owner file).
