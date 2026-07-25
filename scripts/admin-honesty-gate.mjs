#!/usr/bin/env node
/**
 * scripts/admin-honesty-gate.mjs — GATE HONNÊTETÉ /admin (ratchet).
 *
 * POURQUOI UN RATCHET : le périmètre admin porte un stock connu de dette
 * d'honnêteté (tokens fantômes, vocabulaire interdit, fiction non marquée,
 * env sauvage). Une gate zéro-tolérance bloquerait tout commit dès le jour 1.
 * Cette gate échoue UNIQUEMENT quand un changement AGGRAVE le stock d'une
 * règle au-delà de la baseline committée (scripts/admin-honesty-baseline.json).
 * La baseline ne peut que BAISSER (`--update` refuse une hausse sans --force,
 * même pattern que scripts/quality-gate.mjs).
 *
 * LE MOTEUR NE CONNAÎT AUCUNE RÈGLE EN DUR : tout vient du tableau RULES de
 * scripts/admin-honesty-rules.mjs (les règles sont des données ; le lot DS
 * ajoutera ses règles de dialecte comme entrées).
 *
 * Zéro dépendance : node:fs, node:path, node:process uniquement.
 *
 * Usage :
 *   node scripts/admin-honesty-gate.mjs              # ratchet vs baseline
 *   node scripts/admin-honesty-gate.mjs --strict     # ignore la baseline (0 hit exigé)
 *   node scripts/admin-honesty-gate.mjs --update     # régénère la baseline (refuse une hausse sans --force)
 *   node scripts/admin-honesty-gate.mjs --rule <id>  # une seule règle
 *   node scripts/admin-honesty-gate.mjs --json       # sortie machine
 *
 * Sortie : `file:ligne  RULE-ID  message` triée + résumé par règle hits/baseline.
 * Exit 0 = ok. Exit 1 = régression (ou hit en --strict).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { RULES } from "./admin-honesty-rules.mjs";

const SELF = decodeURIComponent(new URL(import.meta.url).pathname);
const ROOT = path.resolve(path.dirname(SELF), "..");
export const BASELINE_PATH = path.join(ROOT, "scripts", "admin-honesty-baseline.json");

const SCAN_EXT = new Set([".ts", ".tsx", ".css"]);

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/* ── FS helpers (walker readdirSync récursif, style des gardiens Vitest) ── */

function toRel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

/** Fichiers scannables (.ts/.tsx/.css) sous `relDir` — __tests__ et *.test.* EXCLUS. */
function listDir(relDir) {
  const out = [];
  const inner = (absDir) => {
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return; // répertoire absent — périmètre tolérant
    }
    for (const entry of entries) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        inner(abs);
        continue;
      }
      if (!SCAN_EXT.has(path.extname(entry.name))) continue;
      if (/\.test\.[\w.]+$/.test(entry.name)) continue;
      out.push(toRel(abs));
    }
  };
  inner(path.join(ROOT, relDir));
  return out.sort();
}

function read(rel) {
  try {
    return readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return null;
  }
}

function exists(rel) {
  return existsSync(path.join(ROOT, rel));
}

/**
 * Neutralise les commentaires `/* … *​/` d'un fichier CSS en préservant les
 * sauts de ligne : une quote dans un commentaire CSS n'est pas un littéral
 * (piège connu : « les gardiens substring mordent les commentaires »). On ne
 * touche PAS aux .ts/.tsx — `/*` peut y vivre dans une vraie chaîne (globs).
 */
function stripCssComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Lecture pour SCAN : identique à read(), mais commentaires CSS neutralisés. */
function readScan(rel) {
  const src = read(rel);
  if (src == null) return null;
  return rel.endsWith(".css") ? stripCssComments(src) : src;
}

/**
 * Contextes chaîne d'une ligne : littéraux quotés ('…', "…", `…`) + texte JSX
 * (heuristique : segment entre `>` et `<` sur la ligne). `start` = offset du
 * contenu dans la ligne (permet de dédupliquer string vs JSX).
 */
function stringContexts(lineText) {
  const out = [];
  const quoted = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\\n]|\\.)*)`/g;
  for (const m of lineText.matchAll(quoted)) {
    out.push({ kind: "string", text: m[1] ?? m[2] ?? m[3] ?? "", start: m.index + 1 });
  }
  for (const m of lineText.matchAll(/>([^<>]+)</g)) {
    out.push({ kind: "jsx", text: m[1], start: m.index + 1 });
  }
  return out;
}

/* ── Moteur générique — rien d'un contenu de règle ici ── */

function scopeFilesFor(rule) {
  if (typeof rule.scope === "function") {
    return listDir("src").filter(rule.scope);
  }
  return (rule.scope ?? []).flatMap((dir) => listDir(dir));
}

function makeCtx(rule) {
  return {
    root: ROOT,
    scopeFiles: scopeFilesFor(rule),
    read,
    readScan,
    exists,
    listDir,
    stringContexts,
  };
}

/** check "line-regex" générique : pattern par ligne, contextes chaîne si demandé,
 *  prédicats `exempt` AVANT allowlist. */
function runLineRegex(rule, ctx) {
  const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g";
  const pattern = new RegExp(rule.pattern.source, flags);
  const out = [];
  for (const rel of ctx.scopeFiles) {
    const src = ctx.readScan(rel);
    if (src == null) continue;
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const candidates = [];
      if (rule.stringContextOnly) {
        const seenOffsets = new Set();
        for (const context of ctx.stringContexts(lineText)) {
          for (const m of context.text.matchAll(pattern)) {
            const absOffset = context.start + m.index;
            if (seenOffsets.has(absOffset)) continue; // même match vu en string ET en JSX
            seenOffsets.add(absOffset);
            candidates.push({
              file: rel,
              line: i + 1,
              lineText,
              match: m[0],
              context,
              indexInContext: m.index,
            });
          }
        }
      } else {
        for (const m of lineText.matchAll(pattern)) {
          candidates.push({ file: rel, line: i + 1, lineText, match: m[0], matchIndex: m.index });
        }
      }
      for (const cand of candidates) {
        if ((rule.exempt ?? []).some((predicate) => predicate(cand))) continue;
        out.push({
          ...cand,
          message: rule.message ? rule.message(cand) : `${rule.id}: ${cand.match}`,
        });
      }
    }
  }
  return out;
}

function validateAllowlists(rules) {
  for (const rule of rules) {
    for (const entry of rule.allowlist ?? []) {
      if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
        throw new Error(
          `[admin-honesty-gate] allowlist entry without a written reason in rule "${rule.id}" (file: ${entry.file}). ` +
            `Every allowlist entry MUST carry a \`reason\` in plain words.`,
        );
      }
    }
  }
}

function applyAllowlist(rule, candidates) {
  const allow = rule.allowlist ?? [];
  const hits = [];
  let allowlisted = 0;
  for (const cand of candidates) {
    const excused = allow.some(
      (entry) =>
        entry.file === cand.file &&
        (entry.match == null || (cand.lineText ?? "").includes(entry.match)),
    );
    if (excused) {
      allowlisted += 1;
    } else {
      hits.push({ file: cand.file, line: cand.line, message: cand.message });
    }
  }
  hits.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  return { hits, allowlisted };
}

/**
 * Exécute la gate. `opts.rule` restreint à une règle. Retourne, par règle :
 * { id, description, hits: [{file, line, message}], allowlisted }.
 */
export function runGate(opts = {}) {
  const rules = RULES.filter((r) => opts.rule == null || r.id === opts.rule);
  if (opts.rule != null && rules.length === 0) {
    throw new Error(
      `[admin-honesty-gate] unknown rule "${opts.rule}". Known: ${RULES.map((r) => r.id).join(", ")}`,
    );
  }
  validateAllowlists(rules);
  return rules.map((rule) => {
    const ctx = makeCtx(rule);
    let candidates;
    if (rule.check === "line-regex") {
      candidates = runLineRegex(rule, ctx);
    } else if (typeof rule.check === "function") {
      candidates = rule.check(ctx);
    } else {
      throw new Error(`[admin-honesty-gate] rule "${rule.id}" has an invalid \`check\``);
    }
    const { hits, allowlisted } = applyAllowlist(rule, candidates);
    return { id: rule.id, description: rule.description, hits, allowlisted };
  });
}

/* ── Baseline (ratchet) ── */

export function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return { rules: {} };
  }
}

function baselineLimit(baseline, ruleId) {
  const n = baseline.rules?.[ruleId]?.hits;
  return typeof n === "number" ? n : Infinity;
}

function updateBaseline(results, force) {
  const baseline = readBaseline();
  const raises = [];
  for (const res of results) {
    const prev = baselineLimit(baseline, res.id);
    if (res.hits.length > prev) raises.push(`${res.id} ${res.hits.length} > ${prev}`);
  }
  if (raises.length > 0 && !force) {
    console.log(
      C.red(
        `Refusing to RAISE the baseline (${raises.join(", ")}). A ratchet only goes down. ` +
          `Use --force only if you truly accept more debt.`,
      ),
    );
    process.exit(1);
  }
  const next = { updatedAt: new Date().toISOString(), rules: { ...(baseline.rules ?? {}) } };
  for (const res of results) {
    next.rules[res.id] = { hits: res.hits.length };
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(
    C.green(
      `baseline updated → ${results.map((r) => `${r.id} ${r.hits.length}`).join(", ")}`,
    ),
  );
}

/* ── CLI ── */

function main() {
  const argv = process.argv.slice(2);
  const has = (f) => argv.includes(f);
  const ruleIdx = argv.indexOf("--rule");
  const ruleArg = ruleIdx >= 0 ? argv[ruleIdx + 1] : undefined;
  if (ruleIdx >= 0 && (ruleArg == null || ruleArg.startsWith("--"))) {
    console.error(C.red("--rule requires a rule id"));
    process.exit(1);
  }

  let results;
  try {
    results = runGate({ rule: ruleArg });
  } catch (err) {
    console.error(C.red(String(err?.message ?? err)));
    process.exit(1);
  }

  if (has("--update")) {
    updateBaseline(results, has("--force"));
    return;
  }

  const strict = has("--strict");
  const baseline = readBaseline();

  const summary = results.map((res) => {
    const limit = strict ? 0 : baselineLimit(baseline, res.id);
    return { ...res, limit, over: res.hits.length > limit };
  });
  const failed = summary.filter((s) => s.over);

  if (has("--json")) {
    console.log(
      JSON.stringify(
        {
          strict,
          ok: failed.length === 0,
          rules: summary.map((s) => ({
            id: s.id,
            hits: s.hits.length,
            baseline: strict ? null : s.limit === Infinity ? null : s.limit,
            allowlisted: s.allowlisted,
            over: s.over,
            items: s.hits,
          })),
        },
        null,
        2,
      ),
    );
    // process.exitCode (jamais process.exit ici) : exit() tronque un stdout pipé.
    process.exitCode = failed.length > 0 ? 1 : 0;
    return;
  }

  // Sortie hit par hit, triée (fichier, ligne, règle).
  const allHits = summary
    .flatMap((s) => s.hits.map((h) => ({ ...h, id: s.id })))
    .sort((a, b) =>
      a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.id.localeCompare(b.id),
    );
  console.log(C.bold(`admin-honesty-gate${strict ? " (strict)" : " (ratchet)"}`));
  for (const h of allHits) {
    console.log(`${h.file}:${h.line}  ${h.id}  ${h.message}`);
  }

  console.log(C.bold("\n── résumé par règle ──"));
  for (const s of summary) {
    const base = strict ? "strict:0" : s.limit === Infinity ? "no-baseline" : String(s.limit);
    const line = `${s.id.padEnd(18)} ${String(s.hits.length).padStart(4)}/${base}` +
      C.dim(s.allowlisted > 0 ? `  (+${s.allowlisted} allowlisted)` : "");
    console.log(s.over ? C.red(`${line}  FAIL`) : C.green(`${line}  ok`));
    if (!strict && s.hits.length < s.limit && s.limit !== Infinity) {
      console.log(C.yellow(`  ↓ improved — run: node scripts/admin-honesty-gate.mjs --update`));
    }
  }

  if (failed.length > 0) {
    console.log(
      C.red(C.bold("\n✖ admin honesty gate failed")) +
        C.dim(
          strict
            ? "  (strict: any hit fails)"
            : "  (a rule exceeds its baseline — fix the new hits, never raise the baseline)",
        ),
    );
    process.exitCode = 1;
    return;
  }
  console.log(C.green("\n✓ admin honesty gate passed"));
}

const invokedAs = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedAs === SELF) {
  main();
}
