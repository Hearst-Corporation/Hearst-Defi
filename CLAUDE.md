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

- Canon : `src/components/catalyst/` + tokens `--ct-*` (`src/app/cockpit.css`). `src/components/ui/` = legacy shims.
- **Un seul accent : vert `#A7FB90`. Un seul vert, zéro rouge.** Absent/négatif = gris. Aucune classe `dark:` (dark-only).
- **Charts : Recharts uniquement** (`catalyst/chart*`), gardé par `pnpm ds:guard:chart-engine`. HIS/Chart.js retirés — ne jamais réintroduire.
- Storybook : `pnpm storybook` (port 6106) — référence exécutable ; a11y bloquante via test-storybook.
- **Typo admin (règle)** : H1 = `AdminPageHeader` UNIQUEMENT (gardien CI bloque tout `<h1` manuel) ·
  H2 = `Section` du bridge · titres de carte = `AdminSectionCard`. Corps de carte non-table =
  `FORM_SURFACE`/`admin-canon-form-surface` (p-5→p-6) ; tables Catalyst = soudées bord à bord
  (gouttière portée par les cellules). Jamais de heading ni de padding improvisés.

## Gates locales (avant tout commit produit)

- `pnpm typecheck` · `pnpm lint` · `pnpm test-storybook` · `pnpm build`
- DS : `pnpm ds:guard` · `pnpm ds:guard:primitive` (0 hit) · `pnpm ds:guard:convergence` (ne pas aggraver) · `pnpm ds:guard:all`
- Qualité : `pnpm quality` (jscpd + knip, baselines en ratchet) · secrets : gitleaks en pre-commit (auto)
- Tests : `pnpm test` (Vitest, force SQLite) · E2E : `pnpm test:e2e` (CI/headless uniquement)

## Spécifique repo

- Honnêteté des données (doctrine projet) : un champ absent = `unavailable` avec raison, jamais `0`,
  jamais de série fabriquée ; `rpc_error` ≠ `not_deployed`.
- Staging chirurgical : jamais `git add -A` — stager fichier par fichier son propre périmètre.
- Plugins doctrine : marketplace `hearst` (`.claude/settings.json`) — `hearst-core` + `hearst-secops` actifs.
