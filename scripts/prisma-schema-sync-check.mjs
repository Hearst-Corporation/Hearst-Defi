#!/usr/bin/env node
// scripts/prisma-schema-sync-check.mjs
//
// This frontend and hearst-connect-backend (independent repo, adjacent
// path ../hearst-connect-backend) both currently carry a copy of
// prisma/schema.prisma — the frontend remains the canonical source until
// the backend is proven end-to-end and the frontend's own Prisma usage is
// migrated away (see docs/prisma-migration-waves.md). Until then, the two
// copies must stay byte-identical, or the backend silently drifts from
// the schema the frontend's own migrations define.
//
// This check is advisory (does not fail CI) when the backend repo isn't
// present as a local sibling — most CI runners only check out one repo at
// a time. Run it locally after any schema.prisma change, before pushing
// to the backend repo.
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FRONTEND_SCHEMA = join(ROOT, "prisma/schema.prisma");
const BACKEND_SCHEMA = resolve(ROOT, "..", "hearst-connect-backend/prisma/schema.prisma");

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (!existsSync(BACKEND_SCHEMA)) {
  console.log(
    `[prisma-schema-sync-check] hearst-connect-backend not found as a local sibling (${BACKEND_SCHEMA}) — skipping (advisory only).`,
  );
  process.exit(0);
}

const frontendHash = sha256(FRONTEND_SCHEMA);
const backendHash = sha256(BACKEND_SCHEMA);

if (frontendHash !== backendHash) {
  console.error(
    `[prisma-schema-sync-check] DRIFT DETECTED\n` +
      `  frontend: ${frontendHash}  (${FRONTEND_SCHEMA})\n` +
      `  backend:  ${backendHash}  (${BACKEND_SCHEMA})\n\n` +
      `Copy the frontend schema into the backend repo and commit it there —\n` +
      `the frontend remains canonical until the migration waves in\n` +
      `docs/prisma-migration-waves.md complete.`,
  );
  process.exit(1);
}

console.log(`[prisma-schema-sync-check] PASS — schemas identical (${frontendHash.slice(0, 12)}…).`);
