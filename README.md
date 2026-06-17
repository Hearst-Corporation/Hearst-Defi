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
allocations / runbooks). Réglages rail (`cockpit-shell/` local, alias `@hearst/cockpit-shell`) :
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

**Admin dashboard (`/admin/dashboard`)** — layout command-center :
KPI strip (vault) → charts vault (allocation orbit + NAV, gated `hasLiveKpis`
via `src/lib/admin/dashboard-vault-signals.ts`) → operator queues → cockpit
ops (action queue, live metrics, live ops) → audit trail.
Risk / proof / distribution = KPI strip + liens operator shortcuts, pas de
panels détail sur cette page. Barrel : `@/components/admin/dashboard`.

**Proof Center (`/proof-center`, `/admin/proof-center`)** — PoR summary,
mining cash-flow coverage, latest distributions (6), rebalancing events avec
modal PTAI (5), event timeline on-chain, catalog off-chain (paper proofs),
adresses vault/manager/custody + contracts Phase 2 + audit trail.

**Admin agents & investors** — persona ops :
- `/admin/agents` — catalog Batch / Chat / Platform + bibliothèque `AgentTemplate` (create / edit / archive, compteur d'usage). Agent `email-outreach` (GPT-4.1, ADR-011) classé Platform.
- `/admin/customers` — directory + **New investor** (provisionne `User` + `Investor`, lie un profil Typeform orphelin par email si présent).
- `/admin/customers/[id]` — questionnaire Typeform (éditable), calibration (suggérée vs appliquée), assignation template, mémoire agent (`AgentMemory`), conversations récentes.
- `/admin/outreach` — prospects, campagnes cold/newsletter, stats open/click/bounce ; `/admin/outreach/[campaignId]` — review drafts agent + envoi tracké (Resend + Svix).
- `/admin/onboarding-test` — simulateur Typeform manuel (crée user + calibre + sync HubSpot).
- Webhook `POST /api/typeform/webhook` — HMAC (`TYPEFORM_WEBHOOK_SECRET`), upsert `QualificationProfile`, calibration auto si email connu.
- HubSpot (portal EU1) — sync sortant contacts + notes mémoire ; reverse-sync entrant cron Inngest 15 min (`hubspot-reverse-sync`).
- Mémoire chat — distillation best-effort tous les 6 messages (`memory-distill.ts`, `after()`), réinjectée via `loadUserMemory` → `buildUserContextSystemBlock`.

---

## Design system — guidelines (tokens & primitives)

**Préférer les tokens et primitives existants. Éviter :**
- ❌ Un hex ou rgba/hsl hors des fichiers tokens (exceptions : palette PDF
  [`src/lib/pdf/pdf-palette.ts`](src/lib/pdf/pdf-palette.ts) pour react-pdf ;
  hex SDK tiers — Privy / CockpitShell — alignés sur `--ct-accent` en commentaire).
- ❌ Un nouveau token CSS (`--ct-*`) sans besoin clair et répété. En phase chantier,
  préférer d'abord recalibrer layout / spacing / hiérarchie avec les primitives
  et tokens existants.
- ❌ Une nouvelle primitive UI (`src/components/ui/*`) si elle duplique
  une primitive existante. Avant de créer, **lire** `src/components/ui/` et
  réutiliser.
- ❌ Un nouveau bouton/classe utilitaire Tailwind arbitraire (`p-[37px]`,
  `bg-[#aabbcc]`, etc.) — toujours passer par un token ou une classe
  `.ct-*` du shell.
- ❌ Tout vert ad hoc. **Un seul vert runtime** : `--ct-accent` (#A7FB90). Le token sémantique `--ct-status-success` existe toujours (success/live/valid l'utilisent) mais **résout vers `var(--ct-accent)`** — jamais un second vert. Pas de `green-400` Tailwind,
  pas de `#4ade80` / `#16A34A` hardcodé en web. Pour différencier dans un chart, prendre `--ct-status-info`
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

Documenter dans un ADR toute exception token/primitive nouvelle si elle change
le langage système ou la logique produit. Les calibrations UI locales n'ont pas
besoin d'ADR à elles seules.

**Grille investisseur (`product-bento.css`)** : `.dash-bento` / `.bento-col-*` ;
material via `Card`, `ProductSection`, `ModuleChrome`. `portfolio.css` = layout
scopé `.pf-container` (spacing, reflow `@container pf` 880px, typo roles
`pf-hero-rail-title` / `pf-cockpit-panel__title--primary` / `pf-hero-kpi-value`,
secondary `pf-cockpit-panel`, chart seul en `card-premium` `pf-value-chart`).
Section **Activity & Payouts** : `bento-col-8` activity + `bento-col-4` calendar
(compact timeline ~48px de haut — tient en sidebar ; stack `@container pf` ≤880px).
Titres panels : `.pf-panel-title` (alias de `.pf-hero-rail-title` hors hero).

### Design system — copie locale éditable

Le DS Cockpit est **dé-vendoré** : il vit dans `cockpit-shell/` (composants + `tokens.css`)
et s'édite **librement** ici (tokens `--ct-*`, CSS, composants) — pas de package figé, pas
de source centrale, pas de resync. L'ancien doublon `package/` (build artifact) a été retiré.
Cascade CSS (du plus amont au plus aval) :

```
cockpit-shell/tokens.css                        (copie locale ÉDITABLE — dé-vendorée)
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
- **Hover states** : Bento (`.dash-cell`) et surfaces graphite (`.ct-glass-panel`,
  `.pf-cockpit-panel`) — bordure renforcée + bevel interne (`--ct-glass-bevel-hover`) ;
  focus garde bevel + `--ct-shadow-focus-ring`. Pas de lift ni wash radial.
- **Sharpening typo** : `.stat-value` → `--ct-tracking-tighter` ; `.stat-label` /
  `.eyebrow` → `--ct-tracking-wider`. Padding LP `.ct-card` = `--ct-space-5/6` ;
  admin override dense via `.admin-doc .ct-card`.
- **Glass calmer** : `--ct-graphite-blur` 16px, fond spatial lumineux (image + blooms),
  cartes graphite semi-translucides — pas de blur 28px « aquarium ».
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
`cockpit-shell/tokens.css`).

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
success/live = `--ct-status-success` qui **résout vers `var(--ct-accent)`** (un seul vert runtime). `CONNECT_ACCENT_HEX` aligné pour Privy/shell.
**Portée accent** : CTA primaires, focus rings, sélection inset fine (2px rail gauche sur pills/rail/presets) — pas titres, data bars,
charts, mining/status ni wash de fond. Liens génériques = texte fort + souligné neutre (accent au hover seulement).

**Un seul design system en runtime** : Cockpit (`--ct-*` via `cockpit-shell/` local).
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
- Surface par défaut : `Card` → `.ct-glass-panel` (produit **et** admin). Header canon : `DashboardPanelHeader` (`src/components/ui/dashboard-panel-header.tsx`). Éviter les listes flat ad hoc (`admin-doc-flat-list`, `admin-vault-list-card`) et l'usage direct de `ct-card` quand le composant `<Card>` suffit.
- Badges et Pills : `.ct-pill` est réservé aux filtres interactifs. Pour les états statiques, utiliser le composant `<Badge>`.
- Boutons : `<Button>` doit toujours déclarer un `size=` explicite (md, sm, lg).
- Formatters : `src/lib/vaults/product-display.ts`.
- Vault detail parity admin/LP : faits partagés `src/lib/vaults/vault-detail-facts.ts` ; présentation `vault-admin-kpi-strip`, `vault-legal-proof-rows`, `vault-allocation-display` (admin = `Card`, LP = sections plates).
- Shell compact : le rail chat droit (`.ct-rail-right`, 420px) est masqué sous `1200px` via `src/app/cockpit.css` pour préserver la largeur du contenu central ; seul le padding `.ct-page-area` se resserre sous `768px`.
- Exceptions non-glass à privilégier aujourd'hui : `.scenario-preset-bar`, `Ptai variant="flat"` en compare, `EmptySurface` seul — voir ADR-013 §10.3. Dashboard command board + KPI strip : `Card` / `.ct-glass-panel`.
- Migration ADR-013 : **Lots 1+4 done** (surfaces JSX, `SystemPanel` supprimé, aliases CSS retirés, scenario-lab sur `Card`). Reste : token syntax legacy admin (shorthand `(-ct-TOKEN)` → canon bracket form).

### Process pour ajouter un token (rare, validé Adrien uniquement)

1. **Stop** l'implémentation. Ne rien committer.
2. Formuler une demande écrite avec :
   - **Quoi** : nom du token + valeur.
   - **Pourquoi** : usage concret (URL + zone précise).
   - **Pourquoi l'existant ne suffit pas** : prouver qu'aucun token actuel
     ne couvre le besoin.
   - **Alternative** : la solution color-mix / dérivation possible.
3. Si le besoin reste réel : ajouter dans `src/app/cockpit.css` (+ `pdf-palette.ts`
   si surface PDF) et mettre à jour `docs/DESIGN_SYSTEM.md`.
4. Ajouter un ADR seulement si le changement modifie réellement le système ou un invariant produit.

### Garde-fous — DS audit advisory, qualité bloquante (2026-06-16)

Le **DS audit n'est plus un gate bloquant** : le design system s'édite sans qu'un
script DS échoue le build. Mais ce n'est **pas** un désarmement définitif des garde-fous —
**lint / typecheck / vitest restent bloquants** (en local et en CI). Le réarmement du
DS gate en bloquant ne se fait que sur **décision explicite future**.

État courant :

- **`pnpm lint` = `eslint src`** (bloquant sur les vraies erreurs ESLint ; **pas** de
  `|| true`). `no-explicit-any` et `no-unused-vars` sont en **`warn`** (signal visible,
  pas blocage). `ds-layout-audit` **n'est pas** dans `lint`.
- **`pnpm typecheck`** (tsc strict) et **`pnpm test`** (vitest) restent **bloquants** en CI.
- **DS audit = diagnostic manuel/advisory** — les scripts existent et se lancent à la
  main, jamais en CI :

```bash
pnpm lint                 # eslint src — BLOQUANT (erreurs réelles)
pnpm typecheck            # tsc strict — BLOQUANT
pnpm test                 # vitest — BLOQUANT
pnpm ds:layout            # DS layout/brand invariants — MANUEL (advisory)
pnpm ds:classes           # audit classes .ct-* — MANUEL (advisory)
pnpm ds:token-drift       # divergence tokens.css ↔ cockpit.css — MANUEL (advisory)
```

CI (`​.github/workflows/ci.yml`) : `lint-typecheck` + `vitest` **bloquants** ;
`foundry` advisory pour l'instant (contrats Phase 2, mainnet gated audit — ADR-006).

Journal DS : [`docs/DESIGN_SYSTEM.md §11`](docs/DESIGN_SYSTEM.md).

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
- Accent brand = vert `#A7FB90` (`--ct-accent`). Success/live = **même vert** via `--ct-status-success` → `var(--ct-accent)` (un seul vert runtime ; PDF garde son `#16a34a` print). Fond noir `--ct-bg-deep`. Les textures et effets de profondeur sont autorisés.
- Phase chantier UI : spacing, marges, hiérarchie, nav, doc-flow et shell peuvent
  être recalibrés directement dans les fichiers partagés tant que les garde-fous
  produit (APY range, provenance, no fake-live, disclaimers) restent respectés.

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
pnpm tsx scripts/create-lp-user.ts  # LP démo (lp.demo@hearstcorporation.io, env LP_EMAIL/LP_PASSWORD)
pnpm tsx scripts/create-agent-template.ts  # 1er AgentTemplate + assign au LP démo
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

## Go-live (staging / testnet pilot)

**Before any production deploy** : run `pnpm preflight` (must exit `0`). It
fails on P0 issues — e.g. a SQLite `DATABASE_URL` instead of Postgres. This is
a **manual** pre-merge check (`scripts/preflight-prod.mjs`) — not a blocking CI
job. Production deploys via the **Vercel Git integration** on push/merge to
`main` → **https://connect.hearst.app** (projet Vercel `hearst-connect`). There
is no automated deploy gate in CI. `ci.yml` runs lint/typecheck/tests on PRs
only (and only blocks the Vercel deploy if GitHub branch protection is
configured to require it). `pnpm start` binds `0.0.0.0:${PORT:-4105}` — Vercel
injecte `PORT` automatiquement.

**Post-deploy smoke (prod)** :

```bash
curl -sf https://connect.hearst.app/api/health   # → {"status":"ok"}
# puis connecté (investor ou admin) :
#   /proof-center        — distributions, rebalancing PTAI, adresses vault
#   /admin/proof-center  — même surface opérateur
```

Si le schéma Prisma a changé : snapshot `pg_dump` puis `DATABASE_URL=<prod> pnpm db:push`
(depuis une machine de confiance, jamais depuis SQLite dev). Voir
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

**Required Vercel production secrets (P0)** — see [`.env.example`](.env.example)
for the full annotated list :

- `DATABASE_URL` — Postgres (not SQLite ; preflight rejects `file:` URLs).
- `INNGEST_SIGNING_KEY` — `signkey-prod-*`.
- `PERSONA_WEBHOOK_SECRET` — KYC/KYB webhook signature.
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — rate limiting / nonces.
- `NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS` — vault address for invest/redeem.
- `RESEND_API_KEY` — **P1, not P0** : if unset, investors are still paid but
  never emailed (distribution emails skip silently). Set it before any pilot
  where payout notifications matter.

**Testnet pilot verification** :

- `pnpm test:e2e` — Playwright UI smoke (front-end happy paths).
- `pnpm pilot:e2e` (`scripts/pilot-e2e.ts`) — on-chain rail :
  approve / deposit / redeem against the vault on **Base Sepolia**. Needs a
  throwaway `PILOT` key (never a real-money key) plus faucet USDC.

**HARD GATE** : the mainnet (real-money) deploy stays **blocked** on a completed
Spearbit audit + remediation ([ADR-006](docs/decisions/ADR-006-lift-mvp-lock-v1-v2.md)).
Everything above is for **testnet pilot only** — lifting the MVP lock does not
authorize unaudited mainnet code.

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
