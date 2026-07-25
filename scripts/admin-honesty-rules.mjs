/**
 * scripts/admin-honesty-rules.mjs — GATE HONNÊTETÉ /admin : les règles comme DONNÉES.
 *
 * Le moteur (scripts/admin-honesty-gate.mjs) ne connaît AUCUNE règle en dur :
 * tout ce qui est vérifié vit ici, dans le tableau `RULES`. Le lot DS ajoutera
 * ses règles de dialecte comme de simples entrées supplémentaires.
 *
 * Forme d'une règle :
 *   {
 *     id:                identifiant stable (clé de baseline),
 *     description:       ce que la règle protège, en une phrase,
 *     scope:             liste de répertoires (rel) OU fn(relPath) => bool,
 *     check:             "line-regex" (générique) OU fn(ctx) => candidats[],
 *     pattern:           RegExp (check "line-regex" uniquement),
 *     stringContextOnly: true → le pattern ne s'applique qu'aux contextes
 *                        chaîne (littéraux quotés + texte JSX), jamais aux
 *                        identifiants de code,
 *     message:           fn(candidat) => message humain,
 *     exempt:            prédicats évalués AVANT l'allowlist — un candidat
 *                        exempté ne compte pas et n'a pas besoin d'allowlist,
 *     allowlist:         [{ file, match?, reason }] — CHAQUE entrée porte un
 *                        `reason` en toutes lettres (le moteur refuse sinon).
 *   }
 *
 * Un candidat (hit potentiel) : { file, line, lineText, match, context?, indexInContext? }.
 */

/** Périmètre admin par défaut (fichiers .ts/.tsx/.css ; __tests__ et *.test.* exclus). */
export const ADMIN_SCOPE_DIRS = [
  "src/app/admin",
  "src/views/admin",
  "src/views/_shared",
  "src/components/admin",
  "src/lib/admin",
  "src/ui",
];

// CSS réellement chargés au runtime pour /admin — vérifié 2026-07-26 :
// src/app/layout.tsx importe @/styles/app.css (→ theme.css + legacy-bridge.css
// + typography.css si présent) ; src/app/admin/layout.tsx importe
// ./admin-canon.css. cockpit.css et globals.css ne sont chargés QUE par
// Storybook — ne PAS les ajouter ici tant que l'app ne les importe pas.
export const RUNTIME_CSS = [
  // app.css est L'ENTRÉE importée par src/app/layout.tsx : ses propres règles
  // (@layer components : hc-page, hc-metric-*, …) sont chargées au même titre
  // que ses imports — les compter comme fantômes serait un faux positif
  // (arbitrage intégrateur 2026-07-26, signalement Z2 n°4).
  "src/styles/app.css",
  "src/styles/theme.css",
  "src/styles/legacy-bridge.css",
  "src/styles/typography.css",
  "src/app/admin/admin-canon.css",
];

/* ────────────────────────────────────────────────────────────────────────────
 * (a) phantom-tokens — un token/classe utilisé dans le périmètre mais défini
 *     dans AUCUN CSS réellement chargé au runtime = un mensonge visuel : le
 *     style n'existe pas à l'écran. Les définitions sont RE-RÉSOLUES à chaque
 *     run (l'absence d'un fichier de RUNTIME_CSS est tolérée — typography.css
 *     arrive dans un autre lot de cette vague).
 * ──────────────────────────────────────────────────────────────────────────── */

const VAR_DEF_RE = /--ct-[\w-]+(?=\s*:)/g;
const CLASS_DEF_RE = /\.((?:ct|hc)-[\w-]+)/g;
// Usage var : syntaxe CSS `var(--ct-X)` ET utilitaire Tailwind v4 `bg-(--ct-X)`.
const VAR_USE_CSS_RE = /var\(\s*(--ct-[\w-]+)/g;
const VAR_USE_TW_RE = /(?<=[\w\]])-\(\s*(--ct-[\w-]+)/g;
// Classes : uniquement les classes maison ct-*/hc-* (jamais les utilitaires
// Tailwind) ; le lookbehind écarte `--ct-x`, `-(--ct-x)` et les mots composés.
const CLASS_USE_RE = /(?<![\w-])((?:ct|hc)-[\w-]+)/g;

function checkPhantomTokens(ctx) {
  const definedVars = new Set();
  const definedClasses = new Set();
  for (const rel of RUNTIME_CSS) {
    const css = ctx.readScan(rel); // readScan : commentaires CSS neutralisés
    if (css == null) continue; // absence tolérée (typography.css pas encore livré)
    for (const m of css.matchAll(VAR_DEF_RE)) definedVars.add(m[0]);
    for (const m of css.matchAll(CLASS_DEF_RE)) definedClasses.add(m[1]);
  }

  const candidates = [];
  for (const rel of ctx.scopeFiles) {
    const src = ctx.readScan(rel);
    if (src == null) continue;
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      for (const re of [VAR_USE_CSS_RE, VAR_USE_TW_RE]) {
        for (const m of lineText.matchAll(re)) {
          if (!definedVars.has(m[1])) {
            candidates.push({
              file: rel,
              line: i + 1,
              lineText,
              match: m[1],
              message: `phantom token ${m[1]} — used here but defined in none of the runtime-loaded CSS (RUNTIME_CSS)`,
            });
          }
        }
      }
      // Classes ct-*/hc-* : contextes chaîne uniquement (className, cx, …) ;
      // pas dans les .css (un sélecteur y est une définition, pas un usage).
      if (!rel.endsWith(".css")) {
        for (const c of ctx.stringContexts(lineText)) {
          if (c.kind !== "string") continue;
          for (const m of c.text.matchAll(CLASS_USE_RE)) {
            if (!definedClasses.has(m[1])) {
              candidates.push({
                file: rel,
                line: i + 1,
                lineText,
                match: m[1],
                message: `phantom class ${m[1]} — used here but defined in none of the runtime-loaded CSS (RUNTIME_CSS)`,
              });
            }
          }
        }
      }
    }
  }
  return candidates;
}

/* ────────────────────────────────────────────────────────────────────────────
 * (b) banned-vocab — le vocabulaire produit interdit (yield/APY/coupon/
 *     distribution) dans du texte DESTINÉ À L'ŒIL : littéraux chaîne et texte
 *     JSX. Les identifiants de code sont exclus par construction (on ne
 *     scanne que les contextes chaîne). Exceptions en PRÉDICATS, avant
 *     l'allowlist.
 * ──────────────────────────────────────────────────────────────────────────── */

/** (1) machine-token : la chaîne ENTIÈRE est un token machine (id d'action,
 *  chemin, slug) — ex. "distribution.approve", "mining_yield", "/admin/x". */
function isMachineToken(cand) {
  return (
    cand.context?.kind === "string" &&
    /^[a-z0-9_.:/\[\]-]+$/.test(cand.context.text)
  );
}

/** (2) négation : fenêtre de 6 mots avant le match contenant une négation ou
 *  un marqueur de retrait — « no distributions », « legacy distribution
 *  records », « retired yield rail » parlent d'honnêteté, pas de promesse. */
function hasNegationBefore(cand) {
  const before =
    cand.context != null
      ? cand.context.text.slice(0, cand.indexInContext)
      : cand.lineText.slice(0, cand.matchIndex ?? 0);
  const window = before
    .split(/[^A-Za-z0-9'’-]+/)
    .filter(Boolean)
    .slice(-6)
    .join(" ");
  return /\b(no|not|never|without|non|retired|legacy|zero)\b/i.test(window);
}

/* ────────────────────────────────────────────────────────────────────────────
 * (c) unmarked-fiction — trois formes de fiction non marquée :
 *     c1  status codé en dur ("Live"/"Partial"/"Blocked") dans src/app/admin/**
 *         — un statut se MESURE, il ne se déclare pas dans un littéral ;
 *     c2  coercition de provenance : une prop `provenance` qui passe par un
 *         ternaire fabrique une provenance — elle doit être transmise, jamais
 *         décidée côté rendu ;
 *     c3  catch → zéro dans src/lib/data/** + src/lib/admin/** : un catch qui
 *         retourne [], 0 ou un objet contenant `: 0` fabrique une donnée.
 *         `return null` / `return undefined` sont EXEMPTS par construction :
 *         une absence signalée n'est pas un zéro fabriqué.
 * ──────────────────────────────────────────────────────────────────────────── */

const C1_RE = /status:\s*"(Live|Partial|Blocked)"/g;
const C2_RE = /provenance=\{[^}]*\?[^}]*\}/g;

function checkUnmarkedFiction(ctx) {
  const candidates = [];

  // c1 — src/app/admin/** uniquement.
  for (const rel of ctx.scopeFiles) {
    if (!rel.startsWith("src/app/admin/")) continue;
    const src = ctx.read(rel);
    if (src == null) continue;
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(C1_RE)) {
        candidates.push({
          file: rel,
          line: i + 1,
          lineText: lines[i],
          match: m[0],
          message: `unmarked fiction (c1): hardcoded status "${m[1]}" — a status is measured, never declared as a literal`,
        });
      }
    }
  }

  // c2 — périmètre entier, motif appliqué sur la SOURCE JOINTE (la prop
  // s'étale sur plusieurs lignes) ; la ligne rapportée est celle du début.
  for (const rel of ctx.scopeFiles) {
    if (rel.endsWith(".css")) continue;
    const src = ctx.read(rel);
    if (src == null) continue;
    for (const m of src.matchAll(C2_RE)) {
      const line = src.slice(0, m.index).split("\n").length;
      const lineText = src.split("\n")[line - 1] ?? "";
      candidates.push({
        file: rel,
        line,
        lineText,
        match: m[0].slice(0, 60),
        message:
          "unmarked fiction (c2): provenance coerced through a ternary — provenance is passed through, never fabricated at render time",
      });
    }
  }

  // c3 — src/lib/data/** + src/lib/admin/** : catch suivi dans les 5 lignes
  // d'un return dont l'expression est [], 0, ou un objet littéral avec `: 0`.
  const c3Files = [...ctx.listDir("src/lib/data"), ...ctx.listDir("src/lib/admin")].filter(
    (rel) => rel.endsWith(".ts") || rel.endsWith(".tsx"),
  );
  const seen = new Set();
  for (const rel of c3Files) {
    const src = ctx.read(rel);
    if (src == null) continue;
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!/\bcatch\b/.test(lines[i])) continue;
      // fenêtre : la ligne du catch + les 5 suivantes
      for (let j = i; j <= Math.min(i + 5, lines.length - 1); j++) {
        const retMatch = /\breturn\b([^;]*)/.exec(lines[j]);
        if (!retMatch) continue;
        // expression du return : jusqu'au premier `;` (fenêtre de 3 lignes max)
        let expr = retMatch[1];
        for (let k = j + 1; k <= Math.min(j + 3, lines.length - 1) && !expr.includes(";") && !lines[k - 1].includes(";"); k++) {
          expr += " " + lines[k];
        }
        expr = expr.split(";")[0].trim();
        const isZero =
          /^\[\]\s*$/.test(expr) ||
          /^0\s*$/.test(expr) ||
          (expr.startsWith("{") && /:\s*0\b/.test(expr));
        if (!isZero) continue;
        const key = `${rel}:${j + 1}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          file: rel,
          line: j + 1,
          lineText: lines[j],
          match: expr.slice(0, 40),
          message: `unmarked fiction (c3): catch returns a fabricated zero (${expr.slice(0, 40)}) — absent data is unavailable/null, never 0`,
        });
      }
    }
  }

  return candidates;
}

/* ────────────────────────────────────────────────────────────────────────────
 * (d) raw-env — clôture transitive des imports depuis les entrées runtime
 *     /admin (pages, layouts, routes API admin). Dans cette clôture, tout
 *     `process.env.X` (X ≠ NODE_ENV) hors du canon Zod (src/lib/env.ts et son
 *     co-schéma src/lib/vaults/min-ticket.ts) est un accès env sauvage.
 * ──────────────────────────────────────────────────────────────────────────── */

const RAW_ENV_EXEMPT = new Set(["src/lib/env.ts", "src/lib/vaults/min-ticket.ts"]);
const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
const ENV_USE_RE = /process\.env\.(?!NODE_ENV\b)([A-Za-z_$][\w$]*)/g;

function resolveImport(fromRel, spec, ctx) {
  let base;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) {
    const dir = fromRel.split("/").slice(0, -1).join("/");
    const parts = (dir + "/" + spec).split("/");
    const stack = [];
    for (const p of parts) {
      if (p === "." || p === "") continue;
      else if (p === "..") stack.pop();
      else stack.push(p);
    }
    base = stack.join("/");
  } else return null; // node_modules, server-only → ignorés
  if (base.endsWith(".css") || base.endsWith(".json")) return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if ((cand.endsWith(".ts") || cand.endsWith(".tsx")) && ctx.exists(cand)) return cand;
  }
  return null;
}

function checkRawEnv(ctx) {
  const entries = [
    ...ctx
      .listDir("src/app/admin")
      .filter((rel) => rel.endsWith("/page.tsx") || rel.endsWith("/layout.tsx")),
    ...ctx.listDir("src/app/api/admin").filter((rel) => rel.endsWith("/route.ts")),
  ];
  const closure = new Set(entries);
  const queue = [...entries];
  while (queue.length > 0) {
    const rel = queue.shift();
    const src = ctx.read(rel);
    if (src == null) continue;
    for (const m of src.matchAll(IMPORT_RE)) {
      const resolved = resolveImport(rel, m[1], ctx);
      if (resolved != null && !closure.has(resolved)) {
        closure.add(resolved);
        queue.push(resolved);
      }
    }
  }

  const candidates = [];
  for (const rel of [...closure].sort()) {
    if (RAW_ENV_EXEMPT.has(rel)) continue;
    const src = ctx.read(rel);
    if (src == null) continue;
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(ENV_USE_RE)) {
        candidates.push({
          file: rel,
          line: i + 1,
          lineText: lines[i],
          match: `process.env.${m[1]}`,
          message: `raw process.env.${m[1]} inside the admin runtime closure — declare it in the Zod canon (src/lib/env.ts)`,
        });
      }
    }
  }
  return candidates;
}

/* ──────────────────────────────────────────────────────────────────────────── */

export const RULES = [
  {
    id: "phantom-tokens",
    description:
      "Tokens --ct-* et classes ct-*/hc-* utilisés dans le périmètre admin mais définis dans aucun CSS chargé au runtime (style fantôme = mensonge visuel).",
    scope: ADMIN_SCOPE_DIRS,
    check: checkPhantomTokens,
    allowlist: [],
  },
  {
    id: "banned-vocab",
    description:
      "Vocabulaire produit interdit (yield/APY/coupon/distribution) dans les contextes chaîne — Series 1 = inventaire BTC, jamais un rendement.",
    scope: ADMIN_SCOPE_DIRS,
    check: "line-regex",
    pattern: /\b(yield|apy|coupon|distribution)s?\b/i,
    stringContextOnly: true,
    message: (cand) =>
      `banned vocabulary "${cand.match}" in ${cand.context?.kind === "jsx" ? "JSX text" : "a string literal"} — Series 1 is BTC inventory, not yield`,
    exempt: [isMachineToken, hasNegationBefore],
    allowlist: [
      {
        file: "src/app/admin/distributions/page.tsx",
        match: '@/views/admin/distributions-view',
        reason:
          "Import du composant de la route legacy /admin/distributions — archive read-only de records historiques, pas du vocabulaire produit.",
      },
      {
        file: "src/views/admin/distributions-view.tsx",
        match: "@/lib/admin/distributions-kpi-strip",
        reason:
          "Import du helper KPI de l'archive legacy /admin/distributions — chemin de module historique, pas du vocabulaire produit.",
      },
      {
        file: "src/views/admin/distributions-view.tsx",
        match: "Hearst Yield Vault",
        reason:
          "LEGACY_VAULT_LABELS — nom historique d'archive d'un vault retiré, affiché tel quel dans l'archive read-only pour continuité d'audit.",
      },
    ],
  },
  {
    id: "unmarked-fiction",
    description:
      "Fiction non marquée : status codés en dur (c1), provenance coercée par ternaire (c2), catch qui retourne un zéro fabriqué (c3).",
    scope: ADMIN_SCOPE_DIRS,
    check: checkUnmarkedFiction,
    // c2 : cette allowlist est VIDE et DOIT LE RESTER — une coercition de
    // provenance ne s'excuse pas, elle se corrige (on transmet la provenance
    // réelle, on ne la fabrique jamais au rendu). Ne rien ajouter ici.
    allowlist: [],
  },
  {
    id: "raw-env",
    description:
      "process.env.* sauvage (hors NODE_ENV) dans la clôture d'imports runtime de /admin — toute variable serveur se déclare dans src/lib/env.ts (Zod).",
    scope: ADMIN_SCOPE_DIRS,
    check: checkRawEnv,
    allowlist: [],
  },
];
