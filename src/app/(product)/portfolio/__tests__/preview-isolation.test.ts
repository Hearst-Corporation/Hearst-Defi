import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(product)/portfolio/preview/page.tsx"),
  "utf8",
);

describe("/portfolio/preview research isolation", () => {
  it("is non-indexable for standard crawlers and Googlebot", () => {
    expect(source).toMatch(
      /robots:\s*\{\s*index:\s*false,\s*follow:\s*false,\s*googleBot:\s*\{\s*index:\s*false,\s*follow:\s*false,/,
    );
  });

  it("labels direct access as a research-only sandbox", () => {
    expect(source).toContain("Research sandbox · V4");
    expect(source).toContain(
      "Research-only sandbox with mock data — not a Series 1 investor surface.",
    );
  });
});
