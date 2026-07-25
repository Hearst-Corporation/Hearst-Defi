#!/usr/bin/env node
/**
 * Greenfield batch — replace legacy page.tsx shells with RouteShell stubs.
 * Preserves redirect-only pages and already-migrated routes.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP = path.join(ROOT, "src/app");

const SKIP = new Set([
  "src/app/page.tsx",
  "src/app/login/page.tsx",
  "src/app/(product)/dashboard/page.tsx",
  "src/app/(product)/vaults/page.tsx",
  "src/app/(product)/proof-center/page.tsx",
  "src/app/(product)/profile/page.tsx",
  "src/app/admin/dashboard/page.tsx",
  "src/app/admin/customers/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/(product)/onboarding/page.tsx",
  "src/app/(product)/btc/page.tsx",
  "src/app/(product)/bitcoin/page.tsx",
  "src/app/(product)/mining/page.tsx",
  "src/app/(product)/my-vaults/page.tsx",
  "src/app/(product)/btc/ledger/page.tsx",
  "src/app/(product)/portfolio/activity/page.tsx",
  "src/app/(product)/portfolio/positions/page.tsx",
  "src/app/(product)/portfolio/distributions/page.tsx",
  "src/app/(product)/portfolio/yield/page.tsx",
  "src/app/agent-canvas/page.tsx",
  "src/app/admin/agent-canvas/page.tsx",
  "src/app/admin/governance/propose/page.tsx",
  "src/app/admin/spec/page.tsx",
  "src/app/admin/vaults/[id]/edit/page.tsx",
]);

const REDIRECT_ONLY = new Set([
  "src/app/(product)/btc/page.tsx",
  "src/app/(product)/bitcoin/page.tsx",
  "src/app/(product)/mining/page.tsx",
  "src/app/(product)/my-vaults/page.tsx",
  "src/app/(product)/btc/ledger/page.tsx",
  "src/app/(product)/portfolio/activity/page.tsx",
  "src/app/(product)/portfolio/positions/page.tsx",
  "src/app/(product)/portfolio/distributions/page.tsx",
  "src/app/(product)/portfolio/yield/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/(product)/onboarding/page.tsx",
  "src/app/agent-canvas/page.tsx",
  "src/app/admin/agent-canvas/page.tsx",
]);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === "page.tsx") acc.push(p);
  }
  return acc;
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll("\\", "/");
}

function titleFromRoute(routePath) {
  const seg = routePath
    .replace(/^src\/app\//, "")
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter((s) => !s.startsWith("(") && !s.startsWith("[") && s !== "page");
  const last = seg[seg.length - 1] ?? "Home";
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function hasLegacy(content) {
  return (
    /components\/catalyst|Series1Page|AdminPageShell|doc-flow|cockpit\.css/.test(
      content,
    ) || /text-zinc-|dark:|--ct-/.test(content)
  );
}

let rewritten = 0;
let skipped = 0;

for (const file of walk(APP)) {
  const r = rel(file);
  if (SKIP.has(r) || REDIRECT_ONLY.has(r)) {
    skipped++;
    continue;
  }
  const content = fs.readFileSync(file, "utf8");
  if (!hasLegacy(content)) {
    skipped++;
    continue;
  }

  const title = titleFromRoute(r);
  const dynamic =
    /export const dynamic\s*=/.test(content) ? "export const dynamic = \"force-dynamic\";\n\n" : "";

  const body = `${dynamic}import { RouteShell } from "@/views/_shared/route-shell";

export const metadata = {
  title: "${title} — Hearst Connect",
};

export default function Page() {
  return (
    <RouteShell
      title="${title}"
      description="Greenfield surface — business loaders preserved server-side; UI rebuilt on src/ui."
    />
  );
}
`;

  fs.writeFileSync(file, body);
  rewritten++;
  console.log("rewrote", r);
}

console.log(`Done: ${rewritten} rewritten, ${skipped} skipped`);
