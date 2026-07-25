/**
 * Feature flags — evaluated at module load time from the validated env canon.
 *
 * SERVER-ONLY since the raw-env purge 2026-07-26: every consumer of this
 * module is server-side (API routes, RSC pages, tool registry, swarms config),
 * so the flags now read through `@/lib/env` — which makes any future client
 * import fail loudly at build time instead of silently seeing `undefined`.
 *
 * To enable a flag locally: set it in .env.local before starting the dev server.
 * To enable in production: add the var to your Vercel / Railway project env.
 */
import { env } from "@/lib/env";

export const FEATURE_FLAGS = {
  /**
   * ENABLE_MONTE_CARLO — gates the Monte Carlo panel in Scenario Lab.
   *
   * OFF by default. Set NEXT_PUBLIC_ENABLE_MONTE_CARLO=true to enable.
   * Requires Methodology v2.0 (ADR-006). Headline APY stays a range (#1).
   */
  ENABLE_MONTE_CARLO: env.NEXT_PUBLIC_ENABLE_MONTE_CARLO === "true",

  /**
   * CHAT_MASTER_AGENT — kill-switch for the unified cockpit chat engine. The
   * app-side tool-capable engine (runChatAgent) is now the SINGLE engine for all
   * modes (normal / admin / review); the legacy @hearst/cockpit-shell handler has
   * been retired. Server-only (no NEXT_PUBLIC_): the value never ships to client.
   *
   * ON by default. Set CHAT_MASTER_AGENT=0 to DISABLE the cockpit chat entirely
   * (the route returns 503) — there is no second engine to fall back to.
   */
  CHAT_MASTER_AGENT: env.CHAT_MASTER_AGENT !== "0",

  /**
   * SWARMS_ENGINE — gates the external MySwarms / crewai-engine integration
   * (agentic orchestration delegated over HTTP, kickoff→poll). Server-only.
   *
   * OFF by default. Set SWARMS_ENGINE=1 to route agentic work to the external
   * CrewAI engine. When off, the swarm client is dormant — nothing reaches the
   * external backend, and the in-repo agents keep running unchanged. Activation
   * also requires CREWAI_ENGINE_URL + CREWAI_ENGINE_AUTH_TOKEN (env.ts warns in
   * prod when the flag is on but they are missing — never throws).
   */
  SWARMS_ENGINE: env.SWARMS_ENGINE === "1",
} as const;
