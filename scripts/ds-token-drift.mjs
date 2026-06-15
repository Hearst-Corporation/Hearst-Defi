#!/usr/bin/env node
/**
 * ds-token-drift.mjs — Token divergence audit between cockpit-shell/tokens.css
 * (local editable DS copy) and cockpit.css (project runtime overrides).
 *
 * Usage: node scripts/ds-token-drift.mjs
 * Exit 0: all divergences are allowlisted OR no divergences.
 * Exit 1: unexpected drift detected OR brand regression detected.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

// ── Resolve cockpit-shell tokens.css (local editable DS copy) ────────────────
function findShellTokens() {
  return join(ROOT, "cockpit-shell/tokens.css");
}

const PKG_TOKENS_PATH = findShellTokens();
const COCKPIT_CSS_PATH = join(ROOT, "src/app/cockpit.css");
const ALLOWLIST_PATH = join(ROOT, "scripts/ds-token-allowlist.json");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract --ct-* token definitions from CSS content.
 * Returns Map<tokenName, normalizedValue>.
 * Normalises: trim, collapse whitespace, lowercase.
 */
function extractTokens(content) {
  const tokens = new Map();
  // Strip CSS comments first — a token name mentioned inside /* ... */ is NOT a
  // definition. After the P0 single-source cleanup (4b88a4a), cockpit.css carries
  // notes like "/* --ct-ease : source unique tokens.css ... */"; without this the
  // regex would parse the commented name as a bogus (drifting) definition.
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  // Match:  --ct-<name>: <value>[!important];
  const re = /--ct-([\w-]+)\s*:\s*([^;!]+?)(?:\s*!important)?\s*;/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = `--ct-${m[1]}`;
    const val = m[2].trim().replace(/\s+/g, " ").toLowerCase();
    tokens.set(name, val);
  }
  return tokens;
}

/** Load the allowlist and return a Map<tokenName, reason>. */
function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return new Map();
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  const map = new Map();
  for (const entry of raw.allowedDivergences ?? []) {
    map.set(entry.token, entry.reason);
  }
  return map;
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (!existsSync(PKG_TOKENS_PATH)) {
  console.error("FAIL: cockpit-shell/tokens.css not found — local DS copy is required.");
  process.exit(1);
}

const pkgContent = readFileSync(PKG_TOKENS_PATH, "utf8");
const cockpitContent = readFileSync(COCKPIT_CSS_PATH, "utf8");
const allowlist = loadAllowlist();

const pkgTokens = extractTokens(pkgContent);
const cockpitTokens = extractTokens(cockpitContent);

// ── STEP 1: Maroon detection in the real package ──────────────────────────────
// These hex values are the package's stale maroon-era tokens.
const MAROON_RE = /#8a1538\b|#9e1b2e\b|#1a050b\b/gi;
const maroonMatches = [];
{
  const lines = pkgContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    MAROON_RE.lastIndex = 0;
    const m = MAROON_RE.exec(lines[i]);
    if (m) maroonMatches.push({ line: i + 1, match: m[0], text: lines[i].trim() });
  }
}

if (maroonMatches.length > 0) {
  const shortPath = PKG_TOKENS_PATH.replace(ROOT, ".");
  console.warn(`\nWARNING: Stale maroon/dark-red values detected in package tokens.css:`);
  console.warn(`  File: ${shortPath}`);
  for (const { line, match, text } of maroonMatches) {
    console.warn(`  line ${line}: [${match}] ${text}`);
  }
  console.warn(
    `  These are OVERRIDDEN at runtime by cockpit.css. They do NOT affect the product.`
  );
  console.warn(`  Action required: remove maroon values from cockpit-shell/tokens.css.\n`);
}

// ── STEP 2: Token divergence report ──────────────────────────────────────────
const divergences = [];
for (const [name, pkgVal] of pkgTokens.entries()) {
  const cockpitVal = cockpitTokens.get(name);
  if (cockpitVal !== undefined && cockpitVal !== pkgVal) {
    divergences.push({ token: name, pkgValue: pkgVal, cockpitValue: cockpitVal });
  }
}

let unexpectedDrift = false;

console.log("\n── TOKEN DRIFT REPORT ────────────────────────────────────────────────────\n");
console.log(`Shell base: ${PKG_TOKENS_PATH.replace(ROOT + "/", "")}`);
console.log(`cockpit.css: src/app/cockpit.css`);
console.log(`Allowlist:   scripts/ds-token-allowlist.json\n`);

if (divergences.length === 0) {
  console.log("No divergences found — package and cockpit.css are in sync.");
} else {
  for (const { token, pkgValue, cockpitValue } of divergences) {
    const reason = allowlist.get(token);
    const status = reason ? "expected-override" : "unexpected-drift";
    if (!reason) unexpectedDrift = true;

    console.log(`TOKEN:           ${token}`);
    console.log(`PACKAGE_VALUE:   ${pkgValue}`);
    console.log(`COCKPIT_VALUE:   ${cockpitValue}`);
    console.log(`MATCH:           no`);
    console.log(`STATUS:          ${status}`);
    if (reason) {
      console.log(`REASON:          ${reason}`);
    } else {
      console.log(`REASON:          *** NOT IN ALLOWLIST — review required ***`);
    }
    console.log();
  }
  console.log(`Total divergences: ${divergences.length}`);
  console.log(
    `  Expected overrides (allowlisted): ${divergences.filter(d => allowlist.has(d.token)).length}`
  );
  console.log(
    `  Unexpected drift (action needed): ${divergences.filter(d => !allowlist.has(d.token)).length}`
  );
}

// ── STEP 3: Brand assertion — --ct-accent must resolve to the brand green ─────
// After the P0 single-source cleanup (4b88a4a), the 4 strictly-identical tokens
// (bg-deep / accent / accent-soft / ease) live ONLY in cockpit-shell/tokens.css —
// cockpit.css no longer redefines them. So resolve --ct-accent from cockpit.css
// when it overrides, else from tokens.css, and assert the brand green either way.
const BRAND_GREEN_RE = /^#a7fb90$/i;
const accentSource = cockpitTokens.has("--ct-accent")
  ? "src/app/cockpit.css"
  : "cockpit-shell/tokens.css";
const resolvedAccent = cockpitTokens.get("--ct-accent") ?? pkgTokens.get("--ct-accent");

console.log("\n── BRAND ASSERTION ───────────────────────────────────────────────────────\n");
if (!resolvedAccent) {
  console.error(
    "BRAND REGRESSION: --ct-accent is defined in NEITHER src/app/cockpit.css NOR cockpit-shell/tokens.css"
  );
  process.exit(1);
}
if (!BRAND_GREEN_RE.test(resolvedAccent)) {
  console.error(
    `BRAND REGRESSION: --ct-accent is "${resolvedAccent}" (${accentSource}) — expected #A7FB90`
  );
  process.exit(1);
}
console.log(`OK: --ct-accent = ${resolvedAccent} (green confirmed, source: ${accentSource})`);

// ── Final exit ────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────────────────────────────────────\n");

if (unexpectedDrift) {
  console.error("FAIL: ds-token-drift — unexpected drift detected. Add to allowlist or fix the token.");
  process.exit(1);
}

if (divergences.length > 0) {
  console.log(
    `PASS: ds-token-drift — ${divergences.length} divergence(s), all allowlisted. cockpit.css is the runtime override layer.`
  );
} else {
  console.log("PASS: ds-token-drift — no unexpected drift.");
}

process.exit(0);
