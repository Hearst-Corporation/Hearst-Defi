import { defineConfig } from "vitest/config";

// Standalone config so the GPU1 service does not inherit the Connect root config
// (which references a monorepo setup file). Node environment, no DOM.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    root: import.meta.dirname,
  },
});
