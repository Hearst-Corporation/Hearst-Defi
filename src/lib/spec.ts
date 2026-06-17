import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import matter from "gray-matter";
import { z } from "zod";

// Resolve SPEC_DIR against this module's URL rather than process.cwd() so
// Next.js' static NFT tracer can bound the trace (process.cwd() defeats it
// and inflates the serverless bundle). Same pattern as src/lib/product-routes.ts.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SPEC_DIR = path.join(__dirname, "..", "..", "docs", "spec");

/**
 * Frontmatter is author-controlled MDX; both fields are optional so an
 * incomplete or malformed block degrades gracefully (slug-based title,
 * order 999) instead of crashing the page build.
 */
const specFrontmatterSchema = z.object({
  title: z.string().optional(),
  order: z.number().optional(),
});

function parseFrontmatter(data: unknown): { title?: string; order?: number } {
  const result = specFrontmatterSchema.safeParse(data);
  return result.success ? result.data : {};
}

export interface SpecDoc {
  slug: string;
  title: string;
  order: number;
  content: string;
}

export interface SpecIndexEntry {
  slug: string;
  title: string;
  order: number;
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.mdx?$/, "");
}

let specIndexCache: Promise<SpecIndexEntry[]> | null = null;

export async function getSpecIndex(): Promise<SpecIndexEntry[]> {
  if (process.env.NODE_ENV !== "production") {
    return computeSpecIndex();
  }
  if (!specIndexCache) {
    specIndexCache = computeSpecIndex().catch((err) => {
      specIndexCache = null;
      throw err;
    });
  }
  return specIndexCache;
}

async function computeSpecIndex(): Promise<SpecIndexEntry[]> {
  // turbopackIgnore: SPEC_DIR is statically scoped to docs/spec via import.meta.url;
  // file names come from the directory listing and can't be statically known.
  // Without this hint, Turbopack's NFT tracer pulls the whole project into the
  // serverless bundle.
  const files = await fs.readdir(/*turbopackIgnore: true*/ SPEC_DIR);
  const entries: SpecIndexEntry[] = [];

  for (const file of files) {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
    const slug = slugFromFilename(file);
    const raw = await fs.readFile(
      /*turbopackIgnore: true*/ path.join(SPEC_DIR, file),
      "utf8",
    );
    const fm = parseFrontmatter(matter(raw).data);
    entries.push({
      slug,
      title: fm.title ?? slug,
      order: typeof fm.order === "number" ? fm.order : 999,
    });
  }

  entries.sort((a, b) => a.order - b.order);
  return entries;
}

export async function getSpecDoc(slug: string): Promise<SpecDoc | null> {
  const specDirPrefix = SPEC_DIR.endsWith(path.sep) ? SPEC_DIR : SPEC_DIR + path.sep;
  const candidates = [
    path.join(SPEC_DIR, `${slug}.mdx`),
    path.join(SPEC_DIR, `${slug}.md`),
  ];
  for (const filepath of candidates) {
    // Path traversal guard: resolved path must stay within SPEC_DIR
    if (!filepath.startsWith(specDirPrefix)) continue;
    try {
      const raw = await fs.readFile(/*turbopackIgnore: true*/ filepath, "utf8");
      const parsed = matter(raw);
      const fm = parseFrontmatter(parsed.data);
      return {
        slug,
        title: fm.title ?? slug,
        order: typeof fm.order === "number" ? fm.order : 999,
        content: parsed.content,
      };
    } catch {
      // try next
    }
  }
  return null;
}
