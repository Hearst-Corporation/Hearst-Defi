import "server-only";

import { z } from "zod";

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
  // Optional deploy-block hints so `eth_getLogs` can use a finite range instead
  // of scanning from genesis (Alchemy free tier caps the window at ~10 blocks).
  // See P1-4 audit. When unset, the loaders fall back to a 10-block tail of
  // `latestBlock` so dev stops crashing — historic events will be missing until
  // the deploy block is configured.
  NEXT_PUBLIC_EVENT_LOGGER_DEPLOY_BLOCK: z.coerce.number().int().nonnegative().optional(),
  NEXT_PUBLIC_POR_REGISTRY_DEPLOY_BLOCK: z.coerce.number().int().nonnegative().optional(),
  // Chainlink BTC/USD aggregator override. When unset, the BTC price loader
  // falls back to the canonical Ethereum mainnet address
  // (0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c). Override only if the RPC
  // points at a chain that hosts a different aggregator address.
  NEXT_PUBLIC_CHAINLINK_BTC_USD_ADDRESS: z.string().optional(),
  // Mining energy cost override (USD per kWh). When unset, the loader falls
  // back to the industry default 0.05 USD/kWh and surfaces a `Manual`
  // provenance badge. Methodology v1.0 promises a partner-attested feed
  // (out-of-scope for the current cluster); this env var is the bridge.
  MINING_ENERGY_COST_USD_PER_KWH: z.coerce.number().positive().optional(),
  // Hearst's mining revenue-share, in basis points (e.g. 4000 = 40%). The
  // distribution-coverage engine needs it to size net mining cash. No on-chain
  // source yet; this env var is the manual bridge (provenance stays Estimated
  // until a partner-attested feed lands). When unset, coverage is Pending —
  // never fabricated. 0–10000.
  MINING_REVENUE_SHARE_BPS: z.coerce.number().int().min(0).max(10000).optional(),
  // Fireblocks custody (Proof-of-Reserves). Optional — when absent, custody data
  // falls back to mock with a `Manual` provenance badge instead of `Live`.
  FIREBLOCKS_API_KEY: z.string().optional(),
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
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  // LLM provider — Kimi K2.6 via the OpenAI-compatible Hypercli endpoint is the
  // single backend. Agents are provider-agnostic: they call `callLlm`, which
  // always routes to Kimi.
  HYPERCLI_API_KEY: z.string().min(1).optional(),
  HYPERCLI_BASE_URL: z.string().url().optional(),
  HYPERCLI_DEFAULT_MODEL: z.string().min(1).default("kimi-k2.6"),
  /** Optional fallback model on the same Hypercli endpoint. When set, callLlm
   *  retries on this model if the primary model fails all retries OR the
   *  circuit breaker opens. Set "" or leave unset to disable. Suggested: "glm-5". */
  HYPERCLI_FALLBACK_MODEL: z.string().optional(),
  HYPERCLI_ORG_ID: z.string().optional(),
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
  // Persona KYC — HMAC secret for webhook signature verification.
  // Required at runtime when the persona webhook endpoint is active.
  PERSONA_WEBHOOK_SECRET: z.string().optional(),
  // Persona KYC — server-side API key (optional, only needed if we call
  // Persona's REST API to pre-create inquiries; the embed flow doesn't need it).
  PERSONA_API_KEY: z.string().optional(),
  // Risk-free rate (annual, as a decimal — e.g. "0.045" for 4.5%). Optional:
  // when unset, `src/lib/data/risk-free-rate.ts` falls back to the
  // Methodology v1.0 default (0.045) with `provenance: "manual"`. When set,
  // the loader tags provenance as `live`. Future ingestion (Ondo + FRED, see
  // audit P0-03) will replace this manual override with an oracle/live feed.
  RISK_FREE_RATE_ANNUAL_DECIMAL: z.string().optional(),
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
  if (!d.HYPERCLI_API_KEY) {
    console.error(
      "⚠️  HYPERCLI_API_KEY is not set. LLM features (agents, investor memo) will " +
        "fail at runtime. Set HYPERCLI_API_KEY to enable them.",
    );
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
  // invest form shows "Configuration en attente" and blocks every transaction).
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
      const data: ServerEnv = {
        ...lenient.data,
        DATABASE_URL: lenient.data.DATABASE_URL ?? "",
        HYPERCLI_DEFAULT_MODEL: lenient.data.HYPERCLI_DEFAULT_MODEL ?? "kimi-k2.6",
      };
      return data;
    }
  }

  throw new Error(
    `Invalid environment variables: ${Object.keys(parsed.error.flatten().fieldErrors).join(", ") || "(unknown)"}`,
  );
}

export const env: ServerEnv = resolveEnv();
