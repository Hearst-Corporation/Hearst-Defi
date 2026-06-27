/**
 * scripts/telegram-machines-html.mjs
 *
 * Reads the latest Letine price list, parses it with the SAME pure parser the
 * app uses, computes amortized CAPEX $/TH/day per cooling, and writes a
 * standalone interactive HTML table you can open and work with.
 *
 *   node scripts/telegram-machines-html.mjs [@channel] [out.html]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { parseMachinePriceMessage } from "../src/lib/telegram/parse-machine-price.ts";
import { computeMachineEconomics, ENERGY_COST_USD_PER_KWH } from "../src/lib/telegram/cost-model.ts";
import { deriveHashpriceUsdPerThDay } from "../src/lib/engine/hashprice-formula.ts";

function loadEnvLocal() {
  const env = {};
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trimStart().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return env;
}

const env = loadEnvLocal();
const channel = process.argv[2] ?? "@LetineSidonia";
const out = process.argv[3] ?? "telegram-machines.html";

const client = new TelegramClient(
  new StringSession(env.TELEGRAM_SESSION),
  Number(env.TELEGRAM_API_ID),
  env.TELEGRAM_API_HASH,
  { connectionRetries: 3 },
);
await client.connect();

// Newest message that actually parses into samples.
const messages = await client.getMessages(channel, { limit: 8 });
let parsed = { listDate: null, samples: [] };
for (const msg of messages) {
  if (!msg.message) continue;
  const p = parseMachinePriceMessage(msg.message);
  if (p.samples.length > parsed.samples.length) parsed = p;
}

// Live hashprice (revenue $/TH/day) from mempool difficulty + Coingecko BTC.
let hashprice = 0.028;
let btcPrice = 0;
try {
  const [diffRes, btcRes] = await Promise.all([
    fetch("https://mempool.space/api/v1/mining/difficulty-adjustments/1m"),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
  ]);
  const diff = (await diffRes.json())[0][2];
  btcPrice = (await btcRes.json()).bitcoin.usd;
  hashprice = deriveHashpriceUsdPerThDay(diff, btcPrice);
} catch {}
await client.disconnect();

const rows = parsed.samples.map((s) => {
  const e = computeMachineEconomics(s); // energy 6¢, fees disabled = ex-works
  const margin = e.totalCostUsdPerThDay === null ? null : round6(hashprice - e.totalCostUsdPerThDay);
  return { ...e, coolingSource: "", margin };
});

function round6(n) { return Math.round(n * 1e6) / 1e6; }

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tableRows = rows
  .map(
    (r) => `<tr data-cooling="${r.cooling}">
  <td>${esc(r.model)}</td>
  <td class="c-${r.cooling}">${r.cooling}</td>
  <td class="num">${r.thPerUnit}</td>
  <td class="num">${r.efficiencyJTh ?? "—"}</td>
  <td class="num">$${r.exWorksUsd.toLocaleString()}</td>
  <td class="num">${r.amortMonths}m</td>
  <td class="num">$${r.capexUsdPerThDay}</td>
  <td class="num">${r.energyUsdPerThDay === null ? "—" : "$" + r.energyUsdPerThDay}</td>
  <td class="num strong">${r.totalCostUsdPerThDay === null ? "—" : "$" + r.totalCostUsdPerThDay}</td>
  <td class="num ${r.margin === null ? "" : r.margin >= 0 ? "pos" : "neg"}">${r.margin === null ? "—" : "$" + r.margin}</td>
</tr>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Letine machines — ${esc(parsed.listDate ?? "n/a")}</title>
<style>
  :root { --bg:#0b0e0d; --panel:#15191c; --line:#222; --accent:#A7FB90; --muted:#8a938e; }
  * { box-sizing:border-box; }
  body { margin:0; font:14px/1.5 -apple-system,system-ui,sans-serif; background:var(--bg); color:#e6efe9; padding:32px; }
  h1 { font-size:20px; margin:0 0 4px; }
  h1 span { color:var(--accent); }
  .meta { color:var(--muted); margin-bottom:20px; }
  .filters { margin-bottom:14px; display:flex; gap:8px; flex-wrap:wrap; }
  .filters button { background:var(--panel); color:#e6efe9; border:1px solid var(--line); border-radius:8px; padding:6px 12px; cursor:pointer; font:inherit; }
  .filters button.active { border-color:var(--accent); color:var(--accent); }
  table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  th,td { padding:8px 12px; text-align:left; border-bottom:1px solid var(--line); }
  th { background:#10140f; color:var(--muted); font-weight:600; cursor:pointer; user-select:none; white-space:nowrap; }
  th:hover { color:var(--accent); }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .strong { color:var(--accent); font-weight:700; }
  .c-air { color:#7fd3ff; } .c-hydro { color:#A7FB90; } .c-immersion { color:#ffce6b; } .c-unknown { color:var(--muted); }
  .pos { color:var(--accent); font-weight:700; } .neg { color:#ff6b6b; font-weight:700; }
  tr:hover td { background:#1b211d; }
</style></head>
<body>
  <h1>Letine — <span>Prix machines</span></h1>
  <div class="meta">Source: ${esc(channel)} · Date liste: <b>${esc(parsed.listDate ?? "n/a")}</b> · ${rows.length} machines<br>
  Revenu (hashprice live): <b style="color:var(--accent)">$${round6(hashprice)}/TH/jour</b> (BTC $${btcPrice.toLocaleString()}) · Énergie: <b>${ENERGY_COST_USD_PER_KWH * 100} ¢/kWh</b> · CAPEX = ex-works / TH / (amort × 30,4j) · Air 3 ans, Hydro/Immersion 5 ans<br>
  <i>Prix = ex-works (frais port/douane/install non inclus, ajoutables). Marge = revenu − (CAPEX + énergie), avant hosting/pool.</i></div>
  <div class="filters">
    <button data-f="all" class="active">Tous (${rows.length})</button>
    <button data-f="air">Air</button>
    <button data-f="hydro">Hydro</button>
    <button data-f="immersion">Immersion</button>
  </div>
  <table id="t">
    <thead><tr>
      <th data-k="model">Modèle</th><th data-k="cooling">Cooling</th>
      <th data-k="th" class="num">TH/s</th><th data-k="eff" class="num">J/TH</th>
      <th data-k="price" class="num">Ex-works</th><th data-k="amort" class="num">Amort.</th>
      <th data-k="capex" class="num">CAPEX $/TH/j</th><th data-k="energy" class="num">Énergie $/TH/j</th>
      <th data-k="total" class="num">Coût total $/TH/j</th><th data-k="margin" class="num">Marge $/TH/j</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
<script>
  const tbody = document.querySelector('#t tbody');
  const rows = [...tbody.rows];
  document.querySelectorAll('.filters button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.filters button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const f = b.dataset.f;
    rows.forEach(r => r.style.display = (f === 'all' || r.dataset.cooling === f) ? '' : 'none');
  });
  let asc = {};
  document.querySelectorAll('th').forEach((th, i) => th.onclick = () => {
    asc[i] = !asc[i];
    const visible = rows.filter(r => r.style.display !== 'none');
    visible.sort((a, b) => {
      const x = a.cells[i].textContent.replace(/[^0-9.\-]/g, ''), y = b.cells[i].textContent.replace(/[^0-9.\-]/g, '');
      const nx = parseFloat(x), ny = parseFloat(y);
      const cmp = (!isNaN(nx) && !isNaN(ny)) ? nx - ny : a.cells[i].textContent.localeCompare(b.cells[i].textContent);
      return asc[i] ? cmp : -cmp;
    });
    visible.forEach(r => tbody.appendChild(r));
  });
</script>
</body></html>`;

writeFileSync(new URL(`../${out}`, import.meta.url), html);
console.log(`✅ ${rows.length} machines → ${out} (date liste: ${parsed.listDate})`);
