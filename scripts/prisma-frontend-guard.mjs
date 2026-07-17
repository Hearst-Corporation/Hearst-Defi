#!/usr/bin/env node
// scripts/prisma-frontend-guard.mjs
//
// The architectural target is hearst-connect-backend owning Prisma
// exclusively (see hearst-connect-backend/docs/migration-from-monorepo.md
// and CLAUDE.md's data-ownership goal) — but migrating this frontend's 137
// existing Prisma-touching files (auth, webhooks, admin, chat, mutations)
// is a staged, multi-wave effort (see docs/prisma-migration-waves.md), not
// a single-pass rewrite. Until each wave lands, this guard's only job is
// to stop the count from growing — a new file reaching for
// @prisma/client / PrismaClient / @/lib/db is a step in the wrong
// direction and should go through the backend instead
// (src/lib/backend/*), not add to the pile this migration has to clear.
//
// Baseline captured 2026-07-17 (mission HC-BTC-026): 137 distinct files.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASELINE_PATH = join(__dirname, "prisma-frontend-baseline.json");

function countCurrentFiles() {
  const out = execSync(
    `grep -rl '@prisma/client\\|PrismaClient\\|from "@/lib/db"' src --include='*.ts' --include='*.tsx'`,
    { cwd: ROOT, encoding: "utf8" },
  );
  const files = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((f) => !f.includes("__tests__") && !f.includes(".test."));
  return files;
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.error(`[prisma-frontend-guard] Missing baseline file: ${BASELINE_PATH}`);
    process.exit(1);
  }
}

const current = countCurrentFiles();
const baseline = loadBaseline();

const currentSet = new Set(current);
const baselineSet = new Set(baseline.files);

const added = current.filter((f) => !baselineSet.has(f));
const removed = baseline.files.filter((f) => !currentSet.has(f));

if (added.length > 0) {
  console.error(
    `[prisma-frontend-guard] FAIL — ${added.length} new file(s) import Prisma directly from the frontend. ` +
      `The target is hearst-connect-backend owning Prisma exclusively (see docs/prisma-migration-waves.md) — ` +
      `route new business reads/writes through src/lib/backend/* instead.\n\n` +
      `New files:\n${added.map((f) => `  + ${f}`).join("\n")}`,
  );
  process.exit(1);
}

if (removed.length > 0) {
  console.log(
    `[prisma-frontend-guard] ${removed.length} file(s) no longer import Prisma directly — ` +
      `progress! Update the baseline: node scripts/prisma-frontend-guard.mjs --update\n` +
      removed.map((f) => `  - ${f}`).join("\n"),
  );
  if (process.argv.includes("--update")) {
    const fs = await import("node:fs");
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify({ capturedAt: new Date().toISOString().slice(0, 10), count: current.length, files: current.sort() }, null, 2) + "\n",
    );
    console.log(`[prisma-frontend-guard] Baseline updated: ${current.length} files.`);
    process.exit(0);
  }
  console.log(`[prisma-frontend-guard] PASS (with progress not yet baselined — run with --update to record it).`);
  process.exit(0);
}

console.log(`[prisma-frontend-guard] PASS — ${current.length} files (baseline: ${baseline.count}, unchanged).`);
