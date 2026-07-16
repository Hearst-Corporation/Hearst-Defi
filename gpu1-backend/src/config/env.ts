// gpu1-backend/src/config/env.ts — validated at boot. Fail loud, never default a secret.
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3900),
  // Bind host. Default 127.0.0.1 (IPv4-only, loopback) so the service sits behind
  // the reverse proxy and is never exposed on all interfaces. A bare "*"/"::"
  // bind listens on IPv6 in WSL2, which cloudflared's IPv4 127.0.0.1 origin cannot
  // reach → 502. Explicit 127.0.0.1 fixes that and narrows the surface.
  HOST: z.string().default("127.0.0.1"),
  // SAME canonical Supabase prod pooler as Connect — the DB is NOT duplicated.
  // Provided by the GPU1 environment, never committed.
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  // HMAC key to validate the session token minted by Connect (service-to-service).
  // An empty string in the environment means "unset" → fail-closed not_configured,
  // never a boot crash (so the service still serves /health while auth is being wired).
  SESSION_SIGNING_KEY: z
    .string()
    .transform((s) => (s.trim() === "" ? undefined : s))
    .pipe(z.string().min(16).optional())
    .optional(),
  // Comma-separated allowed CORS origins (Vercel prod + preview + localhost).
  CORS_ORIGINS: z.string().default("https://connect.hearst.app,http://localhost:4105"),
  // v2 contract — absent until deployed → runtime mode is not_configured.
  DYNAVAULT_ADDRESS: z.string().optional(),
  CHAIN_ID: z.coerce.number().int().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Never print values — only which keys failed.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`[gpu1-backend] invalid environment: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}
