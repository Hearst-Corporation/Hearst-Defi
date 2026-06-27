/**
 * scripts/telegram-list-dialogs.mjs
 *
 * Read-only sanity check: connects with the stored session and lists your
 * channels/groups (title + @username + id) so we can pick which ones to screen
 * for machine prices. Prints nothing but names/ids — no message content.
 *
 *   node scripts/telegram-list-dialogs.mjs [limit]
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
const limit = Number(process.argv[2] ?? 100);

if (!apiId || !apiHash || !session) {
  console.error("Missing TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION");
  process.exit(1);
}

const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
  connectionRetries: 3,
});
await client.connect();

const dialogs = await client.getDialogs({ limit });
const rows = [];
for (const d of dialogs) {
  const e = d.entity;
  if (!e) continue;
  const kind = d.isChannel ? "channel" : d.isGroup ? "group" : "user";
  rows.push({
    kind,
    title: d.title ?? e.username ?? String(e.id),
    username: e.username ? `@${e.username}` : "",
    id: String(e.id),
  });
}

// Channels/groups first — that's where price feeds live.
rows.sort((a, b) => (a.kind === "user" ? 1 : 0) - (b.kind === "user" ? 1 : 0));
for (const r of rows) {
  console.log(
    `${r.kind.padEnd(8)} ${r.username.padEnd(28)} ${r.title}  [id:${r.id}]`,
  );
}
console.log(`\n${rows.length} dialogs listed.`);

await client.disconnect();
process.exit(0);
