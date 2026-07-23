import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../src/design-system/storybook/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@chromatic-com/storybook",
    "@storybook/addon-mcp",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
};

export default config;
