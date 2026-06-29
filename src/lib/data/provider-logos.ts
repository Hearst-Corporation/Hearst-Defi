/**
 * Provider logo registry — maps a DeFiLlama protocol `project` slug to a real,
 * locally-hosted brand logo (official colours, NO tint) under `public/providers/`.
 *
 * The logos were downloaded once from the canonical DeFiLlama protocol-icon CDN
 * (`icons.llamao.fi/icons/protocols/<slug>`) and committed as PNGs so the app
 * never hot-links a third-party CDN at render time and never breaks if it moves.
 *
 * DeFiLlama slugs are versioned/variant-y (`aave-v3`, `morpho-blue`,
 * `fluid-lite`, `fluid-lending`, …). We canonicalize to a brand family so one
 * logo covers every variant. Anything without a mapped asset falls back to a
 * tokenized initial pill (handled in the ProviderLogo component) — so a new or
 * exotic pool the API surfaces still renders cleanly, just without a brand mark.
 *
 * Pure data module — no React, no I/O — safe to import on server or client.
 */

export interface ProviderLogo {
  /** Public path to the committed logo asset. */
  src: string;
  /** Human brand label (display + alt text). */
  label: string;
}

/**
 * Canonical brand key → logo asset + label. Keys are the normalized family
 * (see `normalizeProjectSlug`).
 */
const LOGOS: Record<string, ProviderLogo> = {
  aave: { src: "/providers/aave-v3.png", label: "Aave" },
  morpho: { src: "/providers/morpho-blue.png", label: "Morpho" },
  compound: { src: "/providers/compound-v3.png", label: "Compound" },
  fluid: { src: "/providers/fluid-lending.png", label: "Fluid" },
  sky: { src: "/providers/sky-lending.png", label: "Sky" },
  ethena: { src: "/providers/ethena-usde.png", label: "Ethena" },
  goldfinch: { src: "/providers/goldfinch.png", label: "Goldfinch" },
  avantis: { src: "/providers/avantis.png", label: "Avantis" },
  dolomite: { src: "/providers/dolomite.png", label: "Dolomite" },
  ember: { src: "/providers/ember-protocol.png", label: "Ember" },
};

/**
 * Reduce a raw DeFiLlama slug to its brand family key.
 * `aave-v3` → `aave`, `morpho-blue` → `morpho`, `fluid-lite` → `fluid`,
 * `ethena-usde` → `ethena`, `sky-lending` → `sky`, `ember-protocol` → `ember`.
 */
export function normalizeProjectSlug(project: string): string {
  const s = project.trim().toLowerCase();
  if (s.startsWith("aave")) return "aave";
  if (s.startsWith("morpho")) return "morpho";
  if (s.startsWith("compound")) return "compound";
  if (s.startsWith("fluid")) return "fluid";
  if (s.startsWith("sky") || s.startsWith("maker") || s.startsWith("spark"))
    return "sky";
  if (s.startsWith("ethena")) return "ethena";
  if (s.startsWith("goldfinch")) return "goldfinch";
  if (s.startsWith("avantis")) return "avantis";
  if (s.startsWith("dolomite")) return "dolomite";
  if (s.startsWith("ember")) return "ember";
  return s;
}

/**
 * Resolve a logo for a DeFiLlama `project` slug. Returns null when no brand
 * asset is mapped — the caller renders the initial-pill fallback instead.
 */
export function resolveProviderLogo(project: string): ProviderLogo | null {
  return LOGOS[normalizeProjectSlug(project)] ?? null;
}

/**
 * Pretty display label for a protocol slug, even when no logo exists
 * (e.g. `some-new-pool` → "Some New Pool").
 */
export function providerLabel(project: string): string {
  const logo = resolveProviderLogo(project);
  if (logo) return logo.label;
  return project
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
