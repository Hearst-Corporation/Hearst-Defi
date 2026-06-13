# Hearst Connect

Single-vault institutional DeFi platform. **Hearst Yield Vault** : mining-backed
structured yield, monthly USDC distributions, target APY 8–15%. Cayman SPV,
$250k min ticket, 60-day soft lock-up.

Stack : Next.js 16 (App Router, Server Components by default) · TypeScript strict
· Tailwind CSS v4 (`@theme` in `globals.css`, **no `tailwind.config.js`**) ·
Prisma + Postgres (SQLite local) · Inngest · Foundry (smart contracts) · pnpm.

LLM provider : **OpenAI GPT-4.1** (`openai@6.x` SDK, `OPENAI_API_KEY`) — single
model for all 4 agents + cockpit chat. No Anthropic SDK. See **ADR-011**
(supersedes ADR-007 / Kimi-via-Hypercli).

Cockpit chat modes : `normal` (conversation produit/LP), `review` (facilitateur
admin générant un document de revue), `admin` (copilote interne architecture /
allocations / runbooks). Réglages rail (`@hearst/cockpit-shell` ≥ 0.2.1) :
infra LLM **serveur uniquement** (`OPENAI_API_KEY` / `OPENAI_MODEL`, pas de clé
client) ; toggle Markdown local branché ; clés legacy Hypercli purgées au mount.
Pas de RAG vectoriel câblé aujourd'hui : contexte via
profil/mémoire Prisma, portefeuille live si disponible, prompts statiques et
index specs/routes pour la revue. Outil chat unique : `navigate`, seulement avec
`CHAT_MASTER_AGENT=1`; aucun outil autonome d'écriture, marché, internet ou
déploiement.

Admin mode est maintenant enrichi côté serveur avec un bloc live interne :
allocations canoniques (`HYV`/`HDV`/`HBP`), dernier `MiningMetric` (BTC/hashprice/
difficulty/uptime), dernier `VaultSnapshot`, échantillon routes/specs et matrice
de capacités réellement outillées. Le chat reste en lecture/seuil de préparation :
il peut proposer runbooks, plans démo et specs graphiques textuelles, sans
exécution autonome d'actions sensibles.
Le snapshot marché inclut aussi `btc_price_usd_exact_live` via CoinGecko
avec provenance/fraîcheur (`btc_price_live_source`, `btc_price_live_taken_at`,
`btc_price_live_freshness_seconds`).
La composition passe par une couche interne `src/lib/llm/tools/*` (registre
typé + policy `chatMode/profile`) avec uniquement des outils de lecture
(`read_allocations_canonical`, `read_market_snapshot`, `read_routes_index`,
`read_specs_index`, `read_runtime_capabilities`, `generate_chart_spec`,
`generate_demo_plan`, `export_demo_pack`, `export_briefing_pack`) et
dégradation partielle en cas
d'erreur backend.

Base write-tools admin (draft-only) ajoutée dans le même registre, sans auto-exec
depuis le chat : `create_review_note_draft` et
`create_governance_proposal_draft`. Exécution en **2 phases obligatoire** :
appel 1 -> token de confirmation (TTL court, single-use), appel 2 avec token
valide -> persistance du draft. Aucun déploiement, aucune transaction financière,
aucune action destructive.
Le token est lié au couple `(userId,toolId,payloadHash)` avec hash **canonique** du payload
(serialization stable triée par clés) : si le payload change entre demande et confirmation
(ou si token expiré/utilisé),
exécution rejetée
côté serveur.
Télémétrie admin tools : chaque run est tracé dans `AdminToolRun`
avec `mode=<chatMode>`, `profile=<profile>`, `toolId`, statut
`success|blocked|failed|confirmation_required`, `inputHash` (SHA-256 du JSON d'input)
et message d'erreur borné.
Contrat de redaction read payload : sorties strictement schema-bounded et
read-only, sans secrets/env vars/identifiants sensibles ; indisponibilité
explicite via champs/lignes `unavailable` au lieu de fuite brute.

En mode `admin`, le moteur chat peut désormais appeler en cours de réponse un
allowlist strict de read-tools du registre (`src/lib/llm/tools/*`) et réinjecter
leurs sorties dans la **même** réponse modèle. Les modes `normal`/`review` ne
peuvent pas auto-appeler ces outils admin. Toute tentative modèle d'auto-exécuter
un write-tool est bloquée côté serveur (warning non sensible en logs), puis
reformulée en proposition structurée sans effet de bord.

Product Workspace copilot : quand un admin demande au chat de créer/cadrer un
produit, `/api/cockpit-chat` garde le texte en streaming et ajoute des événements
runtime `HC_EVENT` pour construire progressivement les graphiques dans la bulle
assistant (allocation stack, distribution range, stress corridor). Ces événements
sont consommés par `@hearst/cockpit-shell` et ne sont jamais affichés comme texte.

Intégration app/chat active via `POST /api/admin/chat-tools` (admin-only) :
- `GET` liste les outils admin autorisés (read + write metadata)
- `POST { action: "execute_read", input? }` exécute un read tool directement et
  retourne un payload JSON **projeté/allowlisté par tool id** (les champs
  internes non explicitement autorisés sont retirés côté API/UI)
- `POST { action: "execute_write" }` sans token retourne `confirmation_required`
- `POST { action: "execute_write", confirmedToken }` exécute uniquement après clic
  explicite de confirmation dans le panel **Actions admin** des réglages chat.
Les tokens sont TTL court + single-use; expiré/invalide => rejet HTTP explicite.
Le panel admin inclut aussi une zone **Read utilities** (lecture seule) pour
demander manuellement une spec de chart (`generate_chart_spec`) et un plan de
démo (`generate_demo_plan`), ainsi qu’un **demo pack export** structuré
(`export_demo_pack` : metadata + plan + charts optionnels + checklist optionnelle +
provenance/freshness summary, `export_briefing_pack` : executive summary + plan +
charts optionnels + actions + risk notes + provenance/freshness) puis afficher/copier
le JSON résultat en mode compact.

Navigation outillée : le mode `conversation` garde une whitelist LP (`/portfolio`,
`/vaults`, `/proof-center`, `/profile`) ; le mode `admin` dispose d'une whitelist
admin dédiée (`/admin/product-workspace`, `/admin/scenario-lab`, `/admin/dashboard`, `/admin/vaults`, `/admin/proofs`,
`/admin/governance`, `/admin/roadmap`, `/admin/projection`). Le mode `review`
reste sans tools.

---

## Design system — guidelines (tokens & primitives)

**Préférer les tokens et primitives existants. Éviter :**
- ❌ Un hex ou rgba/hsl hors des fichiers tokens (exceptions : palette PDF
  [`src/lib/pdf/pdf-palette.ts`](src/lib/pdf/pdf-palette.ts) pour react-pdf ;
  hex SDK tiers — Privy / CockpitShell — alignés sur `--ct-accent` en commentaire).
- ❌ Un nouveau token CSS (`--ct-*`) sans validation explicite d'Adrien.
- ❌ Une nouvelle primitive UI (`src/components/ui/*`) si elle duplique
  une primitive existante. Avant de créer, **lire** `src/components/ui/` et
  réutiliser.
- ❌ Un nouveau bouton/classe utilitaire Tailwind arbitraire (`p-[37px]`,
  `bg-[#aabbcc]`, etc.) — toujours passer par un token ou une classe
  `.ct-*` du shell.
- ❌ Tout vert ad hoc hors des deux tokens. Brand accent produit = `--ct-accent` (#A7FB90, vert) ; semantic success/live = `--ct-status-success` (#16A34A, distinct). Pas de `green-400` Tailwind,
  pas de `#4ade80` hardcodé. Pour différencier dans un chart, prendre `--ct-status-info`
  (bleu), `--ct-status-warning` (orange), `--ct-text-faint` (gris). Le drift
  PDF (`#16a34a` print on white) est documenté et testé.
- ❌ Le modifier Tailwind `dark:` (dark-mode-only au MVP).
- ❌ La classe Tailwind `font-mono` — utiliser `.mono` ou `.tabular` (custom
  cockpit qui ajoute aussi `tabular-nums` + `ss01`). `var(--font-mono)` CSS
  reste valide (alias officiel vers Satoshi Variable).
- ❌ Des `px` magiques (`top-[112px]`, `max-w-[640px]`). Si récurrent → token.
  Si one-shot layout-local justifié, commenter pourquoi.
- ❌ Des inline `rgba(0,0,0,X)` pour overlays/scrims — utiliser
  `color-mix(in srgb, var(--ct-bg-deep) X%, transparent)`.

Documenter dans un ADR toute exception token/primitive nouvelle.

**Grille investisseur (`product-bento.css`)** : `.dash-bento` / `.bento-col-*` ;
material via `Card`, `ProductSection`, `ModuleChrome`. `portfolio.css` = layout
scopé `.pf-container` (spacing, reflow `@container pf` 880px, typo roles
`pf-hero-rail-title` / `pf-cockpit-panel__title--primary` / `pf-hero-kpi-value`,
secondary `pf-cockpit-panel`, chart seul en `card-premium` `pf-value-chart`).
Section **Activity & Payouts** : `bento-col-8` activity + `bento-col-4` calendar
(compact timeline ~48px de haut — tient en sidebar ; stack `@container pf` ≤880px).
Titres panels : `.pf-panel-title` (alias de `.pf-hero-rail-title` hors hero).

### Source de vérité du design system

Cascade CSS (du plus amont au plus aval) :

```
node_modules/@hearst/cockpit-shell/tokens.css   (package canon, ne pas modifier)
  ↓
src/app/cockpit.css                             (extensions projet : status,
                                                 radius, z-index, durées)
  ↓
src/app/globals.css                             (@theme Tailwind v4,
                                                 alias --color-*, .mono/.tabular)
  ↓
src/app/tokens-layer.css                        (ordre de couches CSS)
```

**Interactivité & Animations (Agent 3)** :
- **Hover states** : Bento (`.dash-cell`) et Card (`.ct-glass-panel`) — bordure
  légèrement renforcée au survol (graphite calme, pas de lift ni wash radial).
- **Tooltips** : Composant `Tooltip` (via `framer-motion`) intégré aux `ProvenanceBadge` et `Metric`.
- **Transitions** : animations CSS/Tailwind locales, sans wrapper global inutilisé.
- **Portfolio** : Page complète avec bento analytics, gestion KYC/KYB
  institutionnelle. Sections multi-widgets : `ProductSection` (`Card` actif /
  `ct-section-preview` en layout preview) + `SectionEmbedProvider` — widgets via
  `ModuleChrome` + `WidgetPanelHeader` (headers masqués automatiquement en embed).
  **Zero portfolio** (`previewZeros`) : cockpit complet toujours visible (charts,
  donuts, progress bars à $0) avec `PreviewModeChip` — pas de `Live` / `Stale` /
  `Verified data` sans donnée réelle. Messages inline dans le shell si besoin.
- **Portfolio data** : `/portfolio` lit les loaders DB réels. Cockpit affiché
  même à zéro position (structure preview testable visuellement).

PDF react-pdf : palette hex locale [`src/lib/pdf/pdf-palette.ts`](src/lib/pdf/pdf-palette.ts)
(ink-on-white, distincte des `--ct-status-*` web). Source runtime = CSS (`cockpit.css` +
`@hearst/cockpit-shell/tokens.css`).

Doc DS complète + tableau des tokens autorisés : [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

**Typographie (échelle canonique)** : `cockpit.css` (`--ct-text-*`) → miroir
`globals.css` `@theme` (`text-micro` = 9px, `text-xs` = 10px). Rôles sémantiques :
`.h1`–`.body-xs`, `.stat-label`, `.stat-value`, `ct-text-micro-size`. Éviter
Tailles Tailwind nues (`text-xs`…`text-4xl`) hors primitives (`Button`) — ESLint **error**
sur `className` ; préférer `.body-*`, `.h1`–`.h4`, `.stat-value`, `.stat-label`. Labels micro
uppercase → `.stat-label` (pas `ct-text-micro-size font-bold`) ; en-têtes table → `stat-label ct-table-header` ; KPI vault LP/admin → `stat-value`. Downscale doc partagé : `src/app/doc-flow-typography.css` (`:is(.product-doc, .admin-doc)`). Audit : `.claude/commands/ds-typo.md`.

**Densité globale (calibration 2026-06)** : rails (`--ct-rail-left` 112px, `--ct-rail-right` 380px),
header shell (`--ct-shell-header-h` 4rem), échelle spacing layout (`--ct-space-5`…`--ct-space-32`),
typo headlines (`--ct-text-lg`…`display`), `.ct-page-area` / `.ct-card` / chat rail — source
`cockpit.css` `:root` + overrides composants.

**Accent brand** : `--ct-accent` #A7FB90 (vert produit canonique) ;
success/live découplé → `--ct-status-success` #16A34A. `CONNECT_ACCENT_HEX` aligné pour Privy/shell.
**Portée accent** : CTA primaires, focus rings, sélection inset fine (2px rail gauche sur pills/rail/presets) — pas titres, data bars,
charts, mining/status ni wash de fond. Liens génériques = texte fort + souligné neutre (accent au hover seulement).

**Un seul design system en runtime** : Cockpit (`--ct-*` via `@hearst/cockpit-shell`).
Le package orphelin `packages/ds` (`@ds/core`, namespace `--ds-*`) a été retiré du repo.
Admin et user partagent le **même** design system : mêmes tokens, mêmes surfaces,
mêmes rôles typo. L'admin n'est qu'une variante de densité/layout portée par
`src/app/doc-flow.css` (`.admin-doc-*`) ; ne pas recréer de surface, couleur,
radius ou padding local pour "faire admin".
Primitives de page : `AdminPageHeader` (admin), `ProductPageHeader` (investor,
`align="center"` pour onboarding / confirmation), `AuthFormShell` (auth
secondaire avec `title`/`description`), `LegalPageHeader` (docs légales).
Routes auth secondaires (`/forgot-password`, `/reset-password`,
`/totp-challenge`) : shell bare via `app-chrome.tsx` (pas de `ConnectShell`).
**Onboarding** (`/onboarding/*`) : `ConnectShell` + rail gauche ;
`OnboardingChamber` (accreditation) / cards legacy (identity, wallet) —
3 étapes accreditation → identity → wallet ; `bindWallet` persiste
`Investor.walletAddress` ; gates serveur dans `src/lib/onboarding/gates.ts` ;
IR contact via `NEXT_PUBLIC_IR_CONTACT_*` + `NEXT_PUBLIC_CALENDLY_URL` (aucun
default fictif).
Login marketing (`/`, `/login`) : classes `.login-split__*` + `.ct-input-bare`
dans `cockpit.css` (zéro `style={{}}` statique). Utilitaires composés récents :
`.ct-text-accent`, `.ct-link-accent`, `.ct-panel-inset`, `.ct-overlay-backdrop`,
`.ct-projection-footer`, `.ct-kpi-auto-grid`, `.ct-kpi-glass`.
**Sous-surfaces imbriquées (box-in-box)** — langage canonique P0 :
`Metric variant="nested"` + `NestedKpiGrid` (KPI calmes dans une Card/dash-cell,
provenance sur le bloc parent) · `NestedPanel` + `ProofRow` (preuves / evidence
tabulaires denses uniquement) · `DataRow` / `LegalMetadataRow` (faits profil,
metadata compliance — ex. `/profile`) · `DashboardPanelHeader` (titres card
investisseur avec provenance optionnelle) · `PanelStatus` / `PanelStatusSection`
(`src/components/ui/panel-status.tsx`, réexport `pf-cockpit-panel`) — message
inline **sans** boîte dans un parent déjà encadré (cockpit panel, card, chamber) ·
`PanelStatusAccent` — rail `border-l` accentué (action recommandée, risk warning)
· `EmptySurface` / `AwaitingMetricState` — module vide seul ou `variant="inline"`
dans un parent · `.ct-nested-callout` — **deprecated** (plus d'usage produit/admin ; garder
le primitive pour compat). Définis dans `cockpit.css` ; nested panels dans
`src/components/ui/nested-panel.tsx`.

**Surfaces module (dark graphite — ADR-013)** — recette canonique **`.ct-glass-panel`**,
appliquée via `Card` (`src/components/ui/card.tsx`). S'applique à toutes les surfaces,
y compris l'admin. Aliases legacy `.glass-panel` / `.glass-panel-subtle` / `.ct-system-panel`
retirés de `cockpit.css` (ADR-013 Lot 4). Exceptions documentées (seules autorisées) :
`.scenario-preset-bar`, `Ptai variant="flat"` en compare mode, `EmptySurface` seul.
Recette définie une seule fois dans `cockpit.css` ; aucune page ne redéfinit localement
un matériau graphite. Doc complète : [`docs/DESIGN_SYSTEM.md §10`](docs/DESIGN_SYSTEM.md) +
[ADR-013](docs/decisions/ADR-013-design-system-canon-full-glass.md).

**Layout document-flow** — un seul fichier source : `src/app/doc-flow.css`, portant les
scopes `.product-doc` (pages LP) et `.admin-doc` (pages admin). `product-doc.css` et
`admin-doc.css` sont consolidés dans `doc-flow.css` (ADR-013 Lot 3). Companion typo :
`src/app/doc-flow-typography.css`. Chips/badges gardent `--ct-surface-1` littéral.

**Canon typo/layout** — source unique : [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) + [ADR-013](docs/decisions/ADR-013-design-system-canon-full-glass.md).

- H1 page : `.h1` via `ProductPageHeader` / `AdminPageHeader` (classes `*-page-header*` dans `doc-flow.css`).
- H2 section : `.h2` · module : `.h3` / `DashboardPanelHeader` / `WidgetPanelHeader` · KPI : `.stat-value` + `.stat-label`.
- Shell page : `product-doc-shell` (`gap: var(--ct-space-8)`) ; admin `admin-doc-shell` (`gap: var(--ct-space-4)`, `--compact` → `space-3`). Zone `.ct-page-area` admin : `24px 20px 32px` (vs `32px 40px 80px` LP).
- Layout stacks : `src/app/doc-flow.css` — scopes `.product-doc` / `.admin-doc` ; stacks `*-doc-stack*` / `*-doc-inline-row*` (`flex flex-col gap-N` préféré à `space-y-N` Tailwind ad hoc en admin).
- Spacing rule (admin **et** product) : classe base + modifier en JSX (`admin-doc-stack admin-doc-stack--actions`, `product-doc-stack product-doc-stack--tight`). Côté CSS product, chaque `product-doc-stack--*` / `product-doc-inline-row--*` est autonome (flex + gap), comme admin — un modifier seul reste layout-safe.
- Surface par défaut : `Card` → `.ct-glass-panel` (produit **et** admin). Header canon : `DashboardPanelHeader` (`src/components/ui/dashboard-panel-header.tsx`). **Interdit** : listes flat (`admin-doc-flat-list`, `admin-vault-list-card`), className `ct-card` direct (utiliser composant `<Card>`).
- Badges et Pills : `.ct-pill` est réservé aux filtres interactifs. Pour les états statiques, utiliser le composant `<Badge>`.
- Boutons : `<Button>` doit toujours déclarer un `size=` explicite (md, sm, lg).
- Formatters : `src/lib/vaults/product-display.ts`.
- Vault detail parity admin/LP : faits partagés `src/lib/vaults/vault-detail-facts.ts` ; présentation `vault-admin-kpi-strip`, `vault-legal-proof-rows`, `vault-allocation-display` (admin = `Card`, LP = sections plates).
- Shell compact : le rail chat droit (`.ct-rail-right`, 420px) est masqué sous `1200px` via `src/app/cockpit.css` pour préserver la largeur du contenu central ; seul le padding `.ct-page-area` se resserre sous `768px`.
- Exceptions non-glass **seules autorisées** (commentaire `/* ADR-013 exception */` requis) : `.scenario-preset-bar`, `Ptai variant="flat"` en compare, `EmptySurface` seul — voir ADR-013 §10.3. Dashboard command board + KPI strip : `Card` / `.ct-glass-panel`.
- Migration ADR-013 : **Lots 1+4 done** (surfaces JSX, `SystemPanel` supprimé, aliases CSS retirés, scenario-lab sur `Card`). Reste : token syntax legacy admin (shorthand `(-ct-TOKEN)` → canon bracket form).

### Process pour ajouter un token (rare, validé Adrien uniquement)

1. **Stop** l'implémentation. Ne rien committer.
2. Formuler une demande écrite avec :
   - **Quoi** : nom du token + valeur.
   - **Pourquoi** : usage concret (URL + zone précise).
   - **Pourquoi l'existant ne suffit pas** : prouver qu'aucun token actuel
     ne couvre le besoin.
   - **Alternative** : la solution color-mix / dérivation possible.
3. Attendre validation Adrien.
4. Si validé : ajouter dans `src/app/cockpit.css` (+ `pdf-palette.ts` si surface
   PDF) + mettre à jour `docs/DESIGN_SYSTEM.md` + ADR si non-trivial.

### Le verrou se contrôle avec

```bash
pnpm ds:layout            # bloquant (règles de layout DS)
pnpm ds:classes           # advisory (vérif des classes utilitaires)
pnpm typecheck            # tsc strict
pnpm lint                 # eslint, no-any en erreur
pnpm test                 # vitest (inclut doc-flow-shells guardrail)
pnpm ds:layout            # bloquant — ct-table-surface, ct-hover-surface, ct-card direct
```

Journal DS / résumé d'audit : [`docs/DESIGN_SYSTEM.md §11`](docs/DESIGN_SYSTEM.md) (working log — checkpoints, commits mixtes acceptés, prochaine famille DS sur branche fraîche).

Hub d'audit DS **local, advisory** (n'échoue pas la CI — `exit 0` toujours) :

```
pnpm ds:classes  # ct-* allowlist + DEPRECATED ADR-013 — warnings only, jamais bloquant
/ds-tokens     # hex / rgba magiques hors fichiers tokens
/ds-typo       # font-mono interdit, font-family hors cockpit
/ds-layout     # px magiques Tailwind, dimensions arbitraires
/ds-motion     # transitions/durations hardcodées
/ds-primitives # duplications de boutons/cards/etc.
/ds-full       # tout en un
```

---

## Non-négociables produit (CI enforce)

1. **APY toujours en range**, jamais en point unique. `"9.4–12.8%"` not `"11%"`.
2. **Chaque métrique a un provenance badge** : Live / Oracle / Attested /
   Estimated / Manual / Stale.
3. **Format PTAI obligatoire** pour simulations et rebalancing :
   Projection → Trigger → Action → Impact.
4. **Pas de chat IA avec outils write/execute autonomes.** Les 4 agents restent en
   JSON structuré uniquement. Le cockpit chat est une exception cadrée : read-only
   + workflow de confirmation explicite pour les drafts admin (voir
   [`docs/spec/09-agents.mdx`](docs/spec/09-agents.mdx)).
5. **Mots interdits** dans les agents : "guarantee", "promise", "certain",
   "will deliver", "risk-free", "no risk".
6. **Scenario Engine = pure function** : pas de DB, pas de fetch, pas d'I/O
   dans `src/lib/engine/*`.
7. **Smart contracts** : event logger Phase 2 ✅, ERC-4626 vault testé sur
   Base Sepolia (Phase 3). **Mainnet gated** sur Spearbit audit complet
   + remediation (ADR-006).
8. **Multi-vault first-class** (V1+, ADR-006) : Yield / Defensive / BTC Plus.
   Vault id = clé première classe ; assumptions, share classes et provenance
   ne se mélangent pas.
9. Chaque projection montre ses **hypothèses** + disclaimer **"not guaranteed"**.
10. **Aucun cross-project import.** `/Users/adrienbeyondcrypto/Dev/hearst-connect`
    = read-only reference. Tout doit être recodé from scratch ici avec les
    tokens Cockpit.

---

## Méthode de travail visuel (RÈGLES ASSOUPLIES)

- Initiative visuelle encouragée (Glassmorphism, lueurs, gradients) pour l'aspect premium.
- Réversibilité : pas de `git add/commit/push/reset` sans demande explicite.
- Accent brand = vert `#A7FB90` (`--ct-accent`). Success/live = green `#16A34A` (`--ct-status-success`, distinct). Fond noir `--ct-bg-deep`. Les textures et effets de profondeur sont autorisés.

---

## Commands

```bash
pnpm dev                  # Next dev server (Turbopack)
pnpm build                # Production build
pnpm typecheck            # tsc --noEmit
pnpm lint                 # next lint
pnpm test                 # vitest

pnpm db:generate          # prisma generate
pnpm db:push              # prisma db push (SQLite dev.db)
pnpm db:migrate           # prisma migrate dev (named migration)
pnpm db:studio            # Prisma Studio GUI
pnpm db:seed              # Admin fixture timeline (snapshots, proofs, mining)
pnpm seed:test            # E2E login user (test@hearst.local)
pnpm seed:investor-demo   # Local visual QA — demo position + vault + profile
pnpm seed:investor-demo:reset  # Wipe fixture rows (positions, proofs, snapshots…)
```

Admin chat-tools confirmation flow (integration-style, no heavy E2E bootstrap):

```bash
pnpm test src/app/api/admin/chat-tools/__tests__/route.test.ts -t "completes write confirmation flow from request to success"
```

Runtime sync (admin tools):

```bash
pnpm db:push && pnpm db:generate
pnpm test src/app/api/admin/chat-tools/__tests__/route.test.ts src/lib/llm/__tests__/admin-tools-registry.test.ts src/lib/llm/__tests__/chat-agent.test.ts src/components/admin/__tests__/admin-chat-actions-flow.test.ts
```

**Investor visual QA (local only)** — login `test@hearst.local` / `TestPassword123!` :

```bash
pnpm seed:investor-demo
# optional richer admin timeline:
pnpm db:seed && pnpm seed:investor-demo
# reset to empty fixture state:
pnpm seed:investor-demo:reset
```

On-chain Proof Center addresses and deploy-block defaults read from
`config/deployments.base-sepolia.json` and can be overridden in `.env.local`
(`NEXT_PUBLIC_EVENT_LOGGER_ADDRESS`, `NEXT_PUBLIC_POR_REGISTRY_ADDRESS`,
`NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK`, `NEXT_PUBLIC_POR_REGISTRY_DEPLOY_BLOCK`).
Vault transactions still require `NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS` for
invest/redeem flows (see `.env.example`). Paper proofs are seeded by
`seed:investor-demo` when the DB has none.

Refuses `NODE_ENV=production` by default. Exceptional override only (e.g.
staging smoke): `ALLOW_INVESTOR_DEMO_SEED=true pnpm seed:investor-demo`.

---

## Source documents

- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — Tokens, primitives, charts SVG canon.
- [`docs/spec/*.mdx`](docs/spec/) — Specs produit (read before any feature).
- [`docs/methodology/v1.0.md`](docs/methodology/v1.0.md) — Méthodologie figée
  (bump version si change requis).
- [`docs/decisions/`](docs/decisions/) — ADRs (append-only).
- [`docs/roadmap.json`](docs/roadmap.json) + `/admin/roadmap` UI — chaque PR
  doit référencer un item roadmap.
- [`CLAUDE.md`](CLAUDE.md) — instructions agent (Claude Code + sous-agents).

---

## Sous-agents disponibles

Quatre spécialistes sous `.claude/agents/`, à invoquer via `Agent` avec
`subagent_type` :

- **`engine-dev`** — `src/lib/engine/*`. Refuse l'UI et toute I/O.
- **`agent-dev`** — `src/lib/agents/*`. Structured outputs only, OpenAI GPT-4.1 (ADR-011).
- **`sc-dev`** — `contracts/*`. Foundry, OpenZeppelin, phased rollout.
- **`ui-dev`** — `src/app/*`, `src/components/*`. Refuse la logique métier
  hors engine.

Chaque agent a une liste « forbidden » plus stricte que ce README. **Si un
agent rencontre un cas non couvert, il s'arrête et demande à Adrien.**
