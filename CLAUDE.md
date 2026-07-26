<!-- BEGIN:deploy-policy -->
PROD_AUTODEPLOY: true — push sur main = déploiement Vercel automatique (app.hearst.app). push ≠ deploy pour tout le reste.
<!-- END:deploy-policy -->

# CLAUDE.md — Hearst Connect (`connect — Hearst Defi`)

> Adapter local du socle global `~/.claude/CLAUDE.md` + de la **gouvernance centrale**
> (voir [AGENTS.md](AGENTS.md) — ordre de lecture obligatoire, pin `.hearst/governance.json`).
> En cas de conflit : instruction d'Adrien > mission > CE fichier > doctrine projet > globale.

## Ce que c'est

Cockpit investisseur B2B de **Hearst Bitcoin Reserve — Series 1** : réserve Bitcoin adossée à la
production minière, issue investisseur = **BTC accumulé livré à maturité** (« Not yield. Bitcoin
inventory. »). Vocabulaire interdit : `yield`, `APY`, `coupon`, `distribution`.

## Stack & environnement

- Next.js 16 (App Router) · React · TypeScript · pnpm · **port dev : 4105** (`pnpm dev`)
- Prisma double provider : dev = SQLite, prod = Supabase Postgres (`PRISMA_PROVIDER`,
  jamais de write prod sans `ALLOW_PROD_WRITES=1`)
- Sentry error-only prod-only · Zod partout · Electron (client desktop)
- **Env serveur : canon = `src/lib/env.ts`** (schéma Zod complet, throw au boot, gardes prod).
  Toute nouvelle variable serveur s'y déclare — jamais de `process.env.X` sauvage.

## Design system

- Canon : `src/components/catalyst/` + **valeurs dans `src/styles/palette.css` (`--hc-*`, SEUL fichier portant un hex)**, exposées à Tailwind par `@theme inline` dans `src/styles/theme.css` (`--color-*`) + rôles typo (`src/styles/typography.css`). `--ct-*` = compat RATCHET DESCENDANT (`src/styles/legacy-bridge.css`) — aucun nouvel usage, chaque shim porte sa cible de migration. `src/app/cockpit.css` + `globals.css` = archives Storybook, JAMAIS rechargées au runtime. `src/components/ui/` = legacy shims.
- **Un seul accent : vert `#A7FB90`. Un seul vert, zéro rouge.** Absent/négatif = gris. Une seule teinte verte (107°), **deux luminances** : `--hc-green-50` (#A7FB90 — remplissages et texte sur sombre) et `--hc-green-700` (#2B6220 — encre sur fond clair ; #A7FB90 sur blanc plafonne à 1,25:1). Ce n'est pas un second vert, c'est la même teinte ramenée au seuil AA.
- **Thème DUAL, piloté par attribut** : `[data-theme="dark"|"light"]` sur `<html>`, posé avant la première peinture par `src/shell/ui-prefs.ts`, persisté en cookie `hc-theme`. Défaut sans cookie = sombre.
- **Aucune classe `dark:` — la règle est MAINTENUE et DURCIE** (elle change de raison). Un composant n'écrit jamais une couleur ni une variante de thème : il écrit un rôle (`bg-surface-card`, `text-muted`, `border-border`). Le basculement est porté par les tokens, jamais par un modificateur dupliqué ni par une classe `dark` figée. Gardé par `src/lib/ds/__tests__/no-dark-class.test.ts` (allowlist vide).
- **Contrat de contraste** : les 3 rangs de texte (`foreground`/`muted`/`subtle`) atteignent AA (≥ 4,5:1) sur les 6 surfaces × 2 thèmes ; `--color-faint` est **NON-TEXTUEL** (filets, points, désactivé — ≥ 3:1), jamais pour du texte. Calculé et vérifié par `src/lib/ds/__tests__/theme-contrast-contract.test.ts` (CI).
- **Charts : Recharts uniquement** (`catalyst/chart*`), gardé par `pnpm ds:guard:chart-engine`. HIS/Chart.js retirés — ne jamais réintroduire.
- Storybook : `pnpm storybook` (port 6106) — référence exécutable ; a11y bloquante via test-storybook.
- **Typo admin (règle)** : H1 = `AdminPageHeader` UNIQUEMENT (gardien CI bloque tout `<h1` manuel) ·
  H2 = `Section` du bridge · titres de carte = `AdminSectionCard`. Corps de carte non-table =
  `FORM_SURFACE`/`admin-canon-form-surface` (p-5→p-6) ; tables Catalyst = soudées bord à bord
  (gouttière portée par les cellules). Jamais de heading ni de padding improvisés.

## Gates locales (avant tout commit produit)

- Honnêteté admin : `pnpm gate:admin` (ratchet vs `scripts/admin-honesty-baseline.json` ; `--strict` = zéro tolérance ; `--update` après une réduction délibérée, jamais pour absorber une hausse) — armé en CI via `scripts/__tests__/admin-honesty-gate.test.mjs` (job vitest, bloquant) · `pnpm check` = gate:admin → typecheck → lint → quality → test.
- `pnpm typecheck` · `pnpm lint` · `pnpm test-storybook` · `pnpm build`
- DS : `pnpm ds:guard` · `pnpm ds:guard:primitive` (0 hit) · `pnpm ds:guard:convergence` (ne pas aggraver) · `pnpm ds:guard:all`
- Qualité : `pnpm quality` (jscpd + knip, baselines en ratchet) · secrets : gitleaks en pre-commit (auto)
- Tests : `pnpm test` (Vitest, force SQLite) · E2E : `pnpm test:e2e` (CI/headless uniquement)

## Spécifique repo

- Honnêteté des données (doctrine projet) : un champ absent = `unavailable` avec raison, jamais `0`,
  jamais de série fabriquée ; `rpc_error` ≠ `not_deployed`.
- Staging chirurgical : jamais `git add -A` — stager fichier par fichier son propre périmètre.
- Plugins doctrine : marketplace `hearst` (`.claude/settings.json`) — `hearst-core` + `hearst-secops` actifs.
