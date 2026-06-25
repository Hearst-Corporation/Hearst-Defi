import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Dé-vendoré DS — Vitest ne lit pas les tsconfig paths : aliase explicitement la copie locale.
      "@hearst/cockpit-shell": path.resolve(__dirname, "./cockpit-shell/src/index.ts"),
      "@": path.resolve(__dirname, "./src"),
      // `server-only` is a marker package that throws when imported outside an
      // RSC environment. Under Vitest we want server-only modules to be
      // importable; aliasing to the package's own no-op `empty.js` is exactly
      // what the React `react-server` condition does in production.
      // `server-only` throws when imported outside an RSC environment.
      // Under Vitest we alias it to the package's no-op empty.js.
      // In a pnpm workspace the package lives in the root node_modules (not in
      // the individual worktree), so we walk up from __dirname to find it.
      "server-only": (() => {
        // Walk up directory tree to find server-only/empty.js.
        const fs = require("node:fs");
        let dir = __dirname;
        for (let i = 0; i < 8; i++) {
          const candidate = path.join(dir, "node_modules", "server-only", "empty.js");
          if (fs.existsSync(candidate)) return candidate;
          const next = path.dirname(dir);
          if (next === dir) break;
          dir = next;
        }
        // Last-resort fallback — won't resolve but won't crash the config.
        return path.resolve(__dirname, "./node_modules/server-only/empty.js");
      })(),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "cockpit-shell/**/*.test.ts",
      // Infra/tooling guards (pure logic) colocated with their scripts.
      "scripts/**/*.test.mjs",
    ],
    exclude: ["**/*.live.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "**/__tests__/**",
        "**/node_modules/**",
        "**/*.config.*",
        "**/coverage/**",
        ".next/**",
        "e2e/**",
      ],
      thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 },
    },
  },
});
