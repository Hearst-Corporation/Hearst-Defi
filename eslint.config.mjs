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
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/**/*.{tsx,jsx}"],
    ignores: [
      "src/components/ui/button.tsx",
      "src/app/debug/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\\b/]",
          message:
            "Prefer semantic typography (.body-*, .h1–.h4, .stat-value) — see docs/DESIGN_SYSTEM.md §4.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] JSXExpressionContainer TemplateLiteral TemplateElement[value.raw=/\\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\\b/]",
          message:
            "Prefer semantic typography (.body-*, .h1–.h4, .stat-value) — see docs/DESIGN_SYSTEM.md §4.",
        },
      ],
    },
  },
];
