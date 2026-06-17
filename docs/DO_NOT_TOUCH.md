# DO_NOT_TOUCH — zones verrouillées

S'arrêter et demander **avant** de modifier l'une de ces zones. Raisons incluses pour éviter les
"réparations" bien intentionnées.

| Zone | Fichiers / portée | Pourquoi |
|---|---|---|
| **Build config** | `next.config.ts` | Root Turbopack épinglé ; casse silencieuse du dev/build. |
| **Auth / gate** | `src/proxy.ts` | Next 16 : `middleware.ts` est **déprécié et ignoré** — le gate vit dans `proxy.ts` (export `proxy`). Régression déjà réintroduite une fois. |
| **Auth / wallet** | `src/lib/auth/**`, Privy config, `login/` | Sessions, rôles, redirections sûres. |
| **CSP / headers** | headers de sécurité | connect-src dérive l'ingest Sentry du DSN ; toute modif casse l'ingest ou ouvre une faille. |
| **Engine pur** | `src/lib/engine/**` | Déterministe, testé, non-négociable : pas de prisma/fetch/Date.now/process.env/I/O. |
| **Data / provenance** | badges Live/Oracle/Attested/…, `output-guard` | Honnêteté des états ; faux Live/Verified interdit. |
| **DB** | `prisma/**`, `db:push`, `db:migrate` | Dev = SQLite, prod = Supabase dédié. Régénérer le client sqlite après migrate prod. |
| **Email réel** | `src/lib/email/send.ts`, campagnes | Envoi = action externe publiante → confirmation explicite. |
| **User creation / publication produit** | onboarding, invites, publish | Effets de bord externes irréversibles. |
| **Déploiement** | Vercel (auto-deploy sur push main, sans gate CI) | Un push main = prod. Le workflow Railway est un zombie à décommissionner, pas le canal prod. |
| **Package scripts** | `package.json` scripts | Hors scope docs ; modif = changement runtime. |

## Conventions verrouillées
- **Pas de cross-project import** depuis `Dev/Projects/hearst-connect` (réf. read-only) — tout recodé ici.
- **Un seul vert** `--ct-accent` `#A7FB90` ; ne pas re-séparer brand/success ; maroon mort.
- Provider LLM = OpenAI GPT-4.1 (ADR-011) ; pas de SDK Anthropic ; exports `kimi`/`KIMI_*` = OpenAI.
- Garde-fous DS **volontairement retirés** (édition libre du DS) — ne pas ré-armer sans accord.
- Features UI non câblées (⌘K search, shortcuts, notifications, saved views, chart time selector,
  timeseries) = à brancher plus tard, **pas du code mort** — exclure de tout `/tri`.
- Routes hors-rail volontaires : `/admin` (Operations cockpit), `governance/simulate-demo` — faux
  positifs d'audit accessibilité, ne pas "réparer".

## STOP global (jamais sans demande explicite)
`git add/commit/push/reset`, force-push, raccourcir README/CLAUDE, refactor de composant,
appel API Anthropic (crédits), contournement d'une permission refusée.
