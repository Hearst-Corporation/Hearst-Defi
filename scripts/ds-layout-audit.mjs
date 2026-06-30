#!/usr/bin/env node
/**
 * DS layout guardrails — blocking audit for document-flow anti-patterns.
 * Usage: node scripts/ds-layout-audit.mjs
 * Exit 0 when clean; exit 1 on violations.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** @type {{ file: string; line: number; rule: string; detail: string }[]} */
const violations = [];

const SKIP_DIR = new Set(["node_modules", ".next", "coverage"]);
const SKIP_FILE = /\.(test|spec)\.(tsx?|jsx?)$/;

const warnings = [];

const CT_PILL_ALLOWLIST = new Set([
  "src/app/admin/signals/page.tsx",
  "src/app/admin/vaults/page.tsx",
  "src/app/admin/vaults/_vault-form.tsx",
  "src/app/admin/governance/page.tsx",
  "src/app/admin/projection/studio.tsx",
  "src/components/proof/proof-filter.tsx",
  "src/components/admin/governance/allowlist-board.tsx",
  "src/components/scenario/central-task-runner.tsx"
]);

const BANNED_CLASS_TOKENS = ["ct-table-surface", "ct-hover-surface"];

// ── Brand/colour + shadow invariants (locked after the green restore) ──────────
/** Maroon is rejected as the active brand accent — must never re-enter runtime. */
const MAROON_RE = /#9e1b2e\b|\b158,\s*27,\s*46\b|#8a1538\b/i;
/** One runtime green: success resolves to var(--ct-accent); no hardcoded #16A34A
 *  in web code. Print (PDF) keeps its own green — allowlisted below. */
const SECOND_GREEN_RE = /#16a34a\b/i;
const GREEN_ALLOWLIST = new Set([
  "src/lib/pdf/pdf-palette.ts", // print on white — not web runtime
  "src/lib/brand-constants.ts", // CONNECT_SUCCESS_HEX print/SDK constant
]);
/** The brand green (#A7FB90) must live in CSS as var(--ct-accent), never hardcoded
 *  in TSX/TS — new literals are how the accent drifts out of the token system.
 *  Sole sanctioned homes: the brand SDK constant, the agent-graph canvas (renders
 *  to a <canvas> outside CSS), and the inline-styled transactional email HTML. */
const BRAND_GREEN_HEX_RE = /#a7fb90\b/i;
const BRAND_GREEN_ALLOWLIST = new Set([
  "src/lib/brand-constants.ts", // CONNECT_ACCENT_HEX — JS SDK literal (Privy, etc.)
  "src/components/admin/agents/agent-graph-canvas.tsx", // <canvas> RGB paint, outside CSS
  "src/lib/auth/password-reset.ts", // inline-styled transactional email HTML
  "src/lib/auth/send-welcome-email.ts", // inline-styled transactional email HTML
  "src/lib/inngest/functions/distribution-executed.ts", // inline-styled transactional email HTML
  "src/lib/email/html-shell.ts", // inline-styled transactional email HTML
]);
/** Use tokenized DS shadows (shadow-[var(--ct-shadow-*)]) — never raw Tailwind. */
const RAW_SHADOW_RE = /\bshadow-(?:sm|md|lg|xl|2xl|inner)\b/g;
/** Selection controls go through <SegmentedControl> / <Tab>, not raw ct-seg-* classes. */
const RAW_SEG_RE = /\bct-seg-(?:btn|track)\b/g;
const SEG_ALLOWLIST = new Set([
  "src/components/ui/segmented-control.tsx", // the primitive — owns ct-seg-* classes
  "src/components/catalyst/segmented-control.tsx", // canonical primitive defining ct-seg-*
]);

// ── Token-scale invariants (CSS) — every blur/easing/duration goes through a
//    --ct-* token. Raw values are how agents drift the scale; block at the gate. ──
/** Raw blur() radius in a rule — must be var(--ct-blur-*). */
const RAW_BLUR_RE = /\bblur\(\s*[\d.]/g;
/** Raw cubic-bezier() in a rule — must be var(--ct-ease) / var(--ct-ease-in-out). */
const RAW_CUBIC_RE = /\bcubic-bezier\(/g;
/** Raw transition/animation duration literal (e.g. 0.2s, 300ms) — must be var(--ct-dur-*). */
const RAW_DUR_RE = /(?:transition(?:-duration)?|animation(?:-duration)?)\s*:[^;]*?\b\d[\d.]*m?s\b/g;
/** Forbidden second token namespace (the removed @ds/core). */
const DS_NAMESPACE_RE = /--ds-[a-z]/gi;
/** Hardcoded hex colour in a rule body (not a --ct-* token definition). */
const RAW_HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

/** Files allowed to hold raw hex (non-CSS-runtime contexts): email HTML strings,
 *  PDF/print palettes, brand SDK constants. These never reach the web cascade. */
const HEX_ALLOWLIST = new Set([
  "src/lib/auth/password-reset.ts",
  "src/lib/inngest/functions/distribution-executed.ts",
  "src/lib/pdf/pdf-palette.ts",
  "src/lib/brand-constants.ts",
  "src/lib/data/allocation-colors.ts",
  // Print-on-white ink palette (analogous to pdf-palette.ts): the report print
  // surface renders on white paper, where dark-mode --ct-* tokens are invisible.
  "src/app/admin/product-workspace/report/print/page.tsx",
  // Standalone server-rendered HTML (one-click unsubscribe page) opened from a
  // mail client — the Cockpit shell / cockpit.css is never loaded, so --ct-*
  // vars would resolve to nothing. Same rationale as the email allowlist.
  "src/app/api/outreach/unsubscribe/route.ts",
  // These carry "#211"/"#216"/"#148"/"#150" — PR / config-id references inside
  // STRINGS and prose, not colours. Hex regex (3 hex digits) matches them by
  // accident; this is non-UI server/lib code, no runtime colour involved.
  "src/lib/admin/diagnostics/outreach-diagnostics.ts",
  "src/lib/admin/diagnostics/outreach-lifecycle.ts",
  "src/lib/projection/assumptions-config.ts",
  // "#ccc" here is an ATTRIBUTE-SELECTOR KEY targeting Recharts' default DOM
  // (`[stroke='#ccc']`); the colour actually applied is already a token
  // (stroke-[var(--ct-border-soft)]). Removing the hex breaks the selector.
  "src/components/ui/chart.tsx",
]);
/** Transactional-email HTML files. Inline mail styles cannot read CSS vars — mail
 *  clients strip them — so neutral greys (#9ca3af / #6b7280 / #0a0a0a) and the
 *  interpolated brand hex are intentional and unfixable. Raw-hex is skipped here.
 *  NOTE: literal greens elsewhere stay flagged — second-green/#16a34a and the
 *  brand-green/#a7fb90 scans run with their own allowlists, not this one. */
const EMAIL_FILE_ALLOWLIST = new Set([
  "src/lib/auth/send-welcome-email.ts",
  "src/lib/auth/password-reset.ts",
  "src/lib/inngest/functions/distribution-executed.ts",
  "src/lib/email/html-shell.ts",
]);
/** #000 / #fff (and 6-digit forms) are idiomatic color-mix() bases and the
 *  canonical pure black/white — never a design-token drift. Skip them in raw-hex. */
const NEUTRAL_HEX_RE = /^#(?:000|fff|000000|ffffff)$/i;
/** A line that DEFINES a --ct-* token may contain a literal value — that is the
 *  one sanctioned home for raw px/hex/blur. Detect "  --ct-...:" anywhere on line. */
const TOKEN_DEF_LINE = /--ct-[a-z0-9_-]+\s*:/i;
/** Strip CSS comment bodies so hex/values mentioned in prose are not flagged.
 *  Handles full-line and inline /* … *​/ (incl. comments spanning the line). */
function stripComments(line, inBlockRef) {
  let out = "";
  let inBlock = inBlockRef.v;
  for (let i = 0; i < line.length; i++) {
    if (inBlock) {
      if (line[i] === "*" && line[i + 1] === "/") { inBlock = false; i++; }
      continue;
    }
    if (line[i] === "/" && line[i + 1] === "*") { inBlock = true; i++; continue; }
    // `//` line comment (TSX/TS) — drop the rest; guard `://` so URLs survive.
    if (line[i] === "/" && line[i + 1] === "/" && out[out.length - 1] !== ":") break;
    out += line[i];
  }
  inBlockRef.v = inBlock;
  return out;
}
/** Reduced-motion reset values (≤1ms, 0.01ms) are a11y cancellations, not design
 *  durations — never flag them. */
const REDUCED_MOTION_DUR = /\b0?\.?0*1?m?s\b/; // 1ms, 0.01ms, 0.001s, etc. (tiny)

/** Only Card primitive may bind `.ct-card` directly. */
const CT_CARD_ALLOWLIST = new Set([
  "src/components/ui/card.tsx",
  "src/components/catalyst/card.tsx", // the canonical <Card> primitive — owns .ct-card
]);

const HUB_MODE_STYLES = "src/components/hub-mode-styles.tsx";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, out);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(name) && !SKIP_FILE.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanBannedClasses(rel, content) {
  for (const token of BANNED_CLASS_TOKENS) {
    let from = 0;
    while (true) {
      const idx = content.indexOf(token, from);
      if (idx === -1) break;
      violations.push({
        file: rel,
        line: lineNumberAt(content, idx),
        rule: "banned-class",
        detail: `Forbidden class token "${token}" — use Card + ct-table-cell rows or doc-flow stacks`,
      });
      from = idx + token.length;
    }
  }
}

function scanDirectCtCard(rel, content) {
  if (CT_CARD_ALLOWLIST.has(rel) || rel === HUB_MODE_STYLES) return;

  const re = /\bct-card\b(?!-)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    violations.push({
      file: rel,
      line: lineNumberAt(content, match.index),
      rule: "direct-ct-card",
      detail:
        'Use <Card> from @/components/ui/card instead of className "ct-card"',
    });
  }
}

function scanStaticCtPill(rel, content) {
  if (CT_PILL_ALLOWLIST.has(rel)) return;
  const re = /\bct-pill\b/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    // Skip mentions inside comments/JSDoc (the token name appears in prose, not
    // as a className). Check the line: if it starts with * or // or contains /*,
    // it's a comment, not code.
    const lineStart = content.lastIndexOf("\n", match.index) + 1;
    const lineHead = content.slice(lineStart, match.index).trimStart();
    if (lineHead.startsWith("*") || lineHead.startsWith("//") || lineHead.startsWith("/*")) continue;
    // ct-pill IS allowed on interactive elements (the rule's own exception).
    // Skip when the enclosing element is a Link/button or carries an interactive
    // ARIA role (role="tab", aria-selected, onClick) within the same JSX element
    // — i.e. it's a real filter/tab, not a static label. We look back to the
    // opening "<" of the element holding the className.
    const elStart = content.lastIndexOf("<", match.index);
    const ctx = elStart === -1 ? "" : content.slice(elStart, match.index + 200);
    const interactive =
      /<(Link|button|a)\b/i.test(ctx) ||
      /\brole=["'](tab|button|link|menuitem)["']/.test(ctx) ||
      /\baria-selected\b/.test(ctx) ||
      /\bonClick\b/.test(ctx);
    if (interactive) continue;
    warnings.push({
      file: rel,
      line: lineNumberAt(content, match.index),
      rule: "static-ct-pill",
      detail: "Use <Badge> for static pills. ct-pill is only for interactive filters.",
    });
  }
}

function scanButtonNoSize(rel, content) {
  // The Catalyst <Button> (@/components/catalyst/button — Headless UI based) has
  // NO `size` prop: its API is color/outline/plain/insetRing/iconOnly. Only the
  // CockpitButton family takes `size`. So a file whose <Button> is imported from
  // a catalyst/button path can never satisfy `size=` — flagging it is a false
  // positive (adding the prop is a TS error). Skip those files.
  const importsCatalystButton =
    /import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*["'](?:@\/components\/catalyst\/button|\.\/button|\.\.\/button)["']/.test(
      content,
    );
  if (importsCatalystButton) return;

  // JSX <Button> only lives in .tsx. A .ts file matching "<Button" is prose in a
  // comment/string (e.g. a classHint doc string), never a real element.
  if (!rel.endsWith(".tsx")) return;

  const re = /<Button\b([\s\S]*?)>/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    // Skip a "<Button …>" that sits inside a string literal (doc hints like
    // classHint="<Button variant size />") — the char before "<" is a quote.
    const before = content[match.index - 1];
    if (before === '"' || before === "'" || before === "`") continue;
    if (!match[1].includes("size=")) {
      warnings.push({
        file: rel,
        line: lineNumberAt(content, match.index),
        rule: "button-no-size",
        detail: "Button without explicit size= prop. Default is md, but should be explicit.",
      });
    }
  }
}

function scanMaroon(rel, content) {
  const re = new RegExp(MAROON_RE.source, "gi");
  let m;
  while ((m = re.exec(content)) !== null) {
    violations.push({
      file: rel,
      line: lineNumberAt(content, m.index),
      rule: "maroon-runtime",
      detail: `Maroon "${m[0]}" is rejected as brand accent — use var(--ct-accent) (#A7FB90).`,
    });
  }
}

function scanSecondGreen(rel, content) {
  if (GREEN_ALLOWLIST.has(rel)) return;
  const re = new RegExp(SECOND_GREEN_RE.source, "gi");
  let m;
  while ((m = re.exec(content)) !== null) {
    violations.push({
      file: rel,
      line: lineNumberAt(content, m.index),
      rule: "second-green",
      detail:
        "Hardcoded #16A34A — there is one runtime green. Use var(--ct-status-success) (resolves to --ct-accent).",
    });
  }
}

function scanBrandGreenHardcode(rel, content) {
  if (BRAND_GREEN_ALLOWLIST.has(rel)) return;
  const lines = content.split("\n");
  const block = { v: false };
  for (let i = 0; i < lines.length; i++) {
    const code = stripComments(lines[i], block); // comment mentions are fine
    BRAND_GREEN_HEX_RE.lastIndex = 0;
    const m = BRAND_GREEN_HEX_RE.exec(code);
    if (m) {
      violations.push({
        file: rel,
        line: i + 1,
        rule: "hardcoded-brand-green",
        detail:
          `Hardcoded brand green "${m[0]}" — use var(--ct-accent) in CSS, not a literal in TSX/TS.`,
      });
    }
  }
}

function scanRawShadow(rel, content) {
  RAW_SHADOW_RE.lastIndex = 0;
  let m;
  while ((m = RAW_SHADOW_RE.exec(content)) !== null) {
    violations.push({
      file: rel,
      line: lineNumberAt(content, m.index),
      rule: "raw-shadow",
      detail: `Raw Tailwind "${m[0]}" — use shadow-[var(--ct-shadow-soft|elevated|inset)].`,
    });
  }
}

function scanRawSeg(rel, content) {
  if (SEG_ALLOWLIST.has(rel)) return;
  RAW_SEG_RE.lastIndex = 0;
  let m;
  while ((m = RAW_SEG_RE.exec(content)) !== null) {
    warnings.push({
      file: rel,
      line: lineNumberAt(content, m.index),
      rule: "raw-seg",
      detail:
        "Use <SegmentedControl>/<Tab> from @/components/ui/segmented-control instead of raw ct-seg-* classes.",
    });
  }
}

/** Generic line-scanner: flags every match of `re` whose line is NOT a --ct-*
 *  token definition, ignoring comment bodies. Used for blur/easing/duration. */
function scanRawTokenScale(rel, content, re, rule, detail, skipReducedMotion = false) {
  const lines = content.split("\n");
  const block = { v: false };
  for (let i = 0; i < lines.length; i++) {
    const code = stripComments(lines[i], block);
    if (TOKEN_DEF_LINE.test(code)) continue; // a token definition — sanctioned home
    if (skipReducedMotion && REDUCED_MOTION_DUR.test(code)) continue; // a11y reset, not design
    re.lastIndex = 0;
    if (re.test(code)) {
      violations.push({ file: rel, line: i + 1, rule, detail });
    }
  }
}

function scanDsNamespace(rel, content) {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    DS_NAMESPACE_RE.lastIndex = 0;
    const m = DS_NAMESPACE_RE.exec(lines[i]);
    if (m) {
      violations.push({
        file: rel,
        line: i + 1,
        rule: "ds-namespace",
        detail: `Forbidden "${m[0]}…" — the @ds/core namespace was removed. Use --ct-* tokens only.`,
      });
    }
  }
}

function scanRawHexCss(rel, content) {
  if (HEX_ALLOWLIST.has(rel)) return;
  if (EMAIL_FILE_ALLOWLIST.has(rel)) return; // inline mail HTML cannot read CSS vars
  const lines = content.split("\n");
  const block = { v: false };
  for (let i = 0; i < lines.length; i++) {
    const code = stripComments(lines[i], block);
    if (TOKEN_DEF_LINE.test(code)) continue; // token def may hold a literal hex
    RAW_HEX_RE.lastIndex = 0;
    let m;
    while ((m = RAW_HEX_RE.exec(code)) !== null) {
      if (NEUTRAL_HEX_RE.test(m[0])) continue; // #000/#fff color-mix base — idiomatic
      violations.push({
        file: rel,
        line: i + 1,
        rule: "raw-hex",
        detail: `Hardcoded colour "${m[0]}" outside a token definition — use a var(--ct-*) token.`,
      });
    }
  }
}

// ── Opacity invariant ── every non-trivial opacity goes through the
//    --ct-opacity-* scale (cockpit-shell/tokens.css). Bare Tailwind opacity-NN
//    (≠ 0/100) and literal opacity/stroke|fill|stopOpacity values are how the
//    scale drifts; block them in TSX/TS. 0 and 1 stay free (fade/animation). ──
const OPACITY_ALLOWLIST = new Set([
  // dataviz: opacity encodes the margin-score intensity — pure, exported, tested.
  "src/components/dashboard/mining-health.tsx",
  // SVG/recharts gradient stops: the top/bottom fade pairs (0.8↔0.1, 0.22↔0.04)
  // have no full token coverage on the --ct-opacity-* scale; tokenising only one
  // end leaves a half-token/half-literal gradient. Left whole + intentional.
  "src/components/admin/product-workspace/chart-gallery.tsx",
  "src/components/admin/product-workspace/projection-area-chart.tsx",
]);
const RAW_OPACITY_CLASS_RE = /\bopacity-(\d{1,3})\b/;
const RAW_OPACITY_VALUE_RE = /\b(?:stroke|fill|stop)?[Oo]pacity\s*[=:][^;,"'`\n]*?(0?\.\d+)\b/;
function scanRawOpacity(rel, content) {
  if (OPACITY_ALLOWLIST.has(rel)) return;
  const lines = content.split("\n");
  const block = { v: false };
  for (let i = 0; i < lines.length; i++) {
    let code = stripComments(lines[i], block);
    code = code.replace(/var\(--ct-opacity-\d+\)/g, ""); // tokenised usage — not a drift
    const mc = RAW_OPACITY_CLASS_RE.exec(code);
    if (mc && mc[1] !== "0" && mc[1] !== "100") {
      violations.push({ file: rel, line: i + 1, rule: "raw-opacity",
        detail: `Bare "opacity-${mc[1]}" — use opacity-[var(--ct-opacity-${mc[1]})].` });
      continue;
    }
    const mv = RAW_OPACITY_VALUE_RE.exec(code);
    if (mv) {
      violations.push({ file: rel, line: i + 1, rule: "raw-opacity",
        detail: `Literal opacity "${mv[1]}" — use var(--ct-opacity-*).` });
    }
  }
}

for (const abs of walk(SRC)) {
  const rel = relative(ROOT, abs).replaceAll("\\", "/");
  const content = readFileSync(abs, "utf8");
  // colour/shadow invariants run on every file (incl. CSS for maroon).
  scanMaroon(rel, content);
  scanDsNamespace(rel, content); // --ds-* forbidden everywhere
  if (rel.endsWith(".css")) {
    // CSS-only token-scale invariants: blur / easing / duration / hex must be tokens.
    scanRawTokenScale(rel, content, RAW_BLUR_RE, "raw-blur",
      "Raw blur() radius — use var(--ct-blur-*).");
    scanRawTokenScale(rel, content, RAW_CUBIC_RE, "raw-easing",
      "Raw cubic-bezier() — use var(--ct-ease) or var(--ct-ease-in-out).");
    scanRawTokenScale(rel, content, RAW_DUR_RE, "raw-duration",
      "Raw transition/animation duration literal — use var(--ct-dur-*).", true);
    scanRawHexCss(rel, content);
    continue; // class/component scans are code-only
  }
  scanBannedClasses(rel, content);
  scanDirectCtCard(rel, content);
  scanStaticCtPill(rel, content);
  scanButtonNoSize(rel, content);
  scanSecondGreen(rel, content);
  scanBrandGreenHardcode(rel, content); // new #A7FB90 literals in TSX/TS → fail
  scanRawShadow(rel, content);
  scanRawSeg(rel, content);
  scanRawHexCss(rel, content);   // hex literals forbidden in TSX/TS too (var(--ct-*) only)
  scanRawOpacity(rel, content);  // opacity must route through --ct-opacity-*
}

// ── Cockpit DS is now a LOCAL, editable copy (dé-vendoré from @hearst/cockpit-shell).
//    The maroon brand must never re-enter the canon — guard it on the local source
//    (tokens.css AND the shell JS). cockpit-shell/ lives outside src/, so scan it
//    explicitly. Maroon here is a VIOLATION: there is no stale tarball left to excuse. ──
{
  const COCKPIT_DIR = join(ROOT, "cockpit-shell");
  if (existsSync(COCKPIT_DIR)) {
    for (const abs of walk(COCKPIT_DIR)) {
      const rel = relative(ROOT, abs).replaceAll("\\", "/");
      const content = readFileSync(abs, "utf8");
      scanMaroon(rel, content);      // #8a1538 / #9e1b2e → violation, anywhere in the DS
      scanDsNamespace(rel, content); // the removed --ds-* namespace is forbidden here too
    }
  } else {
    warnings.push({
      file: "cockpit-shell/",
      line: 0,
      rule: "cockpit-local-not-found",
      detail:
        "WARNING: cockpit-shell/ local DS copy not found — maroon guard cannot run. Did the dé-vendoring revert?",
    });
  }
}

if (warnings.length > 0) {
  console.warn("⚠️  ds-layout-audit — warnings found:\n");
  for (const w of warnings) {
    console.warn(`  ${w.file}:${w.line} [${w.rule}] ${w.detail}`);
  }
  console.warn(`\nTotal warnings: ${warnings.length}\n`);
}

if (violations.length === 0) {
  console.log("✅ ds-layout-audit — no violations");
  process.exit(0);
}

console.error("❌ ds-layout-audit — violations found:\n");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.detail}`);
}
console.error(`\nTotal: ${violations.length}`);
process.exit(1);
