/**
 * scripts/telegram-login.mjs
 *
 * One-time MTProto login. Run it YOURSELF in your terminal:
 *
 *   node scripts/telegram-login.mjs
 *
 * It reads TELEGRAM_API_ID / TELEGRAM_API_HASH from .env.local, prompts for your
 * phone number, the Telegram login code, and your 2FA password (if set), then
 * prints a STRING SESSION. Paste that value into .env.local as TELEGRAM_SESSION.
 *
 * The code and 2FA password stay on your machine — nothing is sent anywhere
 * except Telegram's own servers. The string session is a credential: keep it in
 * .env.local only, never commit it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

// Minimal .env.local loader (no dependency on the app's Zod env, which would
// fail because TELEGRAM_SESSION isn't set yet — that's exactly what we generate).
function loadEnvLocal() {
  const env = {};
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trimStart().startsWith("#")) {
        env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* file optional */
  }
  return env;
}

const env = loadEnvLocal();
const apiId = Number(env.TELEGRAM_API_ID);
const apiHash = env.TELEGRAM_API_HASH;

if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) {
  console.error(
    "Missing TELEGRAM_API_ID / TELEGRAM_API_HASH in .env.local. Add them first.",
  );
  process.exit(1);
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => await input.text("Phone number (international, e.g. +33...): "),
  password: async () => await input.text("2FA password (blank if none): "),
  phoneCode: async () => await input.text("Login code (sent on Telegram): "),
  onError: (err) => console.error(err),
});

const session = client.session.save();

// Write TELEGRAM_SESSION straight into .env.local — no copy/paste, the secret
// never leaves this machine.
const envUrl = new URL("../.env.local", import.meta.url);
let raw = "";
try {
  raw = readFileSync(envUrl, "utf8");
} catch {
  /* file optional */
}
if (/^TELEGRAM_SESSION=.*$/m.test(raw)) {
  raw = raw.replace(/^TELEGRAM_SESSION=.*$/m, `TELEGRAM_SESSION=${session}`);
} else {
  raw += `${raw.endsWith("\n") || raw === "" ? "" : "\n"}TELEGRAM_SESSION=${session}\n`;
}
writeFileSync(envUrl, raw);

console.log("\n✅ Logged in. TELEGRAM_SESSION written to .env.local. Done.\n");

await client.disconnect();
process.exit(0);
