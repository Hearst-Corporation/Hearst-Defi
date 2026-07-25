import "server-only";

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

import { env } from "@/lib/env";

/**
 * MTProto client (ingestion layer — I/O lives here, NEVER in src/lib/engine/*).
 *
 * Reads a logged-in user session from env (api_id + api_hash + string session,
 * generated once via scripts/telegram-login.mjs). Connects lazily and reuses a
 * single client across calls within a server process.
 *
 * Secrets are read from process.env only — never hardcoded, never logged.
 */

let cached: Promise<TelegramClient> | null = null;

function readConfig() {
  // `env.TELEGRAM_API_ID` is Zod-coerced to a positive int at boot; `?? NaN`
  // reproduces the old `Number(undefined)` → NaN path when the var is absent.
  const apiId = env.TELEGRAM_API_ID ?? Number.NaN;
  const apiHash = env.TELEGRAM_API_HASH;
  const session = env.TELEGRAM_SESSION;

  if (!Number.isInteger(apiId) || apiId <= 0) {
    throw new Error("TELEGRAM_API_ID missing or invalid");
  }
  if (!apiHash) throw new Error("TELEGRAM_API_HASH missing");
  if (!session) {
    throw new Error(
      "TELEGRAM_SESSION missing — run `node scripts/telegram-login.mjs` once",
    );
  }
  return { apiId, apiHash, session };
}

/** Lazily connect (or reuse) the MTProto client. */
export async function getTelegramClient(): Promise<TelegramClient> {
  if (!cached) {
    cached = (async () => {
      const { apiId, apiHash, session } = readConfig();
      const client = new TelegramClient(
        new StringSession(session),
        apiId,
        apiHash,
        { connectionRetries: 3 },
      );
      await client.connect();
      return client;
    })();
  }
  return cached;
}

/** True when all three Telegram env vars are present (so callers can degrade). */
export function isTelegramConfigured(): boolean {
  return Boolean(
    env.TELEGRAM_API_ID && env.TELEGRAM_API_HASH && env.TELEGRAM_SESSION,
  );
}
