/**
 * scripts/telegram-sample.mjs
 *
 * Read-only: dumps the last N text messages from given channels so we can see
 * the real price-message format and calibrate the parser.
 *
 *   node scripts/telegram-sample.mjs <count> <@chan1> [@chan2 ...]
 */

import { readFileSync } from "node:fs";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

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
    /* optional */
  }
  return env;
}

const env = loadEnvLocal();
const apiId = Number(env.TELEGRAM_API_ID);
const apiHash = env.TELEGRAM_API_HASH;
const session = env.TELEGRAM_SESSION;
const count = Number(process.argv[2] ?? 15);
const channels = process.argv.slice(3);

if (!apiId || !apiHash || !session) {
  console.error("Missing Telegram env vars");
  process.exit(1);
}
if (channels.length === 0) {
  console.error("Usage: node scripts/telegram-sample.mjs <count> <@chan> ...");
  process.exit(1);
}

const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
  connectionRetries: 3,
});
await client.connect();

for (const ch of channels) {
  console.log(`\n════════════════════ ${ch} ════════════════════`);
  try {
    const messages = await client.getMessages(ch, { limit: count });
    for (const msg of messages) {
      const text = msg.message?.trim();
      if (!text) continue;
      const date = new Date(msg.date * 1000).toISOString().slice(0, 10);
      console.log(`\n──[${date}]──`);
      console.log(text);
    }
  } catch (err) {
    console.log(`  ⚠️  cannot read ${ch}: ${err.message}`);
  }
}

await client.disconnect();
process.exit(0);
