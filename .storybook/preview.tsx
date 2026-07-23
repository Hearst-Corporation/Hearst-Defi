import type { Preview } from "@storybook/nextjs-vite";

// Same cascade order as src/app/layout.tsx — tokens-layer → globals (Tailwind
// v4 @theme) → cockpit.css (project overrides). A story that renders without
// this exact order sees components without their --ct-* tokens.
import "../src/app/tokens-layer.css";
import "../src/app/globals.css";
import "../src/app/cockpit.css";

const preview: Preview = {
  parameters: {
    backgrounds: { disable: true }, // --ct-bg-deep from cockpit.css is the only background
    a11y: {
      test: "error",
    },
  },
  decorators: [
    (Story) => {
      // The product runs dark-only (MVP) — no light-mode toggle exists.
      // `.dark` on a wrapper div (not html/body — the preview iframe already
      // owns those) so any `dark:` variant and the token cascade both apply.
      return (
        <div
          className="dark"
          style={{
            minHeight: "100vh",
            background: "var(--ct-bg-deep)",
            color: "var(--ct-text-primary)",
            fontFamily: "var(--font-sans)",
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
