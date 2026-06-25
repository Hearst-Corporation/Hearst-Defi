# design-sync notes — Hearst Connect Design System

Repo-specific gotchas for syncing `src/components/ui/` primitives to claude.ai/design.
Project: **Hearst Connect Design System** (`0b1cbc35-0125-4d74-b10a-d84628c09d16`).

## Shape & source of truth
- **Package shape, synth-entry from source** — there is NO built `dist/` for the DS; the
  components live in `src/components/ui/*.tsx` and are styled by global `.ct-*` classes +
  Tailwind v4 utilities, not imported CSS.
- The in-app canonical reference is **`/admin/design-system`** (`src/components/admin/design-system/section-*.tsx`) —
  use it as the source of canonical usage/compositions when authoring previews.
- Scope = the ~25 reusable `ui/` primitives (Adrien's choice 2026-06-25). Shell/chat
  (`cockpit-shell/`) deliberately NOT synced.

## How the build is wired (all driven by cfg.buildCmd)
- `cfg.buildCmd = node .design-sync/build-foundation.mjs` does three things, in order:
  1. `gen-entry.mjs` → regenerates the bundle barrel `.design-sync/ds-entry.tsx`
     (curated re-exports → `window.HearstDS`). Edit `gen-entry.mjs`, never the barrel.
  2. Tailwind v4 CLI compiles `.design-sync/tw-entry.css` → `.design-sync/compiled-foundation.css`
     (tokens-layer → globals → cockpit cascade, mirrors `src/app/layout.tsx`). This is `cfg.cssEntry`.
  3. rewrites the Satoshi `@font-face` `url(/fonts/…)` → `url(../public/fonts/…)` so the
     converter's `extractFonts` resolves it from the cssEntry dir.
- `--entry .design-sync/ds-entry.tsx` makes PKG_DIR walk up to the repo root, so `cssEntry`
  and `public/fonts/` stay in-bounds (cssEntry is pkgRoot-bounded).
- **`cfg.tsconfig = .design-sync/tsconfig.sync.json`** — mirrors the repo aliases AND shims
  `next/link` + `next/dynamic` to `.design-sync/shims/*`. CRITICAL: without the next/* shims
  the bundle drags Next.js's client runtime (`process.env.__NEXT_*`) in and throws
  `ReferenceError: process is not defined` in the browser → every card blank. EmptySurface is
  the next/link importer. NB: do NOT put a `"//"` comment key in the sync tsconfig — the path
  plugin's comment-stripper corrupts it and silently disables ALL path resolution.
- Props: the DS ships no `.d.ts`, so ts-morph extraction yields empty `{[key]:unknown}`.
  Real contracts are hand-authored in `cfg.dtsPropsFor` (25 entries) — keep them in sync with
  the components' real props when a prop is added/changed.

## Known render warns (triaged — re-syncs: these are EXPECTED, not new)
- `[TOKENS_MISSING] --p-color, --pc, --cy-bucket, --ct-space-5_5, --ct-bc-warning, --ct-bg-soft,
  --ct-border-muted, --ct-font-mono` — these are referenced inside cockpit.css's own rules and
  are **undefined in the app too** (pre-existing token gaps); NONE are referenced by the 25
  synced components. The DS pane faithfully matches the app (var falls back). Non-blocking; do
  NOT "fix" by defining them — that would diverge the DS pane from the live app.
- `[FONT_MISSING] Inter / SF Pro Display` — these are the *superseded base layer* font stack in
  `cockpit-shell/tokens.css` (layer `cockpit`, lowest). The app overrides with
  `--font-sans: "Satoshi Variable"` (globals.css) which wins, so the app + DS pane both render
  Satoshi (which DOES ship). Suppressed via `cfg.runtimeFontPrefixes: ["Inter","SF Pro"]`.

## Playwright / render check
- Install browsers with the repo's pinned binary: `node_modules/.bin/playwright install chromium`
  (NOT `npx playwright` — it fetched a mismatched version and left the cache empty).
- `package-validate.mjs` imports `playwright`; install `playwright@1.60.0` into `.ds-sync/`
  (matches repo `@playwright/test@1.60.0` + the cached chromium build).

## Preview authoring learnings (fan-out 2026-06-25 — all 25 graded good first pass)
- Import every component (incl. secondary exports `CardHeader`/`CardTitle`/`ChoiceGroup`/`MetricGrid`/
  `DataRow`/`ProofRow`/`NestedPanel`/`PanelStatusSection`/`PanelStatusAccent`/`SkeletonCard`) from
  `"hearst-connect"` directly — they all resolve to `window.HearstDS`. No subpath imports.
- **Width-bound surfaces**: `Card`, `NestedPanel`, `Progress`, `PresetPicker`, `DashboardPanelHeader`,
  `WizardStepProgress` need an explicit width wrapper (`<div style={{width:"320–520px"}}>`) or they stretch
  to the frame / collapse. The dark `__DsFrame` is auto-applied — previews must NOT set their own background.
- Nesting pattern: `DataRow`/`ProofRow` live inside `<NestedPanel>` inside a `material="flat"` `<Card>`
  (flat parent avoids glass-on-glass). `DataRow` and `ProofRow` are intentionally identical chrome —
  differentiate by content/intent only.
- `Badge` `accent` and `brand` variants are visually identical neutral pills (same source classes) — expected.
- Overlays (`Modal`, `ConfirmDialog`) use `cfg.overrides.<Name> = {cardMode:"single", viewport:"WxH"}` and
  must render the OPEN state (they return null when closed). `Tooltip` is hover-only — static card shows the
  trigger; the floating content can't render statically (known-thin, not a failure).
- `cfg.dtsPropsFor` matched the real source signatures exactly and was the fastest prop reference for authors.

## Re-sync risks (what can silently go stale)
- **dtsPropsFor drift**: hand-authored contracts won't auto-update if a component's props change
  upstream. On re-sync, spot-check a few `ui/` props against `cfg.dtsPropsFor`.
- **next/* shims**: if a newly-scoped component imports another `next/*` (next/image, next/navigation…),
  add a shim + a `tsconfig.sync.json` path, or the bundle breaks the same way.
- **Tailwind foundation breadth**: `tw-entry.css` scans `src/components/**` + `.design-sync/previews/*`.
  A class used only in a brand-new preview needs a foundation recompile (buildCmd) before it's styled.
- **Satoshi font path**: build-foundation rewrites `/fonts/` → `../public/fonts/`; if the woff2 moves
  out of `public/fonts/`, update the rewrite.
