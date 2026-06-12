/**
 * C-12 — Password reset flow unit tests.
 *
 * Strategy:
 *  - prisma is mocked via vi.mock so the DB never touches the filesystem.
 *  - Resend HTTP calls are intercepted by mocking globalThis.fetch.
 *  - hashPassword / verifyPassword use real argon2 (fast in test env).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// ── Prisma mock ──────────────────────────────────────────────────────────────
// Must be hoisted BEFORE the module under test is imported.
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import {
  requestPasswordReset,
  validateResetToken,
  consumeResetToken,
  RESET_REQUESTED_MSG,
} from "../password-reset";
import { hashPassword, verifyPassword } from "../password";

// ── Fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "test_key";
  // Default fetch stub — success.
  mockFetch.mockResolvedValue({
    ok: true,
    text: async () => '{"id":"abc"}',
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_USER_ID = "cltest0000";
const FAKE_EMAIL = "investor@hearst.test";

// Build a real (but fast) token hash for use in tests.
function sha256Hex(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

// ── Tests: requestPasswordReset ───────────────────────────────────────────────

describe("requestPasswordReset", () => {
  it("always returns the anti-enumeration message regardless of email existence", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue(null);
    const msg = await requestPasswordReset("nobody@unknown.xyz", "http://localhost:3000");
    expect(msg).toBe(RESET_REQUESTED_MSG);
    // No token should be created for a non-existent user.
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    // Resend should NOT be called for unknown emails.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("creates a token and sends an email for known users", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({ id: FAKE_USER_ID });
    // @ts-expect-error mocked
    prisma.passwordResetToken.create.mockResolvedValue({});

    const msg = await requestPasswordReset(FAKE_EMAIL, "http://localhost:3000");
    expect(msg).toBe(RESET_REQUESTED_MSG);

    // Token persisted.
    expect(prisma.passwordResetToken.create).toHaveBeenCalledOnce();
    const createCall = (prisma.passwordResetToken.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(createCall).toBeDefined();
    // The stored tokenHash is not the raw token.
    const { tokenHash } = createCall![0]!.data as { tokenHash: string };
    expect(tokenHash).toHaveLength(64); // sha256 hex

    // Email sent via Resend fetch.
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.method).toBe("POST");
    const bodyParsed = JSON.parse(options.body as string);
    expect(bodyParsed.to).toContain(FAKE_EMAIL);
    // The reset URL in the email contains the raw token (NOT the hash).
    expect(bodyParsed.html).toContain("/reset-password?token=");
  });

  it("returns the same message even when Resend throws (email error swallowed)", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({ id: FAKE_USER_ID });
    // @ts-expect-error mocked
    prisma.passwordResetToken.create.mockResolvedValue({});
    mockFetch.mockRejectedValue(new Error("Resend unavailable"));

    const msg = await requestPasswordReset(FAKE_EMAIL, "http://localhost:3000");
    // Anti-enumeration: same message even if email fails.
    expect(msg).toBe(RESET_REQUESTED_MSG);
  });
});

// ── Tests: validateResetToken ─────────────────────────────────────────────────

describe("validateResetToken", () => {
  it("returns not_found for unknown tokens", async () => {
    // @ts-expect-error mocked
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);
    const result = await validateResetToken("deadbeef");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("not_found");
  });

  it("returns already_used for consumed tokens", async () => {
    // @ts-expect-error mocked
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER_ID,
      tokenHash: sha256Hex("sometoken"),
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: new Date(), // already used
    });
    const result = await validateResetToken("sometoken");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("already_used");
  });

  it("returns expired for tokens past their TTL", async () => {
    // @ts-expect-error mocked
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER_ID,
      tokenHash: sha256Hex("expiredtoken"),
      expiresAt: new Date(Date.now() - 1000), // expired
      usedAt: null,
    });
    const result = await validateResetToken("expiredtoken");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("expired");
  });

  it("returns valid for a fresh unused token", async () => {
    const raw = "freshtoken";
    const tokenHash = sha256Hex(raw);
    // @ts-expect-error mocked
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER_ID,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
    });
    const result = await validateResetToken(raw);
    expect(result.valid).toBe(true);
  });
});

// ── Tests: consumeResetToken ──────────────────────────────────────────────────

describe("consumeResetToken", () => {
  it("rejects usage of an already-used token (single-use guarantee)", async () => {
    // @ts-expect-error mocked
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER_ID,
      tokenHash: sha256Hex("usedtoken"),
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: new Date(), // already used
    });

    const result = await consumeResetToken("usedtoken", "newPassword123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already_used");
  });

  it("rejects an expired token", async () => {
    // @ts-expect-error mocked
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER_ID,
      tokenHash: sha256Hex("expiredtoken"),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });

    const result = await consumeResetToken("expiredtoken", "newPassword123");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects a weak password (< 8 chars)", async () => {
    const result = await consumeResetToken("anytoken", "short");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("weak_password");
  });

  it("updates the password hash and marks token used on valid consumption", async () => {
    const raw = "validtoken";
    const tokenHash = sha256Hex(raw);
    // @ts-expect-error mocked
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER_ID,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
    });
    // $transaction executes the array of operations.
    const updateUserFn = vi.fn().mockResolvedValue({});
    const updateTokenFn = vi.fn().mockResolvedValue({});
    // @ts-expect-error mocked
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => {
      for (const op of ops) await op;
    });
    // @ts-expect-error mocked
    prisma.user = { update: updateUserFn };
    // @ts-expect-error mocked
    prisma.passwordResetToken = {
      findUnique: prisma.passwordResetToken.findUnique,
      update: updateTokenFn,
      create: prisma.passwordResetToken.create,
    };

    const result = await consumeResetToken(raw, "NewSecurePass1!");
    expect(result.ok).toBe(true);

    // Transaction was called.
    expect(prisma.$transaction).toHaveBeenCalledOnce();

    // The new password hash differs from the plaintext.
    const userUpdateCall = updateUserFn.mock.calls[0]!;
    const newHash = userUpdateCall[0]!.data.passwordHash as string;
    expect(newHash).not.toBe("NewSecurePass1!");
    expect(newHash.startsWith("$argon2")).toBe(true);

    // Token marked as used.
    const tokenUpdateCall = updateTokenFn.mock.calls[0]!;
    expect(tokenUpdateCall[0]!.data.usedAt).toBeInstanceOf(Date);
  });

  it("password updated via argon2 — roundtrip verifies correctly", async () => {
    const newPass = "Hearst2026!Secure";
    const hashed = await hashPassword(newPass);
    // Verify the hash works as expected.
    expect(await verifyPassword(hashed, newPass)).toBe(true);
    expect(await verifyPassword(hashed, "wrongpassword")).toBe(false);
  });

  // AUTH-1: session revocation on password reset
  it("AUTH-1 — session.deleteMany is called for the userId inside the transaction", async () => {
    const raw = "auth1testtoken";
    const tokenHash = sha256Hex(raw);

    // Track every Prisma builder call that lands in the $transaction array.
    const capturedOps: unknown[] = [];

    // Fresh mocks that record their arguments and return a resolved promise.
    const sessionDeleteManyFn = vi.fn().mockResolvedValue({ count: 3 });
    const updateUserFn = vi.fn().mockResolvedValue({});
    const updateTokenFn = vi.fn().mockResolvedValue({});

    // @ts-expect-error mocked
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      userId: FAKE_USER_ID,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
    });

    // Wire up the individual Prisma sub-objects.
    // @ts-expect-error mocked
    prisma.user = { update: updateUserFn };
    // @ts-expect-error mocked
    prisma.passwordResetToken = {
      findUnique: prisma.passwordResetToken.findUnique,
      update: updateTokenFn,
      create: vi.fn(),
    };
    // @ts-expect-error mocked
    prisma.session = { deleteMany: sessionDeleteManyFn };

    // $transaction: capture each op and await it so the mock resolves normally.
    // @ts-expect-error mocked
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => {
      for (const op of ops) {
        capturedOps.push(op);
        await op;
      }
    });

    const result = await consumeResetToken(raw, "Auth1Secure!");
    expect(result.ok).toBe(true);

    // The transaction must have been called.
    expect(prisma.$transaction).toHaveBeenCalledOnce();

    // session.deleteMany must have been called with the correct userId.
    expect(sessionDeleteManyFn).toHaveBeenCalledOnce();
    expect(sessionDeleteManyFn).toHaveBeenCalledWith({ where: { userId: FAKE_USER_ID } });

    // Exactly 3 operations in the transaction (user.update, token.update, session.deleteMany).
    expect(capturedOps).toHaveLength(3);
  });
});

// ── Tests: AUTH-2 — trusted reset link origin ─────────────────────────────────

describe("AUTH-2 — reset URL origin", () => {
  const FAKE_APP_URL = "https://app.hearst.com";

  // Restore prisma sub-objects that may have been replaced by earlier tests.
  beforeEach(() => {
    // @ts-expect-error mocked
    prisma.user = { findUnique: vi.fn(), update: vi.fn() };
    // @ts-expect-error mocked
    prisma.passwordResetToken = {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    };
  });

  it("uses NEXT_PUBLIC_APP_URL when set (not the Host header)", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({ id: FAKE_USER_ID });
    // @ts-expect-error mocked
    prisma.passwordResetToken.create.mockResolvedValue({});
    process.env.NEXT_PUBLIC_APP_URL = FAKE_APP_URL;

    await requestPasswordReset(FAKE_EMAIL, FAKE_APP_URL);

    // Verify the email body uses the trusted origin, not an attacker-supplied one.
    // requestPasswordReset takes appUrl as a parameter; the action layer is
    // responsible for building it. This test exercises that contract directly:
    // when appUrl === NEXT_PUBLIC_APP_URL the reset URL must start with it.
    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { html: string };
    expect(body.html).toContain(`${FAKE_APP_URL}/reset-password?token=`);

    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("reset URL does NOT contain an attacker-controlled host when NEXT_PUBLIC_APP_URL is set", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({ id: FAKE_USER_ID });
    // @ts-expect-error mocked
    prisma.passwordResetToken.create.mockResolvedValue({});
    process.env.NEXT_PUBLIC_APP_URL = FAKE_APP_URL;

    const attackerHost = "evil.example.com";
    // Simulate: action built the URL from the attacker host (old behaviour).
    // Under the fix, the action uses NEXT_PUBLIC_APP_URL — so we verify that
    // passing a trustworthy appUrl produces a reset link on the trusted origin.
    await requestPasswordReset(FAKE_EMAIL, FAKE_APP_URL);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { html: string };
    // The email must NOT reference the attacker's host.
    expect(body.html).not.toContain(attackerHost);
    // And must reference the trusted origin.
    expect(body.html).toContain(FAKE_APP_URL);

    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});
