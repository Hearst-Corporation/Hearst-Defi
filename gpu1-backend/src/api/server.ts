// gpu1-backend/src/api/server.ts
//
// Minimal framework-agnostic HTTP runtime (node:http — zero web-framework dep, so
// the business code never couples to a framework, per the pivot spec). Routing is
// an explicit table; each handler returns a JSON-serialisable value + status.
//
// Endpoints: GET /health, GET /ready, GET /api/v1/runtime, GET /api/v1/dashboard,
//            GET /api/v1/btc, GET /api/v1/mining,
//            GET /api/v1/ai/context/{dashboard,btc,mining}.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { corsOrigins, loadEnv, type Env } from "../config/env.js";
import { buildDashboard } from "../application/dashboard.js";
import { buildBtc } from "../application/btc.js";
import { buildMining } from "../application/mining.js";
import { buildAiContext } from "../application/ai-context.js";
import { runtimeReport } from "../application/runtime.js";
import { verifySession } from "../auth/session.js";
import { pingDb } from "../persistence/prisma.js";
import { createVaultRepository } from "../persistence/vault-repository.js";
import { createMiningRepository } from "../persistence/mining-repository.js";
import { requestId } from "../observability/request-id.js";

type Handler = (ctx: RequestContext) => Promise<{ status: number; body: unknown }>;

interface RequestContext {
  readonly req: IncomingMessage;
  readonly url: URL;
  readonly nowMs: number;
  readonly reqId: string;
}

function applyCors(res: ServerResponse, env: Env, origin: string | undefined): void {
  const allowed = corsOrigins(env);
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Request-Id");
}

// ── Route table ──────────────────────────────────────────────────────────────

const ROUTES: Record<string, Handler> = {
  "GET /health": async () => ({ status: 200, body: { status: "ok" } }),

  "GET /ready": async () => {
    const latency = await pingDb();
    return latency === null
      ? { status: 503, body: { ready: false, db: "unreachable" } }
      : { status: 200, body: { ready: true, db: "ok", latencyMs: latency } };
  },

  "GET /api/v1/runtime": async (ctx) => ({ status: 200, body: await runtimeReport(ctx.nowMs) }),

  "GET /api/v1/dashboard": async (ctx) => {
    const auth = verifySession(ctx.req.headers["authorization"], ctx.nowMs);
    if (!auth.ok) {
      const code = auth.reason === "not_configured" ? 503 : 401;
      return { status: code, body: { error: "unauthorized", reason: auth.reason } };
    }
    const repo = createVaultRepository();
    const dto = await buildDashboard(auth.session.userId, { repo, nowMs: ctx.nowMs });
    return { status: 200, body: dto };
  },

  "GET /api/v1/btc": async (ctx) => {
    const auth = verifySession(ctx.req.headers["authorization"], ctx.nowMs);
    if (!auth.ok) {
      const code = auth.reason === "not_configured" ? 503 : 401;
      return { status: code, body: { error: "unauthorized", reason: auth.reason } };
    }
    const dto = await buildBtc(auth.session.userId, { nowMs: ctx.nowMs });
    return { status: 200, body: dto };
  },

  "GET /api/v1/mining": async (ctx) => {
    const auth = verifySession(ctx.req.headers["authorization"], ctx.nowMs);
    if (!auth.ok) {
      const code = auth.reason === "not_configured" ? 503 : 401;
      return { status: code, body: { error: "unauthorized", reason: auth.reason } };
    }
    const miningRepo = createMiningRepository();
    const dto = await buildMining(auth.session.userId, { repo: miningRepo, nowMs: ctx.nowMs });
    return { status: 200, body: dto };
  },

  "GET /api/v1/ai/context/dashboard": async (ctx) => {
    const auth = verifySession(ctx.req.headers["authorization"], ctx.nowMs);
    if (!auth.ok) {
      const code = auth.reason === "not_configured" ? 503 : 401;
      return { status: code, body: { error: "unauthorized", reason: auth.reason } };
    }
    const body = await buildAiContext("dashboard", aiDeps(ctx.nowMs), auth.session.userId);
    return { status: 200, body };
  },

  "GET /api/v1/ai/context/btc": async (ctx) => {
    const auth = verifySession(ctx.req.headers["authorization"], ctx.nowMs);
    if (!auth.ok) {
      const code = auth.reason === "not_configured" ? 503 : 401;
      return { status: code, body: { error: "unauthorized", reason: auth.reason } };
    }
    const body = await buildAiContext("btc", aiDeps(ctx.nowMs), auth.session.userId);
    return { status: 200, body };
  },

  "GET /api/v1/ai/context/mining": async (ctx) => {
    const auth = verifySession(ctx.req.headers["authorization"], ctx.nowMs);
    if (!auth.ok) {
      const code = auth.reason === "not_configured" ? 503 : 401;
      return { status: code, body: { error: "unauthorized", reason: auth.reason } };
    }
    const body = await buildAiContext("mining", aiDeps(ctx.nowMs), auth.session.userId);
    return { status: 200, body };
  },
};

// Shared dependency bundle for the AI-context routes — same builders/repos as the
// data screens (single source of truth), never a parallel provider.
function aiDeps(nowMs: number): { repo: ReturnType<typeof createVaultRepository>; miningRepo: ReturnType<typeof createMiningRepository>; nowMs: number } {
  return { repo: createVaultRepository(), miningRepo: createMiningRepository(), nowMs };
}

export function createGpu1Server(): ReturnType<typeof createServer> {
  const env = loadEnv();

  return createServer((req, res) => {
    const reqId = requestId(req.headers["x-request-id"]);
    const origin = req.headers["origin"];
    applyCors(res, env, typeof origin === "string" ? origin : undefined);
    res.setHeader("X-Request-Id", reqId);
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const key = `${req.method} ${url.pathname}`;
    const handler = ROUTES[key];

    if (!handler) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
      return;
    }

    const started = performance.now();
    handler({ req, url, nowMs: Date.now(), reqId })
      .then(({ status, body }) => {
        res.writeHead(status);
        res.end(JSON.stringify(body));
        logLine(reqId, key, status, started);
      })
      .catch((err: unknown) => {
        // Server-side detail stays server-side; client gets a generic error.
        res.writeHead(500);
        res.end(JSON.stringify({ error: "internal_error", requestId: reqId }));
        logLine(reqId, key, 500, started, err);
      });
  });
}

function logLine(reqId: string, route: string, status: number, startedMs: number, err?: unknown): void {
  const line = {
    ts: new Date().toISOString(),
    reqId,
    route,
    status,
    durationMs: Math.round(performance.now() - startedMs),
    ...(err ? { error: err instanceof Error ? err.message : String(err) } : {}),
  };
  // Structured JSON log line.
  console.log(JSON.stringify(line));
}
