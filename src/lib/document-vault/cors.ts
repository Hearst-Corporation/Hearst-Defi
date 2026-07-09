import "server-only";
import { NextResponse } from "next/server";

/**
 * Scoped CORS for the Document Vault API only. The docs-vault frontend runs on a
 * different origin (localhost:4210) and calls these routes with
 * `credentials: "include"`, so we must echo a specific allowed origin +
 * Allow-Credentials — NEVER `*` with credentials.
 *
 * Allowlist comes from DOCUMENT_VAULT_ALLOWED_ORIGINS (comma-separated). In dev
 * we default to localhost:4210 so the local flow works out of the box. An origin
 * not on the list gets no CORS headers (browser blocks it) — the API still works
 * same-origin and for non-browser callers.
 */
function allowedOrigins(): string[] {
  const fromEnv = process.env.DOCUMENT_VAULT_ALLOWED_ORIGINS?.trim();
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Dev default — only localhost, never a wildcard.
  return ["http://localhost:4210"];
}

/** Apply CORS headers to a response if the request origin is allowlisted. */
export function withVaultCors(res: NextResponse, req: Request): NextResponse {
  const origin = req.headers.get("origin");
  if (origin && allowedOrigins().includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

/** Preflight (OPTIONS) response for the Document Vault API. */
export function vaultCorsPreflight(req: Request): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  const origin = req.headers.get("origin");
  if (origin && allowedOrigins().includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
    res.headers.set("Access-Control-Allow-Headers", "content-type");
    res.headers.set("Vary", "Origin");
  }
  return res;
}
