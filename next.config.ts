import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hearst/cockpit-shell"],
  turbopack: {
    resolveAlias: {
      // Privy optional peer deps (Solana ecosystem) — not installed, stub out
      // NOTE: empty-module.ts was removed — these peer deps are optional.
      // If any are actually imported, install the real package or restore the stub.
      "x402": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@solana-program/system": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@solana-program/token": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@solana-program/token-2022": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@solana-program/memo": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@solana-program/compute-budget": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@solana/kit": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@farcaster/mini-app-solana": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@abstract-foundation/agw-client": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
      "@solana/transaction-confirmation": { browser: "./src/lib/empty-module.ts", default: "./src/lib/empty-module.ts" },
    },
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-pg",
    "better-sqlite3",
    "pg",
    "@fireblocks/ts-sdk",
  ],
  // Prisma 7 ships a WASM query compiler in @prisma/client (no per-platform
  // native query engine), and the runtime connection is made through a driver
  // adapter (@prisma/adapter-pg / @prisma/adapter-better-sqlite3) — both
  // listed in serverExternalPackages above so they stay outside the bundle and
  // pull in their native deps (pg, better-sqlite3) via `require` at runtime.
  // Therefore: no more `libquery_engine-rhel-openssl-3.0.x.so.node` to include
  // (removed) and no more darwin engine to exclude (also removed).
  outputFileTracingExcludes: {
    "*": [
      "node_modules/**/schema-engine-*",
      "node_modules/@swc/core-*/**",
      "node_modules/esbuild/**",
    ],
  },
  experimental: {
    optimizePackageImports: [
      "openai",
      // @react-pdf/renderer: tree-shaken here but NOT in serverExternalPackages —
      // adding it there breaks Turbopack (native binary conflict with canvas/pdfkit)
      "@react-pdf/renderer",
      "lucide-react",
    ],
  },
  // standalone only for Docker/self-host packaging; omitted for Vercel (breaks serverless function routing)
  ...(process.env.STANDALONE_BUILD ? { output: "standalone" as const } : {}),
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  // ---------------------------------------------------------------------------
  // Legacy admin redirects (308 permanent) — vault-centric URL enrichment.
  //
  // Phase 1 (MVP): bare admin routes redirect to `?vault=yield` so bookmarks
  // and internal links always carry an explicit vault context. These routes
  // resolve correctly today because every page already reads `?vault=` and
  // falls back to "yield" when absent — the redirect makes the default
  // explicit rather than silent.
  //
  // Phase 2 (Sprint +1): when /admin/vaults/[id]/operations/* scaffolding
  // lands, these redirects will be updated to point at the vault-scoped paths.
  // Until then, the `?vault=yield` form is the canonical URL.
  // ---------------------------------------------------------------------------
  async redirects() {
    // Each redirect only fires when ?vault=... is ABSENT, otherwise Next
    // matches the same source even with the query already present and
    // 308-loops back to itself (browser shows ERR_TOO_MANY_REDIRECTS).
    const missingVaultQuery = [
      { type: "query" as const, key: "vault" },
    ];
    return [
      {
        source: "/admin/signals",
        missing: missingVaultQuery,
        destination: "/admin/signals?vault=yield",
        permanent: true,
      },
      {
        source: "/admin/distributions",
        missing: missingVaultQuery,
        destination: "/admin/distributions?vault=yield",
        permanent: true,
      },
      {
        source: "/admin/proofs",
        missing: missingVaultQuery,
        destination: "/admin/proofs?vault=yield",
        permanent: true,
      },
      {
        source: "/admin/projection",
        missing: missingVaultQuery,
        destination: "/admin/projection?vault=yield",
        permanent: true,
      },
      {
        source: "/admin/scenario-lab",
        missing: missingVaultQuery,
        destination: "/admin/scenario-lab?vault=yield",
        permanent: true,
      },
      {
        source: "/admin/investor-memo",
        missing: missingVaultQuery,
        destination: "/admin/investor-memo?vault=yield",
        permanent: true,
      },
    ];
  },
  // Body size limits are enforced per-route via NextRequest constraints
  // (see individual route.ts files for max body validation)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // X-Frame-Options is superseded by CSP frame-ancestors below (hub embed)
          // {
          //   key: "X-Frame-Options",
          //   value: "DENY",
          // },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          (() => {
            // Resolve the configured RPC origin at build time so the CSP does
            // not hardcode a single provider. The real RPC is Alchemy
            // (NEXT_PUBLIC_CHAIN_RPC_URL); without its origin in connect-src the
            // viem deposit/approve flow is blocked in the browser.
            const rpcOrigin = (() => {
              try {
                return new URL(
                  process.env.NEXT_PUBLIC_CHAIN_RPC_URL ??
                    "https://sepolia.base.org",
                ).origin;
              } catch {
                return "https://sepolia.base.org";
              }
            })();
            // connect-src hosts: self + Privy + the public Base Sepolia RPC
            // fallback + the configured RPC origin (deduped) + Persona KYC API.
            const connectHosts = [
              "'self'",
              "https://auth.privy.io",
              "https://telemetry.privy.io",
              "https://sepolia.base.org",
              ...(rpcOrigin === "https://sepolia.base.org" ? [] : [rpcOrigin]),
              "https://*.withpersona.com",
              "wss://auth.privy.io",
            ].join(" ");
            return {
              key: "Content-Security-Policy",
              value: [
                "default-src 'self'",
                // 'unsafe-eval' is required by Next.js 16 Turbopack runtime; cannot be removed without nonce-based CSP.
                // cdn.withpersona.com loads the Persona KYC SDK (persona-embed.tsx).
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io https://telemetry.privy.io https://cdn.withpersona.com",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: https:",
                `connect-src ${connectHosts}`,
                // frame-src: Privy auth + Persona inquiry iframe + DocuSign signing
                // (invest/subscribe flows via lib/docusign) + Calendly ops scheduling.
                "frame-src https://auth.privy.io https://*.withpersona.com https://*.docusign.net https://*.docusign.com https://calendly.com",
                process.env.NODE_ENV === "production"
                  ? "frame-ancestors 'self'"
                  : "frame-ancestors 'self' http://localhost:4200 http://localhost:4201",
                "font-src 'self' data:",
              ].join("; "),
            };
          })(),
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Only emit upload logs in CI — local dev stays silent
  silent: !process.env.CI,
  // Sourcemap upload only runs when SENTRY_AUTH_TOKEN is present (CI); skipped locally
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
