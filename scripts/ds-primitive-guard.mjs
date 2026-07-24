#!/usr/bin/env node
/**
 * ds-primitive-guard.mjs — Anti-regression for the Catalyst PRIMITIVE convergence
 * (Series1 target-map, "Earth = Hearst"). Where ds-convergence-guard.mjs polices
 * tokens (accent hex, px sizes, ui/ direction), THIS guard polices STRUCTURE: it
 * detects UI primitives hand-rolled inline inside the Series1 / product surfaces
 * instead of delegating to the sanctioned Catalyst primitive.
 *
 * The convergence rule: Catalyst is the single authority for a primitive. A chip
 * is BentoBadge / WiredChip. A card frame is Catalyst <Card> (or the documented
 * surfaceClassName bridge). A label/value row is Metric / Series1RowBase / Table.
 * A numbered rail is the Catalyst Stepper. Re-welding any of these inline reverses
 * the convergence — that is what this guard catches.
 *
 * Three detectors, scoped to src/components/series1-* and src/app/(product):
 *   (a) chip     — <span> with inline-flex + rounded-full + ring, the BentoBadge/
 *                  WiredChip shape recreated by hand.
 *   (b) stepper  — a hand-rolled numbered vertical rail: a zero-padded
 *                  String(...).padStart(2,"0") node next to a `w-px … flex-1` spine,
 *                  outside catalyst/stepper.tsx.
 *   (c) row      — a repeated label/value flex row (justify-between with a muted
 *                  label + a tabular value) recreated outside Metric/Series1RowBase.
 *
 * HIS / dataviz charts are EXEMPT (SVG data-viz is its own system, not a Catalyst
 * primitive). The Catalyst primitive definitions themselves and the documented
 * surfaceClassName card bridge are exempt (they ARE the sanctioned source).
 *
 * A small ALLOW list carries the pre-existing, intentional exceptions so the guard
 * is green today (baseline) and fires only on NEW hand-rolls.
 *
 * Usage:
 *   node scripts/ds-primitive-guard.mjs           # strict, exit 1 on hit
 *   node scripts/ds-primitive-guard.mjs --warn     # report only, exit 0
 *
 * Run manually: `pnpm ds:guard:primitive`
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = resolve(ROOT, "src");
const WARN_ONLY = process.argv.includes("--warn");

// ── Scope — surfaces the guard polices ─────────────────────────────────────────
const SCOPE_DIRS = [
  resolve(SRC, "components/series1-dashboard"),
  resolve(SRC, "components/series1-shell"),
  resolve(SRC, "app/(product)"),
];

// ── Exempt files — the sanctioned sources + dataviz + documented bridges ────────
// Path suffixes (posix). A file matching any is skipped entirely.
const EXEMPT_SUFFIX = [
  // Catalyst primitive definitions ARE the source of truth for the idioms.
  "src/components/catalyst/stepper.tsx",
  "src/components/catalyst/step-timeline.tsx",
  "src/components/catalyst/bento-badge.tsx",
  "src/components/catalyst/wired-chip.tsx",
  "src/components/catalyst/metric.tsx",
];
// Directory fragments that exempt any file whose path contains them.
const EXEMPT_FRAGMENT = [
  "/dataviz/", // HIS / SVG charts — their own system, not a Catalyst primitive.
  "/his/",
];

// ── Baseline allow list — pre-existing intentional inline primitives ────────────
// Each entry is `relpath#detector`. These are the hand-rolls that predate the
// guard and are deliberate (empty-state hairline tracks, one-off nav badges,
// legend chips inside a chart cell). NEW hand-rolls are NOT here → they fail.
const ALLOW = new Set([
  // AllocationBarEmpty — honest empty-state hairline track, not a chip/card.
  "src/components/series1-dashboard/Series1CapitalArchitecture.tsx#chip",
  // Allocation legend pill inside the chart cell — a dataviz legend, not a status chip.
  "src/components/series1-dashboard/Series1AllocationCockpit.tsx#chip",
  // Nav index badge — a single navigation affordance, not a reusable status chip.
  "src/components/series1-shell/Series1Nav.tsx#chip",
  // Confirmation receipt — a semantic <dl>/<dt>/<dd> transaction ledger that
  // predates the guard. Deliberate <dl> semantics; not refactored in this pass
  // (out of scope: no product visual refonte). Baselined, not a new regression.
  "src/app/(product)/vaults/[id]/invest/confirmed/page.tsx#row",
]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const abs = resolve(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(abs, out);
    } else if (/\.tsx$/.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

function isComment(line) {
  return /^\s*(\/\/|\/?\*|\/\*[\s\S]*?\*\/)/.test(line);
}

// ── Detectors ───────────────────────────────────────────────────────────────────
// Each returns true when the line is a hand-rolled primitive of that kind.

// (a) chip — inline-flex/flex + rounded-full + ring on the same className. The
// BentoBadge/WiredChip pill shape recreated by hand.
function isChip(line) {
  const hasFlex = /\b(?:inline-flex|flex)\b/.test(line);
  const hasPill = /rounded-(?:full|\(--ct-radius-full\)|\[var\(--ct-radius-full\)\])/.test(line);
  const hasRing = /\bring-1\b|\bring-inset\b/.test(line);
  return hasFlex && hasPill && hasRing;
}

// (b) stepper — a zero-padded numbered node: String(...).padStart(2, "0"). The
// spine (`w-px … flex-1`) is checked at file level to reduce false positives.
function isStepperNode(line) {
  return /\.padStart\(\s*2\s*,\s*["']0["']\s*\)/.test(line);
}

function fileHasSpine(text) {
  return /w-px[^"]*flex-1|flex-1[^"]*w-px/.test(text);
}

// (c) row — label/value flex row: justify-between with a muted/faint uppercase
// label AND a tabular-nums value on nearby lines. Checked as a 2-line window.
function isRowHeader(line) {
  return (
    /\bjustify-between\b/.test(line) &&
    /uppercase/.test(line) === false && // header-of-section handled elsewhere; rows use plain labels
    false // row detection is window-based below; single-line form disabled to avoid noise
  );
}

const violations = [];

for (const dir of SCOPE_DIRS) {
  for (const abs of walk(dir)) {
    const rel = relative(ROOT, abs).split("\\").join("/");
    if (EXEMPT_SUFFIX.some((s) => rel.endsWith(s))) continue;
    if (EXEMPT_FRAGMENT.some((f) => rel.includes(f))) continue;

    const text = readFileSync(abs, "utf8");
    const lines = text.split("\n");
    const hasSpine = fileHasSpine(text);
    const reported = new Set(); // one hit per detector per file is enough signal.

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isComment(line)) continue;

      // (a) chip
      if (!reported.has("chip") && isChip(line)) {
        reported.add("chip");
        if (!ALLOW.has(`${rel}#chip`)) {
          violations.push({
            detector: "chip",
            file: rel,
            lineNo: i + 1,
            text: line.trim(),
            reason:
              "Hand-rolled status chip (inline-flex + rounded-full + ring) — the pill shape belongs to BentoBadge / WiredChip.",
            fix: "Render <BentoBadge> / <WiredChip> from @/components/catalyst instead of a bespoke <span>.",
          });
        }
      }

      // (b) stepper node — needs the spine present in the file too.
      if (!reported.has("stepper") && hasSpine && isStepperNode(line)) {
        reported.add("stepper");
        if (!ALLOW.has(`${rel}#stepper`)) {
          violations.push({
            detector: "stepper",
            file: rel,
            lineNo: i + 1,
            text: line.trim(),
            reason:
              "Hand-rolled numbered vertical rail (padStart('0') node + w-px flex-1 spine) — this idiom is the Catalyst Stepper.",
            fix: "Render <Stepper> from @/components/catalyst/stepper (size sm|xs) instead of re-welding the rail.",
          });
        }
      }
    }

    // (c) row — window scan: a justify-between line whose next ~3 lines carry a
    // muted/faint label AND a tabular-nums value = a hand-rolled label/value row.
    if (!ALLOW.has(`${rel}#row`)) {
      for (let i = 0; i < lines.length; i++) {
        if (isComment(lines[i])) continue;
        if (!/\bflex\b/.test(lines[i]) || !/\bjustify-between\b/.test(lines[i])) continue;
        const win = lines.slice(i, i + 5).join(" ");
        const hasMutedLabel = /text-\(?--ct-text-(?:muted|faint)\)?|text-\[var\(--ct-text-(?:muted|faint)\)\]/.test(win);
        const hasTabularValue = /tabular-nums/.test(win);
        // A row primitive is label + numeric value; but Series1RowBase / Metric
        // consumers pass those as children, so we only flag when BOTH the muted
        // label styling AND a tabular value literal appear inline in the window
        // (i.e. the row is being STYLED here, not composed from a primitive).
        // A SECTION HEADER also carries a muted description + a numbered badge with
        // tabular-nums — NOT a data row. Exclude the window when it holds a heading
        // tag or a size-7/size-9 index/nav badge (header/nav affordances).
        const isHeaderBlock = /<h[1-4]\b/.test(win) || /\bsize-(?:7|9)\b/.test(win);
        if (hasMutedLabel && hasTabularValue && !isHeaderBlock) {
          violations.push({
            detector: "row",
            file: rel,
            lineNo: i + 1,
            text: lines[i].trim(),
            reason:
              "Hand-rolled label/value row (justify-between + muted label + tabular value) — this is Metric / Series1RowBase / Table.",
            fix: "Render <Metric> or <Series1RowBase> (or a <Table> row for ledgers) instead of a bespoke flex row.",
          });
          break; // one row hit per file is enough signal.
        }
      }
    }
  }
}

// keep isRowHeader referenced (intentional single-line disable) without lint noise.
void isRowHeader;

// ── Output ─────────────────────────────────────────────────────────────────────
console.log("\n── DS PRIMITIVE GUARD ────────────────────────────────────────────────────\n");
console.log(`Mode:   ${WARN_ONLY ? "warn-only (exit 0)" : "strict (exit 1 on hit)"}`);
console.log(`Scope:  series1-* + app/(product) (chip · stepper · row) — dataviz/HIS exempt`);
console.log(`Hits:   ${violations.length}\n`);

const byDetector = {};
for (const v of violations) (byDetector[v.detector] ||= []).push(v);
for (const [detector, items] of Object.entries(byDetector)) {
  console.log(`  ── ${detector} (${items.length}) ──`);
  for (const { file, lineNo, text, reason, fix } of items) {
    console.log(`    ${file}:${lineNo}`);
    console.log(`      ${text}`);
    console.log(`      WHY: ${reason}`);
    console.log(`      FIX: ${fix}\n`);
  }
}

if (violations.length === 0) {
  console.log("PASS: no hand-rolled primitives — chips/steppers/rows delegate to Catalyst.\n");
  process.exit(0);
}

if (WARN_ONLY) {
  console.warn(`WARN: ${violations.length} inline-primitive regression(s). Run without --warn to fail CI.\n`);
  process.exit(0);
} else {
  console.error(`FAIL: ${violations.length} inline-primitive regression(s) — delegate to Catalyst before merging.\n`);
  process.exit(1);
}
