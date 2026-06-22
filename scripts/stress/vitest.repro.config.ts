import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal config to run the repro test in scripts/stress with the @/ alias.
const root = path.resolve(__dirname, "..", "..");

export default defineConfig({
  test: {
    include: ["scripts/stress/**/*.test.ts"],
    exclude: ["**/*.live.test.ts"],
    alias: {
      "@": path.join(root, "src"),
      "@hearst/cockpit-shell": path.join(root, "cockpit-shell", "src"),
    },
  },
});
