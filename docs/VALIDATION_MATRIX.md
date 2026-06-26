# VALIDATION_MATRIX — tâche → validation minimale

But : ne pas lancer un build complet pour chaque petite tâche. Cibler. `pnpm build` est lent et
rarement nécessaire en dev.

| Type de tâche | Validation minimale | Validation complète (avant gros merge) |
|---|---|---|
| UI / CSS / composant | Lire **`docs/PORTFOLIO_LAYOUT_REFERENCE.md`** si shell/portfolio/surfaces · `pnpm test <glob composant>` (ex. `pnpm test portfolio`) | `pnpm test` + `pnpm typecheck` |
| Server action / API / data | `pnpm test <glob domaine>` + `pnpm typecheck` | `pnpm test` ; `pnpm build` si route/schéma change |
| Email / outreach | `pnpm test src/lib/email` | `pnpm test` (jamais d'envoi réel) |
| Agent / chat / tools | `pnpm test src/lib/llm` | `pnpm test` |
| Engine (pur) | `pnpm test src/lib/engine` | idem |
| Erreur de build | `pnpm typecheck` (cible le fichier) | `pnpm build` une fois résolu |
| Smart contracts | `pnpm sc:forge-test` (si touché) | `forge build` + tests |

## Commandes réelles (package.json)
- `pnpm test` = `vitest run` (~2171 tests). Cibler : `pnpm test <motif chemin/fichier>`.
- `pnpm typecheck` = `tsc --noEmit`.
- `pnpm lint` = `eslint src` (advisory — ne pas s'y fier comme gate bloquant).
- `pnpm build` = prisma generate + `next build` (lent).
- `pnpm test:e2e` = Playwright (lourd — seulement si flux UI critique).
- Audits DS (advisory, non bloquants) : `pnpm ds:layout`, `pnpm ds:classes`, `pnpm ds:token-drift`.

## Quand lancer `pnpm build`
Seulement si : une route/`next.config` change, le schéma Prisma change, un import de package change,
ou avant un go-live. **Pas** par réflexe après une édition de composant ou de CSS.

## Quand lancer `tsc --noEmit`
Après toute édition TS/TSX touchant des types, des signatures, ou pour diagnostiquer une erreur de
build sans payer le build complet.
