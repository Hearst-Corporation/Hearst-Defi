import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Derives the real route inventory of the WHOLE app from the filesystem
 * (`src/app/**\/page.tsx`), so the review agent anchors every remark on a route
 * that ACTUALLY exists rather than a hand-maintained list that can drift from
 * the code. Covers every page: product/public, admin back-office, debug.
 *
 * This does NOT "scan the code": it only walks the App Router page-file tree
 * and turns each `page.tsx` path into its route. Same fs-based, server-only
 * pattern as `spec.ts`.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.join(__dirname, "..", "..", "src", "app");

/** Recursively collect directories containing a `page.tsx` under `(product)`. */
async function collectPageDirs(
  dir: string,
  relSegments: string[],
  out: string[][],
): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // directory missing → empty inventory, never throw
  }

  const hasPage = entries.some(
    (e) => e.isFile() && e.name === "page.tsx",
  );
  if (hasPage) {
    out.push(relSegments);
  }

  for (const entry of entries) {
    // Skip route groups "(...)" — they don't add a URL segment — and private
    // "_folders". Recurse into normal + dynamic "[param]" segments.
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
    await collectPageDirs(
      path.join(dir, entry.name),
      isGroup ? relSegments : [...relSegments, entry.name],
      out,
    );
  }
}

/** Turns path segments into a URL, keeping `[param]` dynamic markers. */
function segmentsToRoute(segments: string[]): string {
  if (segments.length === 0) return "/";
  return "/" + segments.join("/");
}

/**
 * Returns the sorted list of every real route in the app — product/public,
 * admin, and debug — e.g. ["/", "/admin", "/admin/dashboard", ...,
 * "/portfolio", "/vaults/[id]/invest/confirmed"].
 */
export async function getProductRoutes(): Promise<string[]> {
  const dirs: string[][] = [];
  await collectPageDirs(APP_DIR, [], dirs);
  const routes = dirs.map(segmentsToRoute);
  // Routes are technical URL identifiers, not human-facing labels: sort them
  // with an explicit BINARY comparator, never `localeCompare`. Linguistic
  // collation reweights punctuation ("/", "-", "[") and varies with the host
  // locale, which would make the inventory order environment-dependent.
  return Array.from(new Set(routes)).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}
