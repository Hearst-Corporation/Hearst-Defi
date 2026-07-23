import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Token catalogue — reads the REAL CSS custom properties at render time.
// Nothing is hardcoded here except the token NAMES; every swatch resolves
// through var() so a token change at the source instantly changes the story.

const meta: Meta = {
  title: "01-principes/Tokens",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
      <span
        style={{
          width: 40,
          height: 24,
          borderRadius: 6,
          background: `var(${token})`,
          border: "1px solid var(--ct-border-soft)",
          flexShrink: 0,
        }}
      />
      <code style={{ fontSize: 11, color: "var(--ct-text-muted)" }}>{token}</code>
      <span style={{ fontSize: 11, color: "var(--ct-text-faint)" }}>{label}</span>
    </div>
  );
}

export const Couleurs: Story = {
  render: () => (
    <div>
      <Swatch token="--ct-bg-deep" label="Fond global" />
      <Swatch token="--ct-accent" label="Accent — le seul vert de l'UI" />
      <Swatch token="--ct-accent-strong" label="Arc actif jauges" />
      <Swatch token="--ct-status-warning" label="Estimated / attention" />
      <Swatch token="--ct-status-danger" label="Stale / négatif" />
      <Swatch token="--ct-status-info" label="Oracle / USDC bucket" />
      <Swatch token="--ct-border-soft" label="Séparateurs doux" />
      <Swatch token="--ct-border" label="Bordure standard" />
      <Swatch token="--ct-border-strong" label="Bordure forte" />
    </div>
  ),
};

function TypeRow({ token, sample }: { token: string; sample: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "8px 0" }}>
      <code style={{ fontSize: 11, color: "var(--ct-text-muted)", width: 180, flexShrink: 0 }}>
        {token}
      </code>
      <span style={{ fontSize: `var(${token})`, color: "var(--ct-text-strong)" }}>{sample}</span>
    </div>
  );
}

export const Typographie: Story = {
  render: () => (
    <div>
      <TypeRow token="--ct-text-hero" sample="0.01520000 BTC" />
      <TypeRow token="--ct-text-3xl-fixed" sample="Page title — 24px fixe" />
      <TypeRow token="--ct-text-2xl" sample="Section heading" />
      <TypeRow token="--ct-text-lg" sample="Card title" />
      <TypeRow token="--ct-text-base" sample="Body text 16px" />
      <TypeRow token="--ct-text-sm" sample="Body small 15px" />
      <TypeRow token="--ct-text-xs" sample="Labels 13px" />
      <TypeRow token="--ct-text-micro" sample="Micro captions 11px" />
    </div>
  ),
};
