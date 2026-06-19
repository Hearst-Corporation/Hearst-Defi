# SYSTEM_MAP — modèle mental une-page

Carte du système : couches, auth, data, LLM, on-chain, nav, infra. Lire ce fichier
avant de toucher la logique. UI/CSS → `docs/UI_CONTEXT.md`.

## Couches (le data ne descend QUE vers le bas)

```
┌──────────────────────────────────────────────────────────────────┐
│  UI            Server Components par défaut                        │
│                src/app/**  ·  src/components/**                    │
│                (rend ce que les loaders donnent — zéro I/O métier) │
└──────────────────────────────────────────────────────────────────┘
                              ▲  (données)
┌──────────────────────────────────────────────────────────────────┐
│  LOADERS       server-only — accès DB / agrégation / mapping      │
│                src/lib/agents/loaders/*  ·  src/lib/data/*         │
│                (Prisma, fetch, env vivent ICI)                    │
└──────────────────────────────────────────────────────────────────┘
                              ▲  (appels purs)
┌──────────────────────────────────────────────────────────────────┐
│  ENGINE        PUR — déterministe, seed injecté, AUCUN I/O        │
│                src/lib/engine/*                                    │
│                interdit : prisma, fetch, Date.now(), process.env, │
│                Math.random() non gouverné, import app/components   │
└──────────────────────────────────────────────────────────────────┘
```

L'engine ne remonte jamais ; les loaders n'appellent jamais l'UI ; l'UI ne touche
jamais Prisma directement.

## Auth (deux niveaux, le serveur fait foi)

| Niveau | Fichier | Voit | Autorité |
|---|---|---|---|
| Edge | `src/proxy.ts` (`proxy`, **pas** `middleware.ts`) | PRÉSENCE du cookie `hc_session` seulement | non — pré-gate |
| Serveur | `src/lib/auth/require-admin.ts`, `require-investor.ts`, `require-auth.ts` | session validée + rôle | **OUI — autorité** |

- Deux listes synchronisées **à la main** dans `proxy.ts` : `PROTECTED_PREFIXES`
  (`/admin /debug /onboarding /portfolio /profile /proof-center /vaults`) **et**
  `config.matcher`. Modifier l'une → modifier l'autre, sinon route non gardée.
- `/admin/*` exige un cookie au edge mais le rôle admin est vérifié **côté serveur** seulement.

## Triade data (ne pas confondre)

| Mode | Source | Badges |
|---|---|---|
| **Live** | DB Prisma via loaders | provenance réelle (Live/Oracle/Attested…) |
| **previewZeros** | investor zéro-position : valeurs à 0 + `PreviewModeChip` | **aucun** badge Live/Verified faux |
| **demo / mock** | `src/lib/demo/*` (`builders.ts`, `provider.ts`, `guard.ts`) | marqués démo |

**6 composants construits-mais-non-câblés = VOULU, pas du code mort** (ne pas /tri) :
GlobalSearch ⌘K, ShortcutsOverlay, NotificationsBell, SavedViewsPicker,
ChartTimeSelector, TimeseriesSection.

## LLM (provider unique)

- **OpenAI GPT-4.1** uniquement (ADR-011, **aucun SDK Anthropic**). Client dans
  `src/lib/llm/openai.ts` — pas de `kimi.ts`, plus aucun export `kimi`/`KIMI_*`
  (alias legacy entièrement retirés).
- Wrapper `callLlm` dans `src/lib/llm/client.ts` : circuit breaker (primary +
  `OPENAI_FALLBACK_MODEL`), observabilité `LlmRun` (coût/latence/erreur).
- **4 agents batch** (sortie Zod, forbidden-words) sous `src/lib/agents/` :
  `scenario-narrative`, `mining-health`, `risk-explanation`, `investor-memo`.
- **Master Agent** (`src/lib/llm/chat-agent.ts`) : navigation read-only (whitelist),
  **zéro** tool write/financial/admin. Gated `CHAT_MASTER_AGENT=1` (ADR-012).

## On-chain (TESTNET uniquement)

- Vault = **Model B** : wrapper ERC-4626 sur du **cash USDC**, yield exogène injecté ;
  le mining n'est PAS on-chain (advisory). `contracts/src/HearstYieldVault.sol`.
- Aussi `EventLogger.sol` + `PoRRegistry.sol`. Déployés **Base Sepolia testnet**.
- **Mainnet gaté sur audit Spearbit + remédiation** (ADR-006) — lever le lock n'autorise
  PAS du code mainnet non audité.
- **Privy = wallet de dépôt USDC, PAS l'auth.** L'auth = cookie `hc_session` (session DB).

## Deux systèmes de nav

| Système | Où | Détail |
|---|---|---|
| Rail shell | `cockpit-shell` `CockpitShell` | chrome global Cockpit |
| Rail intra-app | `src/components/nav/product-rail-intra.tsx` | vertical, **porté sur `document.body`** |

**Source unique des items de nav** : `src/components/nav/product-nav-items.ts`.

## Infra

- **DB prod** : Supabase projet `hearst-connect-prod` (Postgres). Dev = SQLite (`file:./prisma/dev.db`).
- **Storage** : Supabase Storage bucket `reports` (PDF investor-memo).
- **Deploy** : Vercel **auto au push `main`** (intégration Git, **sans gate CI**). Railway = zombie.
- **Jobs/crons** : Inngest.

## STOP
Ne pas toucher l'engine purity, `src/proxy.ts` / shell auth, la CSP, ni réintroduire
un SDK Anthropic ou une 2ᵉ source de nav.
