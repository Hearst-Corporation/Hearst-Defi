# Hearst Connect

Single-vault institutional DeFi platform. **Hearst Yield Vault** : mining-backed
structured yield, monthly USDC distributions, target APY 8–15%. Cayman SPV,
$250k min ticket, 60-day soft lock-up.

Stack : Next.js 16 (App Router, Server Components by default) · TypeScript strict
· Tailwind CSS v4 (`@theme` in `globals.css`, **no `tailwind.config.js`**) ·
Prisma + Postgres (SQLite local) · Inngest · Foundry (smart contracts) · pnpm.

LLM provider : **Kimi K2.6 via Hypercli** (OpenAI-compatible SDK) — single model
for all agents. No Anthropic SDK in this codebase. See `ADR-007`.

---

## 🔒 DESIGN SYSTEM — VERROU TOTAL (lock-only, anti-hardcode)

**Aucun agent, aucun humain, aucune PR ne doit introduire :**
- ❌ Un hex ou rgba/hsl hors des fichiers tokens (exception unique :
  [`src/lib/cockpit-tokens.ts`](src/lib/cockpit-tokens.ts) pour PDF/Privy
  qui ne lisent pas les CSS vars runtime, et fichiers tests qui pin des
  valeurs canoniques pour détecter une dérive silencieuse).
- ❌ Un nouveau token CSS (`--ct-*`) sans validation explicite d'Adrien.
- ❌ Une nouvelle primitive UI (`src/components/ui/*`) si elle duplique
  une primitive existante. Avant de créer, **lire** `src/components/ui/` et
  réutiliser.
- ❌ Un nouveau bouton/classe utilitaire Tailwind arbitraire (`p-[37px]`,
  `bg-[#aabbcc]`, etc.) — toujours passer par un token ou une classe
  `.ct-*` du shell.
- ❌ Tout vert autre que `--ct-accent` (#A7FB90). Pas de `green-400` Tailwind,
  pas de `#4ade80`, pas de `accent-soft` utilisé comme « couleur de catégorie
  alternative ». Pour différencier dans un chart, prendre `--ct-status-info`
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

**Tout PR qui introduit l'un de ces patterns est rejeté.** L'agent doit
demander une exception explicite à Adrien et la documenter dans l'ADR si
elle est accordée.

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

Mirror TypeScript des valeurs canoniques (pour les surfaces qui ne lisent pas
les CSS vars runtime — PDF react-pdf, Privy SDK theme, error pages standalone) :
[`src/lib/cockpit-tokens.ts`](src/lib/cockpit-tokens.ts). Toute valeur ajoutée
ici doit être un **mirror** d'un token CSS existant (jamais une valeur nouvelle).

Doc DS complète + tableau des tokens autorisés : [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

**Un seul design system en runtime** : Cockpit (`--ct-*` via `@hearst/cockpit-shell`).
Le package orphelin `packages/ds` (`@ds/core`, namespace `--ds-*`) a été retiré du repo.
Primitives de page : `AdminPageHeader` (admin), `ProductPageHeader` (investor,
`align="center"` pour onboarding / confirmation), `AuthFormShell` (auth
secondaire avec `title`/`description`), `LegalPageHeader` (docs légales).
Routes auth secondaires (`/forgot-password`, `/reset-password`,
`/totp-challenge`) : shell bare via `app-chrome.tsx` (pas de `ConnectShell`).
Login marketing (`/`, `/login`) : classes `.login-split__*` + `.ct-input-bare`
dans `cockpit.css` (zéro `style={{}}` statique). Utilitaires composés récents :
`.ct-text-accent`, `.ct-link-accent`, `.ct-panel-inset`, `.ct-overlay-backdrop`,
`.ct-projection-footer`, `.ct-kpi-auto-grid`, `.ct-kpi-glass`.

### Process pour ajouter un token (rare, validé Adrien uniquement)

1. **Stop** l'implémentation. Ne rien committer.
2. Formuler une demande écrite avec :
   - **Quoi** : nom du token + valeur.
   - **Pourquoi** : usage concret (URL + zone précise).
   - **Pourquoi l'existant ne suffit pas** : prouver qu'aucun token actuel
     ne couvre le besoin.
   - **Alternative** : la solution color-mix / dérivation possible.
3. Attendre validation Adrien.
4. Si validé : ajouter dans `src/app/cockpit.css` + mirror dans
   `cockpit-tokens.ts` si nécessaire + mettre à jour `docs/DESIGN_SYSTEM.md`
   + ADR si non-trivial.

### Le verrou se contrôle avec

```bash
pnpm typecheck            # tsc strict
pnpm lint                 # eslint, no-any en erreur
pnpm test                 # vitest — pin les tokens canoniques (cockpit-tokens.test.ts)
```

Et le hub d'audit DS local :

```
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
4. **Pas de chat IA.** Les agents produisent du JSON structuré uniquement
   (voir [`docs/spec/09-agents.mdx`](docs/spec/09-agents.mdx)).
5. **Mots interdits** dans les agents : "guarantee", "promise", "certain",
   "will deliver", "risk-free".
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
- Accent = vert `#A7FB90` (fond noir `--ct-bg-deep`). Les textures et effets de profondeur sont autorisés.

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
```

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
- **`agent-dev`** — `src/lib/agents/*`. Structured outputs only, Kimi K2.6.
- **`sc-dev`** — `contracts/*`. Foundry, OpenZeppelin, phased rollout.
- **`ui-dev`** — `src/app/*`, `src/components/*`. Refuse la logique métier
  hors engine.

Chaque agent a une liste « forbidden » plus stricte que ce README. **Si un
agent rencontre un cas non couvert, il s'arrête et demande à Adrien.**
