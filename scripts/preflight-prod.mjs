#!/usr/bin/env node
// scripts/preflight-prod.mjs
// Production preflight — ESM, Node 22, zero external dependencies.
// Usage: node scripts/preflight-prod.mjs
// Exit 0 when all P0 checks pass; exit 1 when any P0 check fails.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Mini .env parser — KEY=VALUE, ignores blank lines and # comments, no multiline.
// ---------------------------------------------------------------------------
function parseEnvFile(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    const result = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      let key = trimmed.slice(0, eqIdx).trim();
      key = key.replace(/^export\s+/, "");
      // Strip optional surrounding quotes (single or double)
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.warn(`[preflight] warning: could not read ${filePath} (${err?.code ?? err?.message})`);
    }
    return {};
  }
}

// ---------------------------------------------------------------------------
// Load env with precedence: process.env > .env.local > .env
// ---------------------------------------------------------------------------
const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dotEnvLocal = parseEnvFile(resolve(root, ".env.local"));
const dotEnv = parseEnvFile(resolve(root, ".env"));

function get(key) {
  if (key in process.env) return process.env[key];
  if (key in dotEnvLocal) return dotEnvLocal[key];
  if (key in dotEnv) return dotEnv[key];
  return undefined;
}

// ---------------------------------------------------------------------------
// Result accumulator
// ---------------------------------------------------------------------------
const rows = []; // { level: "ok"|"warn"|"fail", name: string, reason: string }
let p0Failures = 0;
let p1Warnings = 0;

function ok(name, reason = "") {
  rows.push({ level: "ok", name, reason });
}
function warn(name, reason) {
  rows.push({ level: "warn", name, reason });
  p1Warnings++;
}
function fail(name, reason) {
  rows.push({ level: "fail", name, reason });
  p0Failures++;
}

// ---------------------------------------------------------------------------
// P0 — missing or invalid → ❌, exit 1
// ---------------------------------------------------------------------------

// DATABASE_URL — must be postgres in production
{
  const val = get("DATABASE_URL");
  if (!val) {
    fail("DATABASE_URL", "missing");
  } else if (val.startsWith("file:") || val.startsWith("sqlite:")) {
    fail(
      "DATABASE_URL",
      "local dev DB — switch to Postgres for production (postgres:// or postgresql://)"
    );
  } else if (!val.startsWith("postgres://") && !val.startsWith("postgresql://")) {
    fail(
      "DATABASE_URL",
      `unrecognised protocol (got: ${val.split(":")[0]}:) — expected postgres:// or postgresql://`
    );
  } else {
    // Safe to show protocol only, never the credentials
    const protocol = val.split("://")[0] + "://…";
    ok("DATABASE_URL", `present (${protocol})`);
  }
}

// INNGEST_SIGNING_KEY — required; must start with signkey-prod- in production
{
  const val = get("INNGEST_SIGNING_KEY");
  if (!val) {
    fail(
      "INNGEST_SIGNING_KEY",
      "missing — /api/inngest accepts unauthenticated requests, anyone can trigger background jobs and rack up LLM costs"
    );
  } else if (!val.startsWith("signkey-prod-")) {
    fail(
      "INNGEST_SIGNING_KEY",
      "non-production signing key (expected signkey-prod-*)"
    );
  } else {
    ok("INNGEST_SIGNING_KEY", "present (signkey-prod-* ✓)");
  }
}

// SUMSUB_WEBHOOK_SECRET — required; without it KYC webhooks accept unauthenticated events
{
  const val = get("SUMSUB_WEBHOOK_SECRET");
  if (!val) {
    fail(
      "SUMSUB_WEBHOOK_SECRET",
      "missing — Sumsub KYC webhook accepts unauthenticated events, attacker can spoof KYC completions and bypass investor onboarding checks"
    );
  } else {
    ok("SUMSUB_WEBHOOK_SECRET", "present");
  }
}

// SUMSUB_APP_TOKEN — required; Sumsub REST API auth — every KYC call fails without it
{
  const val = get("SUMSUB_APP_TOKEN");
  if (!val) {
    fail(
      "SUMSUB_APP_TOKEN",
      "missing — Sumsub REST API cannot authenticate; KYC onboarding dies at applicant creation"
    );
  } else {
    ok("SUMSUB_APP_TOKEN", "present");
  }
}

// SUMSUB_SECRET_KEY — required; signs Sumsub API requests (HMAC) — same blast radius as APP_TOKEN
{
  const val = get("SUMSUB_SECRET_KEY");
  if (!val) {
    fail(
      "SUMSUB_SECRET_KEY",
      "missing — Sumsub HMAC signing fails on every API call; entire KYC flow is broken"
    );
  } else {
    ok("SUMSUB_SECRET_KEY", "present");
  }
}

// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN — required for distributed rate limiting
{
  const url = get("UPSTASH_REDIS_REST_URL");
  const token = get("UPSTASH_REDIS_REST_TOKEN");
  if (!url && !token) {
    fail(
      "UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN",
      "both missing — rate limiting is per-instance only and ineffective against distributed attacks"
    );
  } else if (!url) {
    fail("UPSTASH_REDIS_REST_URL", "missing (UPSTASH_REDIS_REST_TOKEN is set but URL is absent)");
  } else if (!token) {
    fail("UPSTASH_REDIS_REST_TOKEN", "missing (UPSTASH_REDIS_REST_URL is set but TOKEN is absent)");
  } else {
    ok("UPSTASH_REDIS_REST_URL", "present");
    ok("UPSTASH_REDIS_REST_TOKEN", "present");
  }
}

// Vault address — NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS or legacy NEXT_PUBLIC_HEARST_VAULT_ADDRESS
{
  const primary = get("NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS");
  const legacy = get("NEXT_PUBLIC_HEARST_VAULT_ADDRESS");
  const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;
  const ZERO_ADDR = /^0x0{40}$/i;
  const activeKey = primary ? "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS" : "NEXT_PUBLIC_HEARST_VAULT_ADDRESS";
  const activeVal = primary ?? legacy;

  if (!activeVal) {
    fail(
      "NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS",
      "missing — on-chain deposit/redeem flow is disabled, every transaction is blocked"
    );
  } else if (!EVM_ADDR.test(activeVal)) {
    fail(
      activeKey,
      `invalid format (must match /^0x[0-9a-fA-F]{40}$/) — got length ${activeVal.length}`
    );
  } else if (ZERO_ADDR.test(activeVal)) {
    fail(activeKey, "zero address placeholder — replace with deployed vault address");
  } else {
    const display = activeVal.slice(0, 6) + "…" + activeVal.slice(-4);
    const note = legacy && !primary ? " (legacy key)" : "";
    ok(activeKey, `${display}${note}`);
  }
}

// AUTH_TOTP_KEY — absent = warn (P1); present but malformed = fail (P0)
// Kept here in P0 section because a malformed key is worse than absent.
{
  const val = get("AUTH_TOTP_KEY");
  const HEX64 = /^[0-9a-fA-F]{64}$/;
  if (val !== undefined && val !== "") {
    if (!HEX64.test(val)) {
      fail(
        "AUTH_TOTP_KEY",
        "present but invalid — must be exactly 64 hex characters (32 bytes); admins with TOTP get locked out at login"
      );
    } else {
      ok("AUTH_TOTP_KEY", "present (64 hex chars ✓)");
    }
  }
  // If absent: handled in P1 section below
}

// ---------------------------------------------------------------------------
// P1 — missing → ⚠️ warning only
// ---------------------------------------------------------------------------

// RESEND_API_KEY
{
  const val = get("RESEND_API_KEY");
  if (!val) {
    warn("RESEND_API_KEY", "missing — investors are paid but never emailed");
  } else {
    ok("RESEND_API_KEY", "present");
  }
}

// OPENAI_API_KEY
{
  const val = get("OPENAI_API_KEY");
  if (!val) {
    warn("OPENAI_API_KEY", "missing — LLM features (agents, investor memo, chat) fail at runtime");
  } else {
    ok("OPENAI_API_KEY", "present");
  }
}

// DOCUSIGN_WEBHOOK_SECRET
{
  const val = get("DOCUSIGN_WEBHOOK_SECRET");
  if (!val) {
    warn(
      "DOCUSIGN_WEBHOOK_SECRET",
      "missing — DocuSign webhook fails-closed at runtime until configured"
    );
  } else {
    ok("DOCUSIGN_WEBHOOK_SECRET", "present");
  }
}

// ATTESTATION_ALLOWED_SIGNERS
{
  const val = get("ATTESTATION_ALLOWED_SIGNERS");
  if (!val) {
    warn(
      "ATTESTATION_ALLOWED_SIGNERS",
      "missing — attestation verification returns no_allowlist_configured"
    );
  } else {
    ok("ATTESTATION_ALLOWED_SIGNERS", "present");
  }
}

// AUTH_TOTP_KEY — absent = P1 warning
{
  const val = get("AUTH_TOTP_KEY");
  if (val === undefined || val === "") {
    warn("AUTH_TOTP_KEY", "missing — TOTP admin login will fail until configured");
  }
}

// ---------------------------------------------------------------------------
// Render table
// ---------------------------------------------------------------------------
const ICON = { ok: "✅", warn: "⚠️ ", fail: "❌" };
const maxName = Math.max(...rows.map((r) => r.name.length));

console.log("\n── Hearst Connect — Production Preflight ──\n");

for (const { level, name, reason } of rows) {
  const icon = ICON[level];
  const pad = name.padEnd(maxName + 2);
  const msg = reason ? `  ${reason}` : "";
  console.log(`  ${icon}  ${pad}${msg}`);
}

console.log(
  `\n── Summary ──  P0 failures: ${p0Failures} · P1 warnings: ${p1Warnings}\n`
);

process.exit(p0Failures > 0 ? 1 : 0);
