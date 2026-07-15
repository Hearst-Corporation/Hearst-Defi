import "server-only";

import { z } from "zod";

import {
  MIN_TICKET_USDC_ENV_SCHEMA,
  readMinTicketOverride,
} from "@/lib/vaults/min-ticket";

/**
 * Server-side environment validation.
 *
 * Every variable consumed by the server MUST be declared here. The module
 * crashes at import time if a required variable is missing or malformed,
 * preventing silent runtime failures.
 *
 * NEXT_PUBLIC_* variables are NOT validated here — they are build-time
 * injected by Next.js and may be read from the client bundle. Keep secrets
 * out of them.
 */

/**
 * EVM address validator: 0x-prefixed, exactly 40 hex chars. Rejects typos and
 * truncated addresses at boot instead of letting a malformed value flow into a
 * `writeContract`/`readContract` call where it would fail opaquely at runtime.
 * Format-only (no EIP-55 checksum here — case-insensitive); the checksum
 * tightening lives in `src/lib/chain/client.ts` where viem's helpers are wired.
 */
const evmAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 40-hex EVM address");

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Privy — reserved for the USDC subscription/payment flow (wallet connect at
  // deposit time), NOT for authentication. Optional everywhere: the app boots
  // and authenticates (email/password) without it.
  PRIVY_APP_SECRET: z.string().optional(),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().optional(),
  NEXT_PUBLIC_CHAIN_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_EVENT_LOGGER_ADDRESS: z.string().optional(),
  NEXT_PUBLIC_POR_REGISTRY_ADDRESS: z.string().optional(),
  // ERC-4626 Hearst Yield Vault address on Base Sepolia. Public — safe in the
  // client bundle. When unset, the invest flow surfaces a "Configuration en
  // attente" state and blocks transactions rather than silently failing.
  //
  // Two names are accepted, in this precedence order (mirrors
  // src/lib/onchain/vault.ts `resolveVaultAddress`):
  //   1. NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS  ← canonical, validated below
  //   2. NEXT_PUBLIC_HEARST_VAULT_ADDRESS        ← legacy alias, kept for compat
  // Both are validated as 0x-prefixed 40-hex addresses when present. We never
  // accept a malformed value silently — a typo'd address fails the parse and
  // the module throws at boot (outside test mode).
  NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS: evmAddress.optional(),
  NEXT_PUBLIC_HEARST_VAULT_ADDRESS: evmAddress.optional(),
  // PermissionedDynaVault v2.1 address on Base Sepolia — the REPLACEMENT for the
  // two vault addresses above. Public (client bundle), optional: the contract is
  // not deployed yet, so this is unset everywhere today.
  //
  // It is the mode switch of the chain adapter (src/lib/chain/dynavault.ts):
  //   set + well-formed → mode "v2"     (full v2.1 surface readable)
  //   unset             → mode "legacy" (falls back on the two names above; only
  //                                      the common ERC-4626 subset is readable,
  //                                      everything else is honestly unavailable)
  // Validated here so a typo is a loud boot failure server-side: the adapter
  // itself must ignore a malformed value (it runs in the browser, where throwing
  // would white-screen the page), so THIS is the gate that catches it.
  NEXT_PUBLIC_DYNAVAULT_ADDRESS: evmAddress.optional(),
  // ── Applicative minimum ticket, in whole USDC (the asset is USDC, 6 dp) ───
  //
  // OVERRIDE, not a value: when unset, the canonical base applies unchanged —
  // the share-class preset (Class A: 250_000) on the validation side, and each
  // vault's own `VaultDeployment.minTicketUsdc` column on the data side. That
  // is why it is `.optional()` and NOT `.default(250_000)`: a default here
  // would flatten every vault's configured minimum onto 250_000 and silently
  // change the behaviour of a deployment that never set this var.
  //
  // Resolution + precedence live in ONE place, src/lib/vaults/min-ticket.ts,
  // which owns the schema below. Both the data layer (what the invest form
  // shows and gates on) and `validateMinTicket` (what the server enforces after
  // the on-chain deposit settles) read through it, so they can never disagree.
  //
  // Server-only on purpose — NOT NEXT_PUBLIC_. The invest form is a client
  // component but receives the already-resolved `vault.minTicketUsdc` as a prop
  // from a Server Component, so the browser never needs to read this.
  //
  // `.catch(undefined)` = a malformed value is treated as absent, which RAISES
  // the floor back to the product default rather than lowering it, and never
  // 500s every route in production over one bad string (same contract as
  // NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE below). `.positive()` additionally makes
  // "0" unusable, so a misconfiguration can never yield a 0 USDC floor.
  MIN_TICKET_USDC: MIN_TICKET_USDC_ENV_SCHEMA.optional().catch(undefined),
  // DEPRECATED legacy alias of MIN_TICKET_USDC, lower precedence. It used to be
  // inert in production (`NODE_ENV !== "production"` gate); it is now honored in
  // every environment like any other override. Declared here so it is validated
  // and documented rather than read as an undeclared stray var. The production
  // guard below warns when it is the one setting the floor — a `DEMO_`-prefixed
  // name driving a real money floor should be visible, not silent.
  DEMO_MIN_TICKET_USDC: MIN_TICKET_USDC_ENV_SCHEMA.optional().catch(undefined),
  // Optional deploy-block hints so `eth_getLogs` can use a finite range instead
  // of scanning from genesis (Alchemy free tier caps the window at ~10 blocks).
  // See P1-4 audit. When unset, the loaders fall back to a 10-block tail of
  // `latestBlock` so dev stops crashing — historic events will be missing until
  // the deploy block is configured.
  NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK: z.coerce.number().int().nonnegative().optional(),
  NEXT_PUBLIC_POR_REGISTRY_DEPLOY_BLOCK: z.coerce.number().int().nonnegative().optional(),
  // Blocks per `getLogs`/`getContractEvents` window when paginating from
  // deployBlock to head (free-tier RPC providers cap the range per call —
  // measured 2k-100k depending on provider). Optional: defaults to 100,000
  // (clamped [100, 500,000] in src/lib/chain/get-logs-chunked.ts) when unset
  // or out of range. `.catch(undefined)` makes this field NEVER throw at
  // boot: an invalid raw value (empty string, "0", a negative or non-integer
  // number) falls back to `undefined` — same as if the var were absent —
  // instead of failing the whole server-env parse (a known incident class:
  // one malformed optional var must not 500 every route in production).
  // `resolveChunkSize()` then applies the 100,000 default for `undefined`
  // and clamps any in-range-but-extreme numeric value.
  NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .catch(undefined),
  // Chainlink BTC/USD aggregator override. When unset, the BTC price loader
  // falls back to the canonical Ethereum mainnet address
  // (0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c). Override only if the RPC
  // points at a chain that hosts a different aggregator address.
  NEXT_PUBLIC_CHAINLINK_BTC_USD_ADDRESS: z.string().optional(),
  // Ethereum-mainnet RPC used ONLY to read the Chainlink BTC/USD aggregator
  // (the aggregator lives on mainnet, so it cannot be read over the app's
  // Base-Sepolia NEXT_PUBLIC_CHAIN_RPC_URL). Server-only (may embed an API key),
  // so NOT NEXT_PUBLIC_. When unset, the BTC loader skips the oracle and serves
  // CoinGecko `live` — provenance is honest either way.
  CHAINLINK_RPC_URL: z.string().url().optional(),
  // ── DeFi market-data loaders (free, no-key) ──────────────────────────────
  // Ethereum-mainnet RPC used to read Chainlink stablecoin USD aggregators
  // (USDC/USDT/DAI) for src/lib/data/stablecoin-prices.ts. Canonical name;
  // when unset, that loader also honors CHAINLINK_RPC_URL (above) so a single
  // mainnet RPC powers every on-chain oracle read. When NEITHER is set, the
  // stablecoin loader skips Chainlink and serves the DefiLlama aggregated price
  // (`live`) — provenance stays honest (never falsely "oracle"). Free public
  // RPCs work (e.g. https://eth.llamarpc.com). Server-only (may embed a key).
  ETH_RPC_URL: z.string().url().optional(),
  // Binance spot REST base URL override (src/lib/data/binance-price.ts).
  // Defaults to the read-only market-data mirror https://data-api.binance.vision.
  // Override for tests or a self-hosted proxy. No key — public market data.
  BINANCE_API_BASE_URL: z.string().url().optional(),
  // DefiLlama base-URL overrides (all free, no key). When unset, each loader
  // uses its public default. `DEFILLAMA_BASE_URL` is the broad fallback honored
  // by the yields + tvl loaders; the specific names take precedence.
  //   - yields  → https://yields.llama.fi   (lending-yields.ts)
  //   - tvl     → https://api.llama.fi       (protocol-tvl.ts)
  //   - coins   → https://coins.llama.fi     (stablecoin-prices.ts)
  DEFILLAMA_YIELDS_BASE_URL: z.string().url().optional(),
  DEFILLAMA_TVL_BASE_URL: z.string().url().optional(),
  DEFILLAMA_COINS_BASE_URL: z.string().url().optional(),
  // Mining energy cost override (USD per kWh). When unset, the loader falls
  // back to the industry default 0.05 USD/kWh and surfaces a `Manual`
  // provenance badge. Methodology v3.0 promises a partner-attested feed
  // (out-of-scope for the current cluster); this env var is the bridge.
  MINING_ENERGY_COST_USD_PER_KWH: z.coerce.number().positive().optional(),
  // Hearst's mining revenue-share, in basis points (e.g. 4000 = 40%). The
  // distribution-coverage engine needs it to size net mining cash. No on-chain
  // source yet; this env var is the manual bridge (provenance stays Estimated
  // until a partner-attested feed lands). When unset, coverage is Pending —
  // never fabricated. 0–10000.
  MINING_REVENUE_SHARE_BPS: z.coerce.number().int().min(0).max(10000).optional(),
  // Telegram MTProto (machine-price ingestion from Letine et al.). ALL optional —
  // when any is absent the /admin/source machine table degrades to "not
  // configured" instead of throwing. api_hash + session are secrets (.env.local
  // only). Generate the session once via `node scripts/telegram-login.mjs`.
  TELEGRAM_API_ID: z.coerce.number().int().positive().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_SESSION: z.string().optional(),
  // Fireblocks custody (Proof-of-Reserves). Optional — when absent, custody data
  // falls back to mock with a `Manual` provenance badge instead of `Live`.
  FIREBLOCKS_API_KEY: z.string().optional(),
  // Preferred in serverless/Vercel: inline PEM content (export the key as a
  // multi-line env var). Takes precedence over FIREBLOCKS_SECRET_KEY_PATH.
  FIREBLOCKS_SECRET_KEY: z.string().optional(),
  // Legacy: absolute path to PEM file. Works locally but is unusable on
  // Vercel/serverless — use FIREBLOCKS_SECRET_KEY instead.
  FIREBLOCKS_SECRET_KEY_PATH: z.string().optional(),
  FIREBLOCKS_BASE_URL: z.string().url().optional(),
  // Comma-separated Fireblocks vault account IDs that constitute the vault's
  // reserves. When empty, the PoR scope is unpinned (configured = false).
  FIREBLOCKS_VAULT_ACCOUNT_IDS: z.string().optional(),
  // Admin provisioning — comma-separated emails seeded as role=admin, plus the
  // initial password applied to those accounts by `prisma/seed.ts`. Optional;
  // the seed is a no-op when unset.
  ADMIN_EMAILS: z.string().optional(),
  ADMIN_INITIAL_PASSWORD: z.string().optional(),
  ADMIN_ADDRESSES: z.string().optional(),
  HEARST_PUBLISHER: z.string().optional(),
  // Comma-separated default multisig signer addresses; read by admin/projection/actions; validated at boot so a malformed value surfaces early.
  VAULT_DEFAULT_SIGNERS: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  // Resend — transactional email, the one currently-wired notification channel
  // (investor distribution emails today; governance alerts once the dispatcher
  // lands). Optional: when unset, `distribution-executed` and any future
  // dispatcher SKIP email silently — investors are paid but never notified. The
  // production guard below warns loudly when it is missing so a standard deploy
  // doesn't ship with notifications quietly off.
  RESEND_API_KEY: z.string().optional(),
  // Supabase Storage — durable file store for generated artifacts (investor
  // memo PDFs, review documents, attestations). The runtime DB connection goes
  // through DATABASE_URL/Prisma; these vars are ONLY for the Storage REST API.
  //
  // NEXT_PUBLIC_SUPABASE_URL is the project URL (also used by any browser
  // client). SUPABASE_SERVICE_ROLE_KEY is server-only — it bypasses RLS to
  // upload into the private `reports` bucket, so it must NEVER appear in a
  // NEXT_PUBLIC_* var or reach the client bundle. All three optional: when
  // unset, PDF generation still streams the file to the browser for download
  // but skips the durable upload (pdfUrl stays null) instead of crashing.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Bucket name for durable report storage. Defaults to "reports".
  SUPABASE_STORAGE_BUCKET: z.string().default("reports"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  // LLM provider — OpenAI GPT-4.1 (via the `openai` SDK) is the single backend
  // for all four agents AND the cockpit chat. ADR-011 (supersedes ADR-007).
  // Agents are provider-agnostic: they call `callLlm`, which routes to OpenAI.
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1"),
  /** Optional base-URL override (e.g. Azure OpenAI / a proxy). Default: the
   *  real OpenAI endpoint baked into the SDK. */
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_ORG_ID: z.string().optional(),
  /** Optional secondary OpenAI model. When set, callLlm retries on it if the
   *  primary fails all retries OR the circuit breaker opens. e.g. "gpt-4o". */
  OPENAI_FALLBACK_MODEL: z.string().optional(),
  // ── LangSmith observability (LLM tracing) ────────────────────────────────
  // When LANGSMITH_TRACING === "true" AND an API key is present, the OpenAI
  // client (src/lib/llm/openai.ts) is wrapped with `wrapOpenAI` so every LLM
  // call (4 batch agents + cockpit chat) is traced to LangSmith. ALL optional:
  // when unset (default in every env today), the wrap is skipped entirely —
  // zero overhead, zero behavior change, no boot risk. The langsmith SDK also
  // reads LANGSMITH_PROJECT / LANGSMITH_ENDPOINT from process.env directly;
  // they are declared here for validation + documentation.
  LANGSMITH_TRACING: z.string().optional(),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional(),
  LANGSMITH_ENDPOINT: z.string().url().optional(),
  // ── Hugging Face (Inference) ──────────────────────────────────────────────
  // Used by the SEMANTIC compliance guard (zero-shot NLI) as a SECOND screen
  // behind the keyword guard. Two accepted names (HF_TOKEN is the SDK's
  // canonical var; the alias is kept for ops convenience). Both optional: when
  // neither is set, the HF client throws at use-site (never at boot), so the app
  // boots fine without HF — same contract as OPENAI_API_KEY.
  HF_TOKEN: z.string().min(1).optional(),
  HUGGINGFACE_API_KEY: z.string().min(1).optional(),
  /** Zero-shot NLI model for the semantic compliance guard. Multilingual
   *  (FR+EN) — the LP chat is French. Override per deploy if needed. */
  HF_ZEROSHOT_MODEL: z
    .string()
    .min(1)
    .default("MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"),
  /** Semantic compliance guard (paraphrase defense-in-depth behind the keyword
   *  output guard). WIRED into the chat engine (chat-agent.ts) but gated by this
   *  env and OFF by default:
   *    - absent / "0"   → not invoked at all (default; current production state).
   *    - "1" / "shadow" → run, LOG divergences vs the keyword guard, never block.
   *    - "enforce"      → a positive semantic verdict blocks persistence of a
   *                       paraphrased return-promise the keyword guard missed.
   *  Network-bound (HuggingFace zero-shot, see semantic-guard.ts) and FAIL-SAFE:
   *  on HF outage / no token / error it returns null → the keyword guard remains
   *  the hard guarantee, so enabling it can only ADD a block, never relax one. NOT
   *  enabled here — flip to "enforce" in the deployment env to turn it on. */
  SEMANTIC_GUARD: z.enum(["0", "1", "shadow", "enforce"]).optional(),
  // Sentry observability — all optional, project boots without them (no-op fallback)
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  // TOTP at-rest encryption key — AES-256-GCM, 64 hex chars (32 bytes).
  // Optional: the app boots without TOTP. When present, must be exactly
  // 64 lowercase/uppercase hex characters. Missing or malformed → admins
  // with TOTP get locked out at login (crypto-util throws loudly).
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  AUTH_TOTP_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "AUTH_TOTP_KEY must be exactly 64 hex characters (32 bytes)",
    )
    .optional(),
  // Sumsub KYC — API credentials + webhook secret. Server-only (never expose in
  // NEXT_PUBLIC_*). SUMSUB_APP_TOKEN carries the `sbx:` prefix in sandbox.
  // SUMSUB_SECRET_KEY signs API requests; SUMSUB_WEBHOOK_SECRET verifies inbound
  // webhook digests (x-payload-digest). SUMSUB_LEVEL_NAME selects the verification
  // level (defaults to "id-only" — document-only, custom form, no WebSDK/iframe).
  // The webhook secret may be absent in dev — the endpoint fails-closed (401/500)
  // until configured.
  SUMSUB_APP_TOKEN: z.string().optional(),
  SUMSUB_SECRET_KEY: z.string().optional(),
  SUMSUB_WEBHOOK_SECRET: z.string().optional(),
  SUMSUB_LEVEL_NAME: z.string().optional(),
  // DocuSign Connect — HMAC secret for webhook signature verification.
  DOCUSIGN_WEBHOOK_SECRET: z.string().optional(),
  // DocuSign API credentials (server-only — never expose in NEXT_PUBLIC_*).
  DOCUSIGN_API_KEY: z.string().optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  // DocuSign REST base URL (e.g. https://demo.docusign.net/restapi or
  // https://www.docusign.net/restapi). Validated as a URL when present.
  DOCUSIGN_BASE_URL: z.string().url().default("https://demo.docusign.net/restapi"),
  // Crypto Fear & Greed Index — alternative.me base URL override.
  // Defaults to the official endpoint; override in tests or for a self-hosted proxy.
  FEAR_GREED_BASE_URL: z.string().url().default("https://api.alternative.me"),
  // Attestation signer allowlist — comma-separated 0x addresses of attestors
  // authorised to sign Proofs. `verifyStoredAttestation` rejects any signed
  // proof whose recovered signer is not in this list. In production, when
  // this is unset, verification is FAIL-CLOSED (returns
  // `no_allowlist_configured`) — never fail-open. In dev/test, the
  // `ATTESTATION_DEV_ACCEPT_ANY=1` escape hatch bypasses the allowlist so
  // local seeds with the Anvil mock key still verify.
  ATTESTATION_ALLOWED_SIGNERS: z.string().optional(),
  // Dev-only bypass of the attestation signer allowlist. Honored ONLY when
  // `NODE_ENV !== "production"`. Set to `"1"` to accept any valid signature
  // regardless of allowlist membership (used by the seed + integration tests
  // that sign with the mock Anvil key).
  ATTESTATION_DEV_ACCEPT_ANY: z.string().optional(),
  // Typeform — HMAC secret for webhook signature verification (X-Hub-Signature).
  // Required at runtime when the Typeform webhook endpoint is active.
  TYPEFORM_WEBHOOK_SECRET: z.string().optional(),
  // HubSpot — HMAC secret for inbound webhook signature verification.
  // Required at runtime when the HubSpot webhook endpoint is active.
  HUBSPOT_WEBHOOK_SECRET: z.string().optional(),
  // Resend — HMAC secret for inbound webhook signature verification (delivery
  // events, bounces, complaints). Distinct from RESEND_API_KEY (send-side).
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  // ── Outreach engine (B2B lead-gen) ──────────────────────────────────────
  // Apollo.io API key — lead discovery + email enrichment for the outreach
  // sourcer/enricher. Optional: when unset, sourcing is disabled (the Apollo
  // client throws at use-site) but the rest of the outreach module still works.
  APOLLO_API_KEY: z.string().optional(),
  // System-wide autonomy ceiling for the outreach engine. Caps how far the
  // agentic pipeline may act on its own, ON TOP OF the per-lead tier (A/B/C):
  //   SUGGEST — agent drafts only; a human approves every send (test mode).
  //   SEND    — agent may send the first touch (Tier B+); humans own replies.
  //   NURTURE — agent may send + run timed follow-up sequences.
  //   CLOSED  — full closed loop: send, follow up, read replies, qualify.
  // Defaults to SUGGEST: the safe mode. Raising it requires ADR-016 (autonomous
  // sending) to be accepted first.
  OUTREACH_AUTONOMY: z
    .enum(["SUGGEST", "SEND", "NURTURE", "CLOSED"])
    .default("SUGGEST"),
  // Starting daily cold-send cap PER sending domain. Deliverability — not the
  // Resend technical limit — is the real constraint, so the sender never exceeds
  // this in a day. The warm-up curve ramps the effective cap above this floor
  // over the first weeks; this is the day-1 value. Coerced from string env.
  OUTREACH_DAILY_SEND_CAP: z.coerce.number().int().positive().default(30),
  // Router-observability durable retention horizon, in days (best-effort prune on
  // write). Optional: when unset the built-in default (DURABLE_RETENTION_DAYS) is
  // used. Bounded [1, 365] to keep the read-only long-term view sane. Read in
  // src/lib/agentic/observability/db-store.ts — no behavior change when absent.
  OBS_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).optional(),
  // On-chain publisher private key — 0x-prefixed 64-hex (32 bytes, secp256k1).
  // Used server-side to sign attestations / publish on-chain events.
  // Never expose in NEXT_PUBLIC_* vars or the client bundle.
  HEARST_PUBLISHER_PRIVATE_KEY: z
    .string()
    .regex(
      /^0x[0-9a-fA-F]{64}$/,
      "HEARST_PUBLISHER_PRIVATE_KEY must be a 0x-prefixed 64-hex secp256k1 private key",
    )
    .optional(),
  // ── MySwarms / crewai-engine (external agentic orchestration backend) ──────
  // Hearst Connect drives the external CrewAI engine over HTTP (kickoff→poll,
  // Bearer auth). ALL optional: when SWARMS_ENGINE is off (default) these are
  // unused. When on but unset, the prod guard below WARNS (never throws) and the
  // swarm client fails at use-site with a clear EngineError — never a global
  // boot outage. CREWAI_ENGINE_URL defaults to localhost:8000 in the client when
  // absent; the token has no default (min 32 chars only when explicitly set).
  CREWAI_ENGINE_URL: z.string().url().optional(),
  CREWAI_ENGINE_AUTH_TOKEN: z.string().min(32).optional(),
  CREWAI_ENGINE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // Router observability trace retention horizon (days). Non-secret. Optional —
  // defaults to 90 in the retention helper when unset; clamped to a sane range
  // there. Controls best-effort pruning of AgenticRouterDecisionTrace rows.
  ROUTER_TRACE_RETENTION_DAYS: z.coerce.number().int().positive().optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  // In test mode we only warn — many test runners stub env late.
  if (process.env.NODE_ENV !== "test") {
    console.error(
      "❌ Invalid environment variables:\n",
      JSON.stringify(fieldErrors, null, 2),
    );
    throw new Error(
      `Invalid environment variables: ${Object.keys(fieldErrors).join(", ")}`,
    );
  }
}

// Production safety guards — fail fast at runtime, skip during `next build`
// NEXT_PHASE is "phase-production-build" during pnpm build; we only want to
// enforce these at server startup time, not build time.
const IS_RUNTIME_PRODUCTION =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build";

if (IS_RUNTIME_PRODUCTION && parsed.success) {
  const d = parsed.data;
  // NOTE: Privy is NOT required for auth — authentication is database-backed
  // (email/password, `hc_session` cookie). Privy only powers the optional USDC
  // payment/subscription flow, so its absence no longer disables the gate.
  if (!d.INNGEST_SIGNING_KEY) {
    throw new Error(
      "INNGEST_SIGNING_KEY is required in production. " +
        "Without it, /api/inngest accepts unauthenticated requests — anyone can trigger " +
        "background jobs (mining health, investor memo) and rack up LLM costs.",
    );
  }
  if (!d.SUMSUB_WEBHOOK_SECRET) {
    throw new Error(
      "SUMSUB_WEBHOOK_SECRET is required in production. " +
        "Without it, the Sumsub KYC webhook accepts unauthenticated events — " +
        "an attacker can spoof KYC completions and bypass investor onboarding checks.",
    );
  }
  // DocuSign is warn-not-throw (unlike Sumsub KYC which is live): DocuSign may not
  // be provisioned yet in a given production environment. The webhook route already
  // fails-closed at runtime (401 when secret is absent), so a missing secret degrades
  // that endpoint only — not the whole app. A hard throw here would outage the entire
  // server before DocuSign is even configured.
  if (!d.DOCUSIGN_WEBHOOK_SECRET) {
    console.warn(
      "[env] DOCUSIGN_WEBHOOK_SECRET is not set in production — DocuSign webhook will fail-closed at runtime until configured.",
    );
  }
  if (!d.OPENAI_API_KEY) {
    console.error(
      "⚠️  OPENAI_API_KEY is not set. LLM features (agents, investor memo, chat) will " +
        "fail at runtime. Set OPENAI_API_KEY to enable them.",
    );
  }
  if (!d.RESEND_API_KEY) {
    console.error(
      "⚠️  RESEND_API_KEY is not set. Transactional email (investor distribution " +
        "notifications) will be skipped silently — investors are paid but never " +
        "emailed. Set RESEND_API_KEY to enable delivery.",
    );
  }
  // Minimum ticket — WARN only, never throw. A lowered applicative floor is a
  // deliberate, reversible configuration choice, not a boot error. But it is
  // money-facing, so a production runtime must never carry one silently.
  const minTicketOverride = readMinTicketOverride();
  if (minTicketOverride) {
    if (minTicketOverride.source === "DEMO_MIN_TICKET_USDC") {
      console.warn(
        "[env] DEMO_MIN_TICKET_USDC is DEPRECATED and is what currently sets the " +
          `production minimum ticket (${minTicketOverride.usdc} USDC). It is now honored ` +
          "in EVERY environment — it used to be inert in production. Rename it to " +
          "MIN_TICKET_USDC (same value) so a `DEMO_`-prefixed var stops driving a real floor.",
      );
    }
    console.warn(
      `[env] Applicative minimum ticket is overridden to ${minTicketOverride.usdc} USDC ` +
        `(via ${minTicketOverride.source}); the Class A product default is 250000. ` +
        "This floor is APPLICATIVE — the deployed contract does not carry it beyond " +
        "its own minDeposit(). Unset the var to restore the default.",
    );
  }
  // CHAT_MASTER_AGENT kill-switch (ADR-017): read in feature-flags.ts as ON unless
  // the value is the literal "0" (=0 → /api/cockpit-chat returns 503, no fallback).
  // Warn in production when explicitly disabled — never throw.
  if (process.env.CHAT_MASTER_AGENT === "0") {
    console.warn(
      "[env] CHAT_MASTER_AGENT=0 — cockpit chat is disabled (503). Unset or any " +
        "other value keeps the unified runChatAgent engine ON.",
    );
  }
  // MySwarms engine: warn (never throw) when the flag is on but the connection
  // is not provisioned — swarm kickoffs then fail at use-site, not at boot.
  if (process.env.SWARMS_ENGINE === "1") {
    if (!d.CREWAI_ENGINE_URL || !d.CREWAI_ENGINE_AUTH_TOKEN) {
      console.warn(
        "[env] SWARMS_ENGINE=1 but CREWAI_ENGINE_URL / CREWAI_ENGINE_AUTH_TOKEN " +
          "is missing — swarm kickoffs will fail at use-site (EngineError) until " +
          "both are configured.",
      );
    }
  }
  // P0: Redis is REQUIRED in production for distributed rate limiting.
  // Without it, rate limits are per-instance only and can be bypassed
  // by distributing requests across serverless instances.
  if (!d.UPSTASH_REDIS_REST_URL || !d.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production. " +
        "Without Redis, rate limiting is per-instance only and ineffective against " +
        "distributed attacks. Set both variables to enable distributed rate limiting.",
    );
  }
  // On-chain vault address: at least one of the two accepted names must be set
  // in production, otherwise the deposit/redeem flow is dead on arrival (the
  // invest form shows "Configuration pending" and blocks every transaction).
  // Both are format-validated above; here we only assert presence so a missing
  // address is a loud boot failure, not a silent degraded UI.
  if (
    !d.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS &&
    !d.NEXT_PUBLIC_HEARST_VAULT_ADDRESS
  ) {
    throw new Error(
      "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS is required in production. " +
        "Without it, the on-chain deposit/redeem flow is disabled and every " +
        "transaction is blocked. Set NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS " +
        "(or the legacy NEXT_PUBLIC_HEARST_VAULT_ADDRESS) to the deployed vault.",
    );
  }
}

/**
 * Resolves the validated env. In normal cases (`parsed.success === true`) we
 * return `parsed.data`. In `NODE_ENV=test` we tolerate a fallback so test
 * runners that stub env late don't crash this module at import. In any other
 * NODE_ENV, a failed parse throws here — we never silently degrade with an
 * unvalidated `process.env` cast.
 */
function resolveEnv(): ServerEnv {
  if (parsed.success) {
    return parsed.data;
  }

  if (process.env.NODE_ENV === "test") {
    // Re-parse with defaults applied and coerce optional fields to undefined
    // rather than reaching for `as unknown as`. We accept partial env in tests.
    //
    // RISK / WHY THIS FALLBACK EXISTS:
    // Many test runners stub `process.env` *after* this module is first
    // imported (Vitest module graph, jest setup files). A strict parse would
    // crash the whole suite at import time before the stub is applied. So in
    // `NODE_ENV=test` ONLY, we accept a partial env: every field is optional
    // and missing required fields are coerced to "" so callers fail at
    // use-site (clear, local) instead of at module import (opaque, global).
    // This branch is unreachable outside tests — production/dev keep the
    // strict parse + throw below. It is NOT an `as unknown as` cast: the
    // shape is still Zod-validated, just with a relaxed (`.partial()`) schema.
    const lenient = serverEnvSchema.partial().safeParse(process.env);
    if (lenient.success) {
      // `lenient.data` is `Partial<ServerEnv>`; widen it to `ServerEnv` by
      // ensuring required fields fall back to empty strings recognised by
      // downstream code as "missing". DATABASE_URL stays empty so callers
      // that need it will fail early at use-site, not at module import.
      //
      // NOTE: MIN_TICKET_USDC / DEMO_MIN_TICKET_USDC need no entry here — they
      // are `.optional()` (an OVERRIDE, not a defaulted value), so `undefined`
      // is a valid inhabitant of ServerEnv for them. Fields carrying a
      // `.default()` are the ones that must be restored below.
      const data: ServerEnv = {
        ...lenient.data,
        DATABASE_URL: lenient.data.DATABASE_URL ?? "",
        OPENAI_MODEL: lenient.data.OPENAI_MODEL ?? "gpt-4.1",
        DOCUSIGN_BASE_URL: lenient.data.DOCUSIGN_BASE_URL ?? "https://demo.docusign.net/restapi",
        FEAR_GREED_BASE_URL: lenient.data.FEAR_GREED_BASE_URL ?? "https://api.alternative.me",
        SUPABASE_STORAGE_BUCKET: lenient.data.SUPABASE_STORAGE_BUCKET ?? "reports",
        OUTREACH_AUTONOMY: lenient.data.OUTREACH_AUTONOMY ?? "SUGGEST",
        OUTREACH_DAILY_SEND_CAP: lenient.data.OUTREACH_DAILY_SEND_CAP ?? 30,
        CREWAI_ENGINE_TIMEOUT_MS: lenient.data.CREWAI_ENGINE_TIMEOUT_MS ?? 30000,
        HF_ZEROSHOT_MODEL:
          lenient.data.HF_ZEROSHOT_MODEL ??
          "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7",
      };
      return data;
    }
  }

  throw new Error(
    `Invalid environment variables: ${Object.keys(parsed.error.flatten().fieldErrors).join(", ") || "(unknown)"}`,
  );
}

export const env: ServerEnv = resolveEnv();
