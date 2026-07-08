import { describe, expect, it } from "vitest";

/**
 * We test env validation by simulating the validation logic directly.
 * We cannot re-import the module because it evaluates at import time.
 *
 * The schema here must mirror `src/lib/env.ts` exactly.
 * When new variables are added to env.ts, add corresponding cases below.
 */

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1"),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_ORG_ID: z.string().optional(),
  OPENAI_FALLBACK_MODEL: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().optional(),
  NEXT_PUBLIC_CHAIN_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_EVENT_LOGGER_ADDRESS: z.string().optional(),
  NEXT_PUBLIC_POR_REGISTRY_ADDRESS: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  ADMIN_INITIAL_PASSWORD: z.string().optional(),
  ADMIN_ADDRESSES: z.string().optional(),
  HEARST_PUBLISHER: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  CHAINLINK_RPC_URL: z.string().url().optional(),
  // `.catch(undefined)` mirrors the P2 fix in src/lib/env.ts: an invalid raw
  // value degrades to `undefined` (never rejected) so one malformed optional
  // var can't fail the whole server-env parse and 500 every route at boot.
  NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .catch(undefined),
});

describe("env validation", () => {
  it("accepts a complete valid config", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-4.1",
      PRIVY_APP_SECRET: "secret",
      NEXT_PUBLIC_PRIVY_APP_ID: "app-id",
      NEXT_PUBLIC_CHAIN_RPC_URL: "https://sepolia.base.org",
    });
    expect(parsed.success).toBe(true);
  });

  it("fails when DATABASE_URL is missing", () => {
    const parsed = serverEnvSchema.safeParse({
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors).toHaveProperty("DATABASE_URL");
    }
  });

  it("defaults OPENAI_MODEL to gpt-4.1 when absent", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.OPENAI_MODEL).toBe("gpt-4.1");
    }
  });

  it("fails when OPENAI_BASE_URL is not a valid URL", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      OPENAI_BASE_URL: "not-a-url",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors).toHaveProperty("OPENAI_BASE_URL");
    }
  });

  it("rejects an invalid URL for NEXT_PUBLIC_CHAIN_RPC_URL", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      NEXT_PUBLIC_CHAIN_RPC_URL: "not-a-url",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors).toHaveProperty(
        "NEXT_PUBLIC_CHAIN_RPC_URL",
      );
    }
  });

  // ── New variables added in the WIP branch ──────────────────────────────────

  it("accepts ADMIN_EMAILS + ADMIN_INITIAL_PASSWORD (admin bootstrap, optional)", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      ADMIN_EMAILS: "ops@hearst.connect,founder@hearst.connect",
      ADMIN_INITIAL_PASSWORD: "change-me-now",
    });
    expect(parsed.success).toBe(true);
  });

  it("allows ADMIN_EMAILS to be absent (seed becomes a no-op)", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts valid UPSTASH_REDIS_REST_URL", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "tok_abc",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects UPSTASH_REDIS_REST_URL that is not a valid URL", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      UPSTASH_REDIS_REST_URL: "not-a-url",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors).toHaveProperty("UPSTASH_REDIS_REST_URL");
    }
  });

  it("allows UPSTASH_REDIS_REST_URL to be absent", () => {
    const parsed = serverEnvSchema.safeParse({ DATABASE_URL: "file:./prisma/dev.db" });
    expect(parsed.success).toBe(true);
  });

  it("accepts valid INNGEST_SIGNING_KEY", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      INNGEST_SIGNING_KEY: "signkey-test-abc123",
      INNGEST_EVENT_KEY: "evkey-test-xyz789",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts each valid LOG_LEVEL value", () => {
    for (const level of ["debug", "info", "warn", "error"] as const) {
      const parsed = serverEnvSchema.safeParse({
        DATABASE_URL: "file:./prisma/dev.db",
        LOG_LEVEL: level,
      });
      expect(parsed.success, `LOG_LEVEL=${level} should be accepted`).toBe(true);
    }
  });

  it("rejects an invalid LOG_LEVEL value", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      LOG_LEVEL: "verbose",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors).toHaveProperty("LOG_LEVEL");
    }
  });

  it("allows RESEND_API_KEY to be absent", () => {
    const parsed = serverEnvSchema.safeParse({ DATABASE_URL: "file:./prisma/dev.db" });
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid RESEND_API_KEY", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      RESEND_API_KEY: "re_abc123",
    });
    expect(parsed.success).toBe(true);
  });

  it("allows CHAINLINK_RPC_URL to be absent", () => {
    const parsed = serverEnvSchema.safeParse({ DATABASE_URL: "file:./prisma/dev.db" });
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid CHAINLINK_RPC_URL", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      CHAINLINK_RPC_URL: "https://eth-mainnet.chainlink.example.com",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects CHAINLINK_RPC_URL that is not a valid URL", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      CHAINLINK_RPC_URL: "not-a-url",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors).toHaveProperty("CHAINLINK_RPC_URL");
    }
  });

  // ── NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE (P2 fix — never throws at boot) ───────

  it("allows NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE to be absent", () => {
    const parsed = serverEnvSchema.safeParse({ DATABASE_URL: "file:./prisma/dev.db" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE).toBeUndefined();
    }
  });

  it("accepts a valid positive integer for NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE: "50000",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE).toBe(50000);
    }
  });

  it("degrades an empty-string NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE to undefined instead of failing the parse", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE).toBeUndefined();
    }
  });

  it("degrades a zero NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE to undefined instead of failing the parse", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE: "0",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE).toBeUndefined();
    }
  });

  it("degrades a decimal NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE to undefined instead of failing the parse", () => {
    const parsed = serverEnvSchema.safeParse({
      DATABASE_URL: "file:./prisma/dev.db",
      NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE: "1.5",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NEXT_PUBLIC_CHAIN_LOG_CHUNK_SIZE).toBeUndefined();
    }
  });
});
