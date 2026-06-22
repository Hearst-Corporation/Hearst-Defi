import { describe, expect, it } from "vitest";

import { ADMIN_READ_TOOL_IDS, ADMIN_WRITE_TOOL_IDS } from "@/lib/llm/tools/types";
import { getAdminToolGraphCatalog } from "@/lib/llm/tools/graph-catalog";

describe("getAdminToolGraphCatalog", () => {
  it("covers every read/write tool id from types.ts", () => {
    const { read, write } = getAdminToolGraphCatalog();
    expect(read.map((t) => t.id)).toEqual([...ADMIN_READ_TOOL_IDS]);
    expect(write.map((t) => t.id)).toEqual([...ADMIN_WRITE_TOOL_IDS]);
  });

  it("assigns a non-empty label and description per tool", () => {
    const { read, write } = getAdminToolGraphCatalog();
    for (const tool of [...read, ...write]) {
      expect(tool.label.trim().length).toBeGreaterThan(0);
      expect(tool.description.trim().length).toBeGreaterThan(0);
    }
  });
});
