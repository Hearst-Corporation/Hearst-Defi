import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@hearst/cockpit-shell/handler": path.resolve(root, "./cockpit-shell/src/handler/createCockpitChatHandler.ts"),
      "@hearst/cockpit-shell": path.resolve(root, "./cockpit-shell/src/index.ts"),
      "@": path.resolve(root, "./src"),
      "server-only": (() => {
        const fs = require("node:fs");
        let dir = root;
        for (let i = 0; i < 8; i++) {
          const candidate = path.join(dir, "node_modules", "server-only", "empty.js");
          if (fs.existsSync(candidate)) return candidate;
          const next = path.dirname(dir);
          if (next === dir) break;
          dir = next;
        }
        return path.resolve(root, "./node_modules/server-only/empty.js");
      })(),
    },
  },
  test: {
    environment: "node",
    include: [path.resolve(__dirname, "verify-resolver.test.ts")],
    exclude: ["**/*.live.test.ts"],
  },
});
