import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next bundles eslint-plugin-react@7.x which crashes on ESLint 10
// because it calls the removed `context.getFilename()` API.
// We strip the "react" plugin and its rules from the "next" config entry,
// keeping @next/next, react-hooks, import, and jsx-a11y intact.
const sanitizedCoreWebVitals = nextCoreWebVitals.map((entry) => {
  if (entry.name !== "next" || !entry.plugins) return entry;

  const { react: _react, ...restPlugins } = entry.plugins;
  const cleanRules = entry.rules
    ? Object.fromEntries(
        Object.entries(entry.rules).filter(([key]) => !key.startsWith("react/"))
      )
    : {};

  return { ...entry, plugins: restPlugins, rules: cleanRules };
});

export default [
  ...sanitizedCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // WARN (2026-06-16): visible signal, not a hard block — keeps editing
      // velocity while still surfacing `any` / unused. Real ESLint errors
      // (react-hooks, imports, etc.) still fail `pnpm lint` (no `|| true`).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
