# PROJECT_STATE.md — Hearst DeFi (hearst-defi)

> Instantané pris le 2026-07-02 par le batch Intake (batch 1/9).
> Source de vérité : `docs/BACKLOG.md`, `docs/PROGRAM_MASTER.md`, `docs/execution/agent-e-sprint-correctness.md`, code source (read-only).

---

## 1. État du dépôt

| Champ | Valeur |
|---|---|
| Branche courante | `main` |
| Commits devant origin/main | 1 (`e31c1706` nexus base loop — fichiers CI/nexus uniquement, pas de code applicatif) |
| Working tree | propre (`git status` = clean) |
| PR ouverte touchant le code | #146 (purge-css-final, DRAFT/PARKED — ne pas toucher) |
| Lock file stale possible | `feat/kimi-deterministic-intent-router-v2` dans `agent-file-locks.md` (Kimi retiré per ADR-011 — à confirmer et libérer) |

---

## 2. Baseline de santé

| Validation | État | Notes |
|---|---|---|
| `pnpm typecheck` | ✅ **0 erreur** (vérifié 2026-07-03, batch Stabilization) | `tsc --noEmit` clean sur `main` + working tree de ce batch |
| `pnpm test` (Vitest) | ✅ **5323/5323, 448/448 fichiers** (vérifié 2026-07-03, batch Stabilization) | Baseline verte confirmée — 9 fichiers rouges trouvés et corrigés cette session (voir HANDOFF batch Stabilization) |
| `forge test` (Foundry) | Dernière vérité = 73/73 (2026-05-29) — gel contrat @ `898991c` intact | Non ré-exécuté ce batch (hors owner zone TS/test) |
| `pnpm build` | **INCONNU** | Non exécuté ce batch |
| `pnpm run lint` (ESLint) | ✅ **0 erreur**, 46 warnings pré-existants (advisory, non bloquant — `eslint src \|\| true`) | Non touché ce batch (warnings hors scope "rouge") |
| Playwright E2E | `continue-on-error: true` — **jamais bloquant en CI** | Non exécuté ce batch |

> **Batch 2 (baseline verification) satisfait** par le batch Stabilization du 2026-07-03 : `pnpm typecheck` + `pnpm test` sont désormais verts et vérifiés en exécution réelle (les permissions runner qui bloquaient batch 2/2b/2 rerun ne bloquaient plus cette session).
>
> **Re-confirmé sur checkout vierge (batch série 4/9, 2026-07-03)** : `pnpm install` +
> `pnpm db:generate` + `pnpm db:push` (schéma sqlite, `dev.db` local à 0 octet sur ce
> runner, gitignored) requis avant les 3 validations sur un environnement neuf — une fois
> fait, `pnpm typecheck` (0 erreur), `pnpm test` (448/448, 5323/5323) et `pnpm run lint`
> (0 erreur, 46 warnings pré-existants) confirmés verts sans aucun changement de code.

---

## 3. Schéma Prisma

| Champ | Valeur |
|---|---|
| Modèles | 65 (VaultSnapshot → StrategyProjectionEvent) |
| Lignes schema.prisma | 1 426 |
| Provider cible | PostgreSQL (prod Supabase) / SQLite (local dev) |
| État dev.db | **DRIFTÉE** — manque contraintes uniques (`Distribution[period,vaultRef]`, `InvestorTransaction[txHash]`, `Position[txHashOpen]`) + index (`UserAgentProfile`, `VaultDraft`) → `db push` bloqué sans `--accept-data-loss` |
| Migrations Prisma | Stale — workflow officiel = `db push` (sans historique) |

---

## 4. Routes & Modules

### Pages applicatives (product)
- **Onboarding** : accreditation, identity, wallet, racine (`/onboarding`)
- **Portfolio** : racine, positions, activité, distributions, tax, yield, `[positionId]`
- **Vaults** : liste, `[id]`, invest, invest/confirmed
- **Proof Center** : racine, full
- **Profile**

### Pages admin (~25 routes)
agents, agent-canvas, agentic, audit, chart-gallery, customers `[id]`, dashboard, design-system, diagnostics, distributions, feedback, governance (+ allowlist, proposal `[id]`, propose), investor-memo, marketplace, monitoring, onboarding-test, outreach (+ compose, prospects, `[campaignId]`), product-workspace (+ report/print), products/btc-mining-performance-vault, projection (+ preview), proof-center (+ full), proofs, roadmap, scenario-lab, security, signals, source, spec, strategies `[slug]`, vaults (new, `[id]`, `[id]/edit`).

### Routes API (37 routes)
Auth, cockpit-chat, cockpit-chats, agent-canvas, search, health/deep, inngest, webhooks (docusign, hubspot, resend, sumsub, typeform), outreach (inbound, unsubscribe), admin (agentic/projection, registry, simulate, simulations, agents/graph, chat-tools, diagnostics/*, product-construction/stream, review-document, review-mode), docs/methodology.

### Modules lib principaux
`engine/` (15 fichiers — pure TS, déterministe), `agents/` (outreach, narrative, risk, memo, mémoire), `agentic/` (intent-router, swarm, reporting, observability, system-map, tool-boundary, action-readiness, control-center, crew-simulation, product-projection), `llm/` (openai, chat, output-guard, nav), `swarms/` (client MySwarms, flag OFF), `product-strategies/` (nouveau — strategies hub), et domaines métier (onchain, governance, distribution, outreach, email, etc.).

---

## 5. Corrections Sprint (agent-e-sprint-correctness.md) — Statut par item

> Mis à jour : 2026-07-03 (batch 2 — Truth Audit, vérification code par grep ciblé).

| ID | Description | Statut observé |
|---|---|---|
| **C-01** | Gate KYC sur dépôt | ✅ FAIT — `kycStatus !== "approved"` à `subscribe.ts:49,81` |
| **C-02** | Alias env vault (HEARST_YIELD / HEARST) | ✅ FAIT — double alias dans `vault.ts:59-60,76-77` |
| **C-03** | Share class réelle dans widgets portfolio | ✅ CONFIRMÉ FAIT — `loadDistribCalendarProps()` lit `terms.shareClass` depuis DB ; `LockMeter` reçoit `softLockupDays` depuis `vaultDeployment` |
| **C-04** | Fees défaut Prisma 2 %→1 % | ✅ FAIT — `mgmtFeeBps @default(100)` ligne 459 |
| **C-05** | Tax preview off (chiffres inventés) | ⚠️ PARTIEL (2026-07-03, batch Data Truth) — `tax-docs-drawer.tsx` (fichier cité par le sprint) n'existe plus, remplacé par `portfolio/tax/page.tsx` qui passe déjà les 3 montants réels à `getTaxPreview()`. Gap de provenance comblé (`dataSource: "live"|"stub"` ajouté + guard régression). Reste à trancher batch 3 : besoin produit résiduel sur la page actuelle ? Voir `DECISIONS.md` détail T-01. |
| **C-06** | APY range PDF lu depuis bps | ✅ FAIT — `targetApyLowBps ?? 940` et `formatApyRange` à `route.tsx:60,396,747` |
| **C-07** | Règle Model B dans prompt investor-memo | ✅ FAIT — ligne 140 `investor-memo.ts` |
| **C-08** | Persistance accreditation attest | ✅ CONFIRMÉ FAIT — `attestAccreditation()` existe dans `app/actions/accreditation.ts:28` et câblée dans `accreditation-attestations.tsx:68` |
| **C-09** | MFA TOTP admin câblé | ✅ CONFIRMÉ FAIT — flow 3 étapes complet : `TotpEnrolmentClient`, `startEnrolment`/`confirmEnrolment` wired, QR + `otpauth` en place |
| **C-10** | CSP connect-src resserré | ✅ PARTIEL — `connect-src` restreint (`connectHosts`) ; `script-src 'unsafe-inline' 'unsafe-eval'` toujours présent |
| **C-11** | Cookie sameSite "lax"→"strict" | ❌ CONFIRMÉ OUVERT — `session.ts:154` encore `"lax"` (ligne 200 = cookie différent — `"strict"` là n'est pas le cookie principal) |
| **C-12** | Flow reset password (Resend) | ✅ CONFIRMÉ FAIT — `password-reset.ts` complet : Resend REST direct, anti-enumeration, single-use token, révocation sessions |
| **C-13** | Model B one-liner LP (vaults detail) | ❌ CONFIRMÉ MANQUANT — grep exhaustif : aucune occurrence de "principal held in a USDC cash reserve" ou équivalent Model B sur la surface LP `vaults/[id]/page.tsx` et composants term-sheet |
| **C-14** | Playwright CI bloquant | ❌ NON FAIT — `continue-on-error: true` à `ci.yml:137` |

**Résumé C-items :** 9 faits ✅, 2 non faits ❌, 2 partiels ⚠️ (batch Data Truth 2026-07-03 : C-05 passé de ❌ à ⚠️) — vs 6/2/5 au batch 1.

---

## 6. Bugs BACKLOG (Lot 1 — fixes sûrs sans schéma)

| # | Item | Statut |
|---|---|---|
| 1 | Search href `/admin/governance/${r.proposalId}` | ✅ CORRIGÉ — `indexer.ts:284` : `/admin/governance/proposal/${r.proposalId}` |
| 2 | NavSparkline label "Monte Carlo" trompeur | ⚠️ À VÉRIFIER |
| 3 | Command registry `nav-governance` href | ✅ OK — `commands.ts:122` = `/admin/governance` (correct) |

---

## 7. Risques Ouverts (PROGRAM_MASTER §8)

| ID | Risque | Sévérité | État |
|---|---|---|---|
| RP-1 | Distribution mock `0xMOCK_` — pas de transfert USDC réel | **Critique** | Ouvert — décision D7 non prise |
| RP-2 | Dépôt sans KYC | Critique | ✅ RÉSOLU (C-01) |
| RP-3 | Comm "mining-backed" sans Model B | Élevé | Partiel — C-07 ✅, C-13 ⚠️ |
| RP-4 | NAV sur CoinGecko (Chainlink non appelé) | Élevé (mainnet) | Ouvert — testnet pilote |
| RP-5 | Attestation mining mock (EIP-191, signers vides) | Élevé | Ouvert — vendor non engagé |
| RP-6 | Gouvernance/PoR/exécution simulées | Élevé | Ouvert — Safe non déployé |
| RP-7 | Fees défaut 2 % vs spec 1 % | Moyen | ✅ RÉSOLU (C-04) |
| RP-8 | Env prod manquants (Inngest/Redis/Privy/Persona/DocuSign) | Élevé | Ouvert |
| RP-9 | MFA TOTP admin non câblé ; CSP wildcards | Moyen | Partiel (C-09 ⚠️, C-10 partiel ✅) |
| RP-10 | Mining fleet uptime/hashrate = placeholders codés en dur (`market-data-hourly.ts`, `uptimePct: 98.5`, `deployedHashrate: 182_000`) | Moyen | Partiel — provenance corrigée en `estimated` côté agent Mining Health (T-13, 2026-07-04, `loaders/mining.ts`) ET côté Investor Memo PDF (T-14, 2026-07-04, `pdf/memo-pages/mining-health.tsx`) ; vraie source d'uptime/hashrate toujours absente, pas un risque légal (chiffre flaggé, plus jamais présenté comme attesté sur les 2 surfaces connues) |
| RP-11 | Investor Memo PDF (AUM/APY/risk score) pouvait badger "attested" un `VaultSnapshot` seed/preset (`source: "daily-seed"`/`"computed"`) sur la seule fraîcheur de `takenAt`, sans vérifier `source` | Élevé | ✅ RÉSOLU (T-15, 2026-07-04, `loaders/vault.ts` — `isLiveTimelineSource()` désormais requis avant `attested`/`stale`, sinon `estimated`) |

---

## 8. Décisions Exécutives (PROGRAM_MASTER §9) — Statut

| Décision | Statut |
|---|---|
| D1 — Signataires Safe 3/5 + guardian 2/3 | ❌ À exécuter |
| D2 — Counsel Maples | ❌ À exécuter |
| D3 — Lever gel app-code (sprint correctness) | ✅ Validé |
| D4 — Engagement Spearbit (NDA + scope) | ❌ À exécuter |
| D5 — Périmètre juridictionnel pilotes | ❌ À exécuter |
| D6 — Model B comme vérité produit V1 | ✅ Validé |
| D7 — Politique distribution V1 (transfer USDC réel) | ❌ À exécuter |

---

## 9. Smart Contracts

| Champ | Valeur |
|---|---|
| Contrats custom | `HearstYieldVault.sol`, `PoRRegistry.sol`, `EventLogger.sol` |
| Freeze SHA | `898991c` (intact — gel contrat Spearbit) |
| OZ version | v5.6.1 @ `5fd1781b` |
| Forge tests | 73/73 (dernière vérité 2026-05-29) |
| Instance testnet | `0xEc733c6dbD69F862489a9Da01338aA5D39C1F60d` — **PRÉDATE le guardian (5 args)** → à redéployer |
| Safe/Timelock | Non déployés |
| Mainnet | NO-GO ferme (gate audit Spearbit + remédiation — ADR-006) |

---

## 10. Architecture Agentic — Évolution (ADR-018)

| Champ | Valeur |
|---|---|
| ADR-018 | Accepté 2026-06-24 — migration vers Swarms/Crew (MySwarms crewai-engine externe) |
| Swarms integration | Scaffoldé (`src/lib/swarms/`, `SWARMS_ENGINE` flag, **default OFF**) |
| Intent router | Migré vers déterministe (regex/règles, pas LLM) |
| Navigation | Déterministe (nav LLM retiré) |
| Lock stale | `feat/kimi-deterministic-intent-router-v2` dans `agent-file-locks.md` — Kimi retiré per ADR-011 ; lock probablement à libérer |

---

## 11. Features Intentionnellement Non Câblées (Lot 5 BACKLOG — NE PAS TOUCHER)

Ces features ont un code existant mais **non monté** par décision Adrien (2026-06-10, "plus tard") :

- ⌘K command palette (`src/lib/power/commands.ts` — registre OK, composant UI absent)
- Batch actions multi-select
- Keyboard shortcuts cheatsheet
- Global search ⌘/ (`GlobalSearch`, `/api/search` — non montés)
- Notifications bell feed (bell non montée, backend 0 consommateur)
- Saved views 8 templates (non montées)

---

## 12. Strategies Hub (nouveau — ajouté post-BACKLOG)

Module `src/lib/product-strategies/` + `src/app/admin/strategies/` ajouté lors du sprint strategies (PR #350-358 mergées fin juin). Comprend :
- Hub, Studio, Data Lab (redesign)
- Create flow short-flow
- Collateral rebalancing engine + studio
- Allocation advisor studio

**Status** : mergé dans main. Tests à vérifier. `StrategyConfig`, `StrategyScenario`, `StrategyCollateralConfig`, `StrategyRebalancingRule`, `StrategyProjectionRun`, `StrategyProjectionSnapshot`, `StrategyProjectionEvent` ajoutés au schéma.

---

*Mis à jour : 2026-07-04 (batch série 5/9, 3e fix réel T-15 — RP-11 ajouté). Prochain refresh : batch 3.*
