# CSS_INDEX — carte des gros fichiers CSS

But : éviter de relire 7 000+ lignes de CSS en aveugle. Ouvrir le fichier **à la plage de lignes**
indiquée (`Read offset/limit` ou `sed -n`). Lignes approximatives (snapshot 2026-06-17) — confirmer
avec `grep -n "/\*"` si décalage.

## Quel fichier lire selon le problème
- **Dimensions shell + portfolio (viewport → W_pf, splits, paddings)** → **`docs/PORTFOLIO_LAYOUT_REFERENCE.md`** (**obligatoire**, doc protégée — ne jamais supprimer).
- **Shell, rails (gauche/chat droit), nav, login, fond spatial** → `cockpit.css`.
- **Page produit/admin "document" (memo, vault wizard, proof center, scenario)** → `doc-flow.css`.
- **Page Portfolio (`/portfolio`) : KPI, donut, ledger, hero grid, trust panel** → `portfolio.css`.
- **Tokens `--ct-*`** → `cockpit-shell/tokens.css` (≈1001 l.) ; compléments en tête de `cockpit.css`.

## src/app/cockpit.css (≈5438 l.) — shell + utilitaires + admin
| Plage | Section |
|---|---|
| 1–340 | Tokens complémentaires (manquants dans tokens.css) |
| 342–410 | Helpers status / texte / surface |
| 411–432 | Error / not-found shell |
| 433–560 | Nested surfaces (box-in-box), variantes flat, KPI grids |
| 560–815 | Proof grid/card, Scenario Lab / Projection Studio shells |
| 1044–1380 | Mining cash-flow evidence, toolbars compactes |
| 1380–1530 | Admin dashboard command board (dense bento, dot-provenance) |
| 1530–1875 | Zones dashboard, live ops, action queue / inngest / on-chain rows |
| 1944–2276 | Allocation orbit (conic), NAV bar chart, orbit\|NAV layout |
| 2276–2510 | Shadows, primitive token utilities, empties canon (DS §9), aliases héritage |
| 2510–2860 | Canonical graphite surface, table/pill/form inputs, bottom bar |
| 2957–3115 | Sonner toast, shell rails verre, fond spatial global, hygiène flexbox |
| 3115–3500 | Rail intra-app, rail collapsible (déplié/replié/logo), hub bottom bar, identity slot |
| 3501–3905 | Shell padding overrides, login split |
| 3837–3961 | **Rails** — `.ct-rail-left` (104px verrouillé), `.ct-rail-right`, `.ct-center-panel` `min-width:0` |
| 3962–3994 | `.ct-rail-intra` — nav verticale fixe dans `.ct-rail-left` |
| 4750–4777 | **Breakpoints shell** — L4771 `≤1199px` chat masqué ; L4775 `≤767px` padding centre |
| 5389–5438 | **Breakpoints mobile** — L5394 `≤900px` rail gauche → bottom bar 56px, `padding-bottom: 72px` |
| 3905–4396 | Debug/portfolio KPI glass, inline-style replacements |
| 4396–5280 | Admin Vaults — dense deployment list + `@container vaults-list` |

## src/app/doc-flow.css (≈1850 l.) — pages "document" (admin + produit)
| Plage | Section |
|---|---|
| 17–500 | Primitives layout partagées, form fields/grids, card grid, insets, hero L1 |
| 502–815 | Spec sidebar, confirm panels, titres admin, toolbars, stack/inline/callout/section partagés |
| 816–1040 | Scope `.product-doc` : primitives, stack/inline modifiers, callout |
| 1040–1140 | Titre page produit partagé (vaults, proof-center, profile), H1-row |
| 1139–1310 | Invest flow (`/vaults/*`), workspace mode (viewport-fit, scroll interne) |
| 1308–1700 | Invest flow 2-col, product select card, terms, deposit form, vault detail KPI, term sheet, regime table |
| 1696–1800 | Position detail (`/portfolio/[id]`) |
| 1799–fin | Proof Center (filter tablist, colonnes), mobile narrow, legal long-form |

## src/app/(product)/portfolio/portfolio.css (≈1347 l.) — page Portfolio
| Plage | Section |
|---|---|
| 23–130 | Typographie portfolio, payout calendar SVG labels |
| 130–290 | KPI row grid (3 cards), skeletons, proof rows compacts |
| 291–470 | Welcome line, stacks, reflow grids, KPI chips & progress |
| 469–760 | Pending rows, two-column grids, surface taxonomy, trust panel (3 colonnes) |
| 749–900 | Positions table (grid, empty states), hero grid welded zones |
| 898–1108 | Panel micro-title, value chart, product sections, nested empties, activity, secondary widgets |
| 1108–fin | Position detail align, donut gauge / spine / yield ledger, precision track, shimmer, reduced-motion |

> Ne pas ajouter d'index DANS les CSS dans ce lot (séparé, sur validation). Ce fichier suffit.
