# AGENTS_CONTEXT — chat, agent runs, registry, tools, action queue

Charger ce fichier + les points d'entrée ci-dessous. Ne pas charger CSS / data portfolio / composants.

## Points d'entrée
- **Chat cockpit (Master Agent / review-mode)** : `src/lib/llm/chat-agent.ts` (652 l.),
  `src/lib/llm/navigate-tool.ts`, `src/lib/llm/nav-channel.ts`, `src/lib/llm/output-guard.ts`,
  `src/lib/llm/chat-context.ts` / `admin-context.ts` / `chat-modes.ts` / `prompts.ts`.
- **Routes** : `src/app/api/cockpit-chat/route.ts` (956 l. — prompt système + streaming + guard),
  `src/app/api/chat-nav/route.ts`, `src/app/api/admin/chat-tools/route.ts`, `admin/review-mode`,
  `admin/review-document`.
- **Tools** : `src/lib/llm/tools/` — `registry.ts` (1287 l.), `policy.ts`, `confirmations.ts`,
  `redaction.ts`, `types.ts`, `index.ts`.
- **4 agents batch** (`src/lib/agents/`) : `scenario-narrative.ts`, `mining-health.ts`,
  `risk-explanation.ts`, `investor-memo.ts` (+ `schemas.ts`, `validators.ts`, `forbidden-words.ts`,
  `apy-range.ts`, `loaders/`, `system-prompts/`, `memory*.ts`).
- **Client LLM** : `src/lib/llm/client.ts` / `openai.ts`. Flag : `CHAT_MASTER_AGENT` (`src/lib/feature-flags.ts`).

## Quoi est quoi
- **UI** : composants chat (`src/components/chat/`, `admin/admin-chat-controls.tsx`) — présentation/state.
- **Backend / orchestration** : `src/lib/llm/*`, `src/lib/agents/*` — prompts, tools, validation.
- **Backend-first** : toute logique métier (calcul, mutation) vit en server action / engine, **pas** dans
  un tool ni dans l'agent. Le tool appelle le backend ; il ne réimplémente pas la règle.

## Règles de sécurité
- Provider unique = **OpenAI GPT-4.1** (ADR-011). Pas de SDK Anthropic ici. Exports `kimi`/`KIMI_*`
  pointent OpenAI — ne pas renommer / "réparer".
- Sorties **structurées**, Zod-validées. **Mots interdits** : guarantee, promise, certain, will
  deliver, risk-free. APY toujours en range.
- Chat = **read-only** : navigation sur whitelist de routes, **aucun** outil write/financier/admin.
  Human-in-the-loop (ADR-012). System prompt serveur non surchargeable client ; output-guard actif.
- Ne pas ouvrir la whitelist de navigation ni ajouter un outil d'exécution sans accord.

## Validation
`pnpm test src/lib/llm` (et `src/lib/agents/__tests__` si touché).

## STOP
Aucun appel API Anthropic (crédits) sans demande. Aucun nouvel outil write/exécution. Aucune levée
de garde-fou compliance.
