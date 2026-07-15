import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * GET /docs/methodology/<file>.md
 *
 * Serves the published methodology documents that live on disk under
 * `docs/methodology/` (outside `public/`, so Next does not serve them as static
 * assets). The Proof Center links to `/docs/methodology/v3.0.md` (the active
 * methodology, ADR-019); without this handler that link 404s.
 *
 * Every published version stays servable, not just the active one: v1.0 and v2.0
 * are immutable on-file records (ADR-019 §7) and a memo generated under one of
 * them keeps citing it, so those links must keep resolving.
 *
 * Security: the `file` segment is strictly whitelisted to a flat `<name>.md`
 * pattern with no path separators or `..`, and the resolved path is asserted to
 * stay inside the methodology directory — closing any path-traversal vector.
 *
 * Note: relies on `docs/` being present at runtime (true for `next dev` /
 * `next start`). For a standalone/serverless deploy, include `docs/methodology`
 * in the output file tracing.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<NextResponse> {
  const { file } = await params;

  if (!/^[a-z0-9][a-z0-9._-]*\.md$/i.test(file) || file.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const baseDir = path.join(process.cwd(), "docs", "methodology");
  const resolved = path.join(baseDir, file);
  if (resolved !== path.normalize(resolved) || !resolved.startsWith(baseDir + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const content = await readFile(resolved, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
