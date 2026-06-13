/**
 * Command palette tests
 *
 * Environment: node (via vitest.config.ts — renderToStaticMarkup, no jsdom).
 *
 * Tests:
 *   1. 31 commands registered
 *   2. filterCommands — fuzzy search works
 *   3. filterCommands — empty query returns all
 *   4. groupBySection — correct section grouping
 *   5. filterCommands — section name matching
 *   6. filterCommands — keyword matching
 *   7. Navigate commands have hrefs
 *   8. All section constants present
 *   9. No duplicate command IDs
 *  10. Shortcut fields are strings when present
 */

import { describe, expect, it } from "vitest";
import {
  COMMAND_REGISTRY,
  SECTION_ORDER,
  filterCommands,
  groupBySection,
  type CommandSection,
} from "@/lib/power/commands";

// ── 1. 31 commands registered ─────────────────────────────────────────────────
describe("COMMAND_REGISTRY", () => {
  it("has exactly 31 commands", () => {
    expect(COMMAND_REGISTRY).toHaveLength(31);
  });

  it("has no duplicate IDs", () => {
    const ids = COMMAND_REGISTRY.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every command has a non-empty id and label", () => {
    for (const cmd of COMMAND_REGISTRY) {
      expect(cmd.id.length).toBeGreaterThan(0);
      expect(cmd.label.length).toBeGreaterThan(0);
    }
  });

  it("every command has a valid section", () => {
    const validSections = new Set<CommandSection>(["Navigate", "Action", "Search", "View"]);
    for (const cmd of COMMAND_REGISTRY) {
      expect(validSections.has(cmd.section)).toBe(true);
    }
  });

  it("Navigate commands have hrefs", () => {
    const nav = COMMAND_REGISTRY.filter((c) => c.section === "Navigate");
    for (const cmd of nav) {
      expect(typeof cmd.href).toBe("string");
      expect((cmd.href ?? "").length).toBeGreaterThan(0);
    }
  });

  it("shortcuts, when present, are strings", () => {
    const withShortcuts = COMMAND_REGISTRY.filter((c) => c.shortcut !== undefined);
    expect(withShortcuts.length).toBeGreaterThan(0);
    for (const cmd of withShortcuts) {
      expect(typeof cmd.shortcut).toBe("string");
    }
  });

  it("has 11 Navigate commands", () => {
    expect(COMMAND_REGISTRY.filter((c) => c.section === "Navigate")).toHaveLength(11);
  });

  it("has 10 Action commands", () => {
    expect(COMMAND_REGISTRY.filter((c) => c.section === "Action")).toHaveLength(10);
  });

  it("has 5 Search commands", () => {
    expect(COMMAND_REGISTRY.filter((c) => c.section === "Search")).toHaveLength(5);
  });

  it("has 5 View commands", () => {
    expect(COMMAND_REGISTRY.filter((c) => c.section === "View")).toHaveLength(5);
  });
});

// ── 2. filterCommands — fuzzy search ─────────────────────────────────────────
describe("filterCommands", () => {
  it("empty query returns all commands", () => {
    const result = filterCommands(COMMAND_REGISTRY, "");
    expect(result).toHaveLength(COMMAND_REGISTRY.length);
  });

  it("whitespace-only query returns all commands", () => {
    const result = filterCommands(COMMAND_REGISTRY, "   ");
    expect(result).toHaveLength(COMMAND_REGISTRY.length);
  });

  it("fuzzy match on label — 'dash' matches 'Dashboard'", () => {
    const result = filterCommands(COMMAND_REGISTRY, "dash");
    const labels = result.map((c) => c.label);
    expect(labels).toContain("Dashboard");
  });

  it("fuzzy match on keywords — 'lp' matches Export LP register CSV via keywords", () => {
    const result = filterCommands(COMMAND_REGISTRY, "lp");
    const ids = result.map((c) => c.id);
    expect(ids).toContain("action-export-lp");
  });

  it("no results for completely nonsense query", () => {
    const result = filterCommands(COMMAND_REGISTRY, "zzzzz_nomatch_xyzxyz");
    expect(result).toHaveLength(0);
  });

  it("case-insensitive — 'VAULT' matches vault-related commands", () => {
    const result = filterCommands(COMMAND_REGISTRY, "VAULT");
    expect(result.length).toBeGreaterThan(0);
  });

  it("matches keyword 'oracle' to Trigger oracle refresh", () => {
    const result = filterCommands(COMMAND_REGISTRY, "oracle");
    const ids = result.map((c) => c.id);
    expect(ids).toContain("action-oracle-refresh");
  });

  it("matches 'stress' to Run scenario stress", () => {
    const result = filterCommands(COMMAND_REGISTRY, "stress");
    const ids = result.map((c) => c.id);
    expect(ids).toContain("action-stress-scenario");
  });
});

// ── groupBySection ────────────────────────────────────────────────────────────
describe("groupBySection", () => {
  it("returns a Map with all 4 sections", () => {
    const map = groupBySection(COMMAND_REGISTRY);
    for (const section of SECTION_ORDER) {
      expect(map.has(section)).toBe(true);
    }
  });

  it("Navigate bucket has 11 entries", () => {
    const map = groupBySection(COMMAND_REGISTRY);
    expect(map.get("Navigate")).toHaveLength(11);
  });

  it("total commands across all buckets equals 31", () => {
    const map = groupBySection(COMMAND_REGISTRY);
    let total = 0;
    for (const bucket of map.values()) {
      total += bucket.length;
    }
    expect(total).toBe(31);
  });
});

// ── SECTION_ORDER ─────────────────────────────────────────────────────────────
describe("SECTION_ORDER", () => {
  it("contains the 4 expected sections", () => {
    expect(SECTION_ORDER).toEqual(
      expect.arrayContaining(["Navigate", "Action", "Search", "View"]),
    );
    expect(SECTION_ORDER).toHaveLength(4);
  });
});
