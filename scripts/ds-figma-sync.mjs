#!/usr/bin/env node
/**
 * ds-figma-sync.mjs — DIFF report-only : variables Figma (source-of-truth design)
 * vs cockpit-shell/tokens.css (DS éditable du repo).
 *
 * NE RÉÉCRIT JAMAIS tokens.css. Sort un rapport des tokens qui ont dérivé de la
 * source Figma. Adrien édite le DS à la main — ce script ne fait que SIGNALER.
 *
 * Deux sources de variables Figma (par ordre de préférence) :
 *   A. MCP figma-dev-mode (http://127.0.0.1:3845/mcp) — serveur LOCAL dev-mode,
 *      nécessite Figma DESKTOP ouvert sur le fichier. Utilisé interactivement
 *      depuis Claude Code (voir docs/DS_FIGMA_SYNC.md). En CLI headless il est
 *      souvent injoignable -> ce script bascule sur le fallback REST.
 *   B. Figma REST API (headless / CI) — GET variables/local, auth par
 *      FIGMA_TOKEN (Personal Access Token, scope `file_variables:read`).
 *      Variables : FIGMA_TOKEN, FIGMA_FILE_KEY (clé du fichier Figma DS).
 *
 * Usage :
 *   FIGMA_TOKEN=... FIGMA_FILE_KEY=... node scripts/ds-figma-sync.mjs
 *   node scripts/ds-figma-sync.mjs --source=mcp   # force la voie MCP locale
 *   node scripts/ds-figma-sync.mjs --json         # sortie machine (CI)
 *
 * Exit 0 toujours en mode défaut (report-only, informatif). Avec --strict,
 * exit 1 si au moins un token a dérivé (utile en CI non-bloquante -> warning).
 *
 * Réseau : chaque appel fetch est borné par un timeout (AbortController) — un
 * socket MCP local pendu (Figma desktop fermé) échoue vite et bascule sur REST,
 * jamais de hang en CI.
 *
 * Secrets : lus depuis process.env UNIQUEMENT, jamais imprimés ni loggés.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TOKENS_CSS = resolve(ROOT, "cockpit-shell/tokens.css");

const argv = process.argv.slice(2);
const FLAG_JSON = argv.includes("--json");
const FLAG_STRICT = argv.includes("--strict");
const SOURCE = (argv.find((a) => a.startsWith("--source=")) || "--source=auto").split("=")[1];

const FIGMA_TOKEN = process.env.FIGMA_TOKEN || "";
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY || "";
const FIGMA_MCP_URL = process.env.FIGMA_MCP_URL || "http://127.0.0.1:3845/mcp";

// Timeouts réseau bornés (ms). MCP local court (échoue vite -> fallback REST) ;
// REST plus large (latence API Figma). Surchargeable via env pour la CI.
const MCP_TIMEOUT_MS = Number(process.env.FIGMA_MCP_TIMEOUT_MS || 5000);
const REST_TIMEOUT_MS = Number(process.env.FIGMA_REST_TIMEOUT_MS || 15000);

function log(...a) { if (!FLAG_JSON) console.log(...a); }
function warn(...a) { if (!FLAG_JSON) console.warn(...a); }

/**
 * fetch avec timeout dur via AbortController. Évite tout hang sur un socket
 * pendu (MCP local sans desktop, API lente). `clearTimeout` en finally.
 */
async function fetchWithTimeout(url, options, timeoutMs, label) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(`${label} timeout après ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// ── Lecture des tokens du repo (--ct-*) ──────────────────────────────────────
function extractRepoTokens() {
  if (!existsSync(TOKENS_CSS)) {
    console.error(`FAIL: ${TOKENS_CSS} introuvable.`);
    process.exit(1);
  }
  let content = readFileSync(TOKENS_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Map();
  const re = /--ct-([\w-]+)\s*:\s*([^;!]+?)(?:\s*!important)?\s*;/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    tokens.set(`--ct-${m[1]}`, m[2].trim().replace(/\s+/g, " ").toLowerCase());
  }
  return tokens;
}

// ── Normalisation couleur (Figma renvoie {r,g,b,a} 0..1) -> hex lowercase ──────
function rgbaToHex({ r, g, b, a }) {
  const to = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  const hex = `#${to(r)}${to(g)}${to(b)}`;
  return a !== undefined && a < 1 ? `${hex}${to(a)}` : hex;
}

/**
 * Mappe un nom de variable Figma vers un nom de token --ct-*.
 * Convention : groupe/sous-groupe "Accent/Default" -> --ct-accent,
 * "Surface/0" -> --ct-surface-0. Slashes -> tirets, lowercase, espaces -> tirets.
 * Préfixe déjà --ct- ? on le garde tel quel.
 */
function figmaNameToToken(name) {
  let n = String(name).trim().toLowerCase();
  if (n.startsWith("--ct-")) return n;
  n = n.replace(/[\s/]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `--ct-${n}`;
}

// ── Source A : MCP figma-dev-mode (local, Figma desktop ouvert) ───────────────
async function fetchViaMcp() {
  // Le MCP dev-mode expose un endpoint JSON-RPC. On tente un appel get_variable_defs.
  // En CLI headless il est souvent KO (pas de desktop) -> on lève pour fallback.
  const res = await fetchWithTimeout(
    FIGMA_MCP_URL,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "get_variable_defs", arguments: {} },
      }),
    },
    MCP_TIMEOUT_MS,
    "MCP figma-dev-mode",
  );
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.result?.content?.[0]?.text ?? "";
  const parsed = JSON.parse(text);
  const out = new Map();
  for (const [name, value] of Object.entries(parsed)) {
    const v = typeof value === "string" ? value.toLowerCase() : value;
    out.set(figmaNameToToken(name), typeof v === "object" && v && "r" in v ? rgbaToHex(v) : String(v).toLowerCase());
  }
  return out;
}

// ── Source B : Figma REST (headless / CI) ────────────────────────────────────
async function fetchViaRest() {
  if (!FIGMA_TOKEN) throw new Error("FIGMA_TOKEN absent (process.env) — requis pour la voie REST.");
  if (!FIGMA_FILE_KEY) throw new Error("FIGMA_FILE_KEY absent (process.env) — clé du fichier Figma DS.");
  const url = `https://api.figma.com/v1/files/${encodeURIComponent(FIGMA_FILE_KEY)}/variables/local`;
  const res = await fetchWithTimeout(
    url,
    { headers: { "X-Figma-Token": FIGMA_TOKEN } },
    REST_TIMEOUT_MS,
    "Figma REST",
  );
  if (!res.ok) {
    // Ne JAMAIS imprimer le token. On donne juste le code HTTP.
    throw new Error(`Figma REST HTTP ${res.status} (variables/local). Vérifie FIGMA_FILE_KEY + scope du PAT.`);
  }
  const body = await res.json();
  const vars = body?.meta?.variables ?? {};
  const out = new Map();
  for (const v of Object.values(vars)) {
    if (v?.resolvedType !== "COLOR" && v?.resolvedType !== "FLOAT" && v?.resolvedType !== "STRING") continue;
    const modes = v?.valuesByMode ? Object.values(v.valuesByMode) : [];
    const raw = modes[0];
    if (raw === undefined) continue;
    let val;
    if (raw && typeof raw === "object" && "r" in raw) val = rgbaToHex(raw);
    else val = String(raw).toLowerCase();
    out.set(figmaNameToToken(v.name), val);
  }
  return out;
}

async function fetchFigmaTokens() {
  const order = SOURCE === "mcp" ? ["mcp"] : SOURCE === "rest" ? ["rest"] : ["mcp", "rest"];
  let lastErr;
  for (const s of order) {
    try {
      if (s === "mcp") { log("→ Source : MCP figma-dev-mode (local)"); return { tokens: await fetchViaMcp(), source: "mcp" }; }
      if (s === "rest") { log("→ Source : Figma REST API (headless)"); return { tokens: await fetchViaRest(), source: "rest" }; }
    } catch (e) {
      lastErr = e;
      warn(`  ${s} indisponible : ${e.message}`);
    }
  }
  throw lastErr ?? new Error("Aucune source Figma disponible.");
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const repo = extractRepoTokens();
  let figma, source;
  try {
    ({ tokens: figma, source } = await fetchFigmaTokens());
  } catch (e) {
    const msg = `ds-figma-sync: source Figma indisponible — ${e.message}`;
    if (FLAG_JSON) console.log(JSON.stringify({ ok: false, reason: msg }, null, 2));
    else warn(`\n${msg}\n  (MCP local = Figma desktop requis ; CI = FIGMA_TOKEN + FIGMA_FILE_KEY.)`);
    // Report-only : pas de source != échec d invariant. Exit 0 sauf --strict.
    process.exit(FLAG_STRICT ? 1 : 0);
  }

  const drifted = [];
  const missingInRepo = [];
  for (const [name, figVal] of figma.entries()) {
    const repoVal = repo.get(name);
    if (repoVal === undefined) { missingInRepo.push({ token: name, figma: figVal }); continue; }
    if (repoVal !== figVal) drifted.push({ token: name, figma: figVal, repo: repoVal });
  }

  if (FLAG_JSON) {
    console.log(JSON.stringify({ ok: true, source, comparedFromFigma: figma.size, drifted, missingInRepo }, null, 2));
  } else {
    log(`\n── FIGMA → tokens.css DIFF (report-only, source: ${source}) ──────────────────\n`);
    log(`Repo  : cockpit-shell/tokens.css (${repo.size} tokens --ct-*)`);
    log(`Figma : ${figma.size} variables mappées\n`);
    if (drifted.length === 0) log("Aucune dérive : tokens.css correspond à la source Figma.");
    else {
      log(`DÉRIVES (${drifted.length}) — tokens.css diffère de Figma :\n`);
      for (const d of drifted) {
        log(`  ${d.token}`);
        log(`    Figma     : ${d.figma}`);
        log(`    tokens.css: ${d.repo}\n`);
      }
    }
    if (missingInRepo.length) {
      log(`\nVariables Figma sans token --ct-* dans le repo (${missingInRepo.length}) — informatif :`);
      for (const m of missingInRepo) log(`  ${m.token} = ${m.figma}`);
    }
    log("\nRAPPEL : report-only. tokens.css n est PAS réécrit — Adrien aligne à la main.");
  }

  process.exit(FLAG_STRICT && drifted.length > 0 ? 1 : 0);
})().catch((e) => {
  console.error(`ds-figma-sync: erreur inattendue — ${e.message}`);
  process.exit(FLAG_STRICT ? 1 : 0);
});
