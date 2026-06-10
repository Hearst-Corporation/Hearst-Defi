/**
 * C-09 — TOTP MFA unit tests.
 *
 * Covers:
 *  - OTPAuth.TOTP.validate accepts a valid code, rejects an invalid/expired one.
 *  - Secret is encrypted before persistence (never equal to the base32 plaintext).
 *  - Enrolment generates a QR data-URL starting with "data:image".
 *  - Confirmation: valid code → ok; invalid code → error.
 *  - verifyTotpCode: correct code → true; wrong code → false.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as OTPAuth from "otpauth";

// ── Prisma mock ──────────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("server-only", () => ({}));

import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "../crypto-util";
import {
  generateTotpEnrolment,
  confirmTotpEnrolment,
  verifyTotpCode,
  isTotpEnabled,
} from "../totp";

const FAKE_USER_ID = "cltestadmin01";
const FAKE_EMAIL = "admin@hearst.test";
const TOTP_KEY_HEX = "a".repeat(64); // deterministic test key

beforeEach(() => {
  vi.clearAllMocks();
  // Inject a valid 64-hex test key so crypto-util doesn't throw.
  process.env.AUTH_TOTP_KEY = TOTP_KEY_HEX;
});

// ── crypto-util: getKey guard ─────────────────────────────────────────────────

describe("crypto-util: getKey guard", () => {
  afterEach(() => {
    // Restore the valid key after each isolation test.
    process.env.AUTH_TOTP_KEY = TOTP_KEY_HEX;
  });

  it("throws a clear error when AUTH_TOTP_KEY is missing", () => {
    delete process.env.AUTH_TOTP_KEY;
    expect(() => encrypt("anything")).toThrow(
      "AUTH_TOTP_KEY is missing or not 64 hex chars",
    );
  });

  it("throws a clear error when AUTH_TOTP_KEY is too short", () => {
    process.env.AUTH_TOTP_KEY = "abc123";
    expect(() => encrypt("anything")).toThrow(
      "AUTH_TOTP_KEY is missing or not 64 hex chars",
    );
  });

  it("throws a clear error when AUTH_TOTP_KEY contains non-hex characters", () => {
    // 64 chars but includes non-hex 'z'
    process.env.AUTH_TOTP_KEY = "z".repeat(64);
    expect(() => encrypt("anything")).toThrow(
      "AUTH_TOTP_KEY is missing or not 64 hex chars",
    );
  });

  it("throws a clear error when AUTH_TOTP_KEY is exactly 63 hex chars (one short)", () => {
    process.env.AUTH_TOTP_KEY = "a".repeat(63);
    expect(() => encrypt("anything")).toThrow(
      "AUTH_TOTP_KEY is missing or not 64 hex chars",
    );
  });

  it("does NOT throw with a valid 64-hex-char key", () => {
    process.env.AUTH_TOTP_KEY = TOTP_KEY_HEX;
    expect(() => encrypt("anything")).not.toThrow();
  });
});

// ── AES-256-GCM encryption util ───────────────────────────────────────────────

describe("crypto-util: AES-256-GCM roundtrip", () => {
  it("encrypts and decrypts back to the original plaintext", () => {
    const plain = "JBSWY3DPEHPK3PXP"; // sample base32
    const cipher = encrypt(plain);
    expect(cipher).not.toBe(plain);
    expect(cipher.split(":").length).toBe(3); // iv:tag:data
    expect(decrypt(cipher)).toBe(plain);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const plain = "SAMEBASE32SECRET";
    const c1 = encrypt(plain);
    const c2 = encrypt(plain);
    expect(c1).not.toBe(c2);
    // Both decrypt to the same plaintext.
    expect(decrypt(c1)).toBe(plain);
    expect(decrypt(c2)).toBe(plain);
  });

  it("throws when the auth tag is tampered (GCM integrity)", () => {
    const plain = "INVIOLABLE";
    const cipher = encrypt(plain);
    const parts = cipher.split(":");
    // Corrupt the auth tag.
    parts[1] = "0".repeat(32);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});

// ── OTPAuth TOTP validation ───────────────────────────────────────────────────

describe("OTPAuth.TOTP validation", () => {
  it("accepts a currently valid code", () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "Test",
      label: "test@example.com",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    const code = totp.generate();
    const delta = totp.validate({ token: code, window: 1 });
    expect(delta).not.toBeNull();
  });

  it("rejects an obviously wrong code", () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "Test",
      label: "test@example.com",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    // "000000" is astronomically unlikely to be the valid code right now.
    const delta = totp.validate({ token: "000000", window: 0 });
    // delta should be null in virtually all cases; if "000000" happens to be valid, skip.
    if (totp.generate() !== "000000") {
      expect(delta).toBeNull();
    }
  });

  it("rejects a code from a different secret", () => {
    const secret1 = new OTPAuth.Secret({ size: 20 });
    const secret2 = new OTPAuth.Secret({ size: 20 });
    const totp1 = new OTPAuth.TOTP({ issuer: "T", label: "a@b.c", algorithm: "SHA1", digits: 6, period: 30, secret: secret1 });
    const totp2 = new OTPAuth.TOTP({ issuer: "T", label: "a@b.c", algorithm: "SHA1", digits: 6, period: 30, secret: secret2 });
    const code = totp1.generate();
    // code from totp1 should not validate against totp2 (with very high probability).
    const delta = totp2.validate({ token: code, window: 0 });
    if (totp2.generate() !== code) {
      expect(delta).toBeNull();
    }
  });
});

// ── generateTotpEnrolment ─────────────────────────────────────────────────────

describe("generateTotpEnrolment", () => {
  it("returns a QR data-URL starting with 'data:image'", async () => {
    // @ts-expect-error mocked
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: FAKE_USER_ID, email: FAKE_EMAIL });

    const payload = await generateTotpEnrolment(FAKE_USER_ID);

    expect(payload.qrDataUrl.startsWith("data:image")).toBe(true);
    expect(payload.secretBase32).toBeTruthy();
    expect(payload.otpauthUri.startsWith("otpauth://totp/")).toBe(true);
  });

  it("does NOT persist anything (no user.update call)", async () => {
    // @ts-expect-error mocked
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: FAKE_USER_ID, email: FAKE_EMAIL });

    await generateTotpEnrolment(FAKE_USER_ID);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

// ── confirmTotpEnrolment ──────────────────────────────────────────────────────

describe("confirmTotpEnrolment", () => {
  it("persists an ENCRYPTED secret — never the base32 plaintext", async () => {
    // @ts-expect-error mocked
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: FAKE_USER_ID, email: FAKE_EMAIL });
    // @ts-expect-error mocked
    prisma.user.update.mockResolvedValue({});

    const secret = new OTPAuth.Secret({ size: 20 });
    const base32Secret = secret.base32;
    const totp = new OTPAuth.TOTP({
      issuer: "Hearst Connect",
      label: FAKE_EMAIL,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    const code = totp.generate();

    const result = await confirmTotpEnrolment(FAKE_USER_ID, base32Secret, code);
    expect(result.ok).toBe(true);

    // The value persisted to the DB must NOT be the plaintext base32 secret.
    const updateCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0]![0]!;
    const persistedSecret = updateCall.data.totpSecret as string;
    expect(persistedSecret).not.toBe(base32Secret);
    // It must be decryptable back to the original.
    expect(decrypt(persistedSecret)).toBe(base32Secret);
  });

  it("rejects an invalid code", async () => {
    // @ts-expect-error mocked
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: FAKE_USER_ID, email: FAKE_EMAIL });

    const secret = new OTPAuth.Secret({ size: 20 });
    const result = await confirmTotpEnrolment(FAKE_USER_ID, secret.base32, "000000");

    // Unless 000000 happens to be valid this step, expect failure.
    const totp = new OTPAuth.TOTP({
      issuer: "Hearst Connect",
      label: FAKE_EMAIL,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    if (totp.generate() !== "000000") {
      expect(result.ok).toBe(false);
      expect(prisma.user.update).not.toHaveBeenCalled();
    }
  });
});

// ── verifyTotpCode ────────────────────────────────────────────────────────────

// Fixed epoch: 2026-01-01 00:00:00 UTC → step = floor(1735689600 / 30) = 57856320
const FIXED_EPOCH_MS = 1735689600_000;
const FIXED_STEP = Math.floor(FIXED_EPOCH_MS / 1000 / 30); // 57856320

describe("verifyTotpCode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_EPOCH_MS);
    // @ts-expect-error mocked
    prisma.user.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a valid code, calls update with the computed step, returns true", async () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const encryptedSecret = encrypt(secret.base32);
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({
      email: FAKE_EMAIL,
      totpSecret: encryptedSecret,
      totpEnabledAt: new Date(),
      totpLastUsedStep: null,
    });

    const totp = new OTPAuth.TOTP({
      issuer: "Hearst Connect",
      label: FAKE_EMAIL,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    // generate() uses Date.now() internally — fake timers ensure this is FIXED_STEP
    const code = totp.generate();

    const result = await verifyTotpCode(FAKE_USER_ID, code);
    expect(result).toBe(true);

    const updateCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0]![0]!;
    // delta for the current step is 0, so usedStep = FIXED_STEP + 0
    expect(updateCall.data.totpLastUsedStep).toBe(FIXED_STEP);
  });

  it("rejects the same code (same step) on second attempt — replay guard", async () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const encryptedSecret = encrypt(secret.base32);

    const totp = new OTPAuth.TOTP({
      issuer: "Hearst Connect",
      label: FAKE_EMAIL,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    const code = totp.generate(); // valid at FIXED_STEP

    // Second attempt: totpLastUsedStep is already at FIXED_STEP
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({
      email: FAKE_EMAIL,
      totpSecret: encryptedSecret,
      totpEnabledAt: new Date(),
      totpLastUsedStep: FIXED_STEP,
    });

    const result = await verifyTotpCode(FAKE_USER_ID, code);
    expect(result).toBe(false);
    // update must NOT be called — replay is rejected before persisting
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("accepts a code from a later step (higher step) and advances the marker", async () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const encryptedSecret = encrypt(secret.base32);

    // Advance time by one period so OTPAuth generates the NEXT step's code
    vi.setSystemTime(FIXED_EPOCH_MS + 30_000);
    const nextStep = FIXED_STEP + 1;

    const totp = new OTPAuth.TOTP({
      issuer: "Hearst Connect",
      label: FAKE_EMAIL,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    const nextCode = totp.generate(); // valid at FIXED_STEP + 1

    // Last used step is the previous step
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({
      email: FAKE_EMAIL,
      totpSecret: encryptedSecret,
      totpEnabledAt: new Date(),
      totpLastUsedStep: FIXED_STEP,
    });

    const result = await verifyTotpCode(FAKE_USER_ID, nextCode);
    expect(result).toBe(true);

    const updateCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0]![0]!;
    expect(updateCall.data.totpLastUsedStep).toBe(nextStep);
  });

  it("returns false for a wrong code without calling update", async () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const encryptedSecret = encrypt(secret.base32);
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({
      email: FAKE_EMAIL,
      totpSecret: encryptedSecret,
      totpEnabledAt: new Date(),
      totpLastUsedStep: null,
    });

    const totp = new OTPAuth.TOTP({
      issuer: "Hearst Connect",
      label: FAKE_EMAIL,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    const validCode = totp.generate();
    const wrongCode = (parseInt(validCode, 10) + 1).toString().padStart(6, "0");

    if (wrongCode !== validCode) {
      const result = await verifyTotpCode(FAKE_USER_ID, wrongCode);
      expect(result).toBe(false);
      expect(prisma.user.update).not.toHaveBeenCalled();
    }
  });

  it("returns false when TOTP is not enrolled", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({
      email: FAKE_EMAIL,
      totpSecret: null,
      totpEnabledAt: null,
      totpLastUsedStep: null,
    });
    const result = await verifyTotpCode(FAKE_USER_ID, "123456");
    expect(result).toBe(false);
  });

  it("returns false when the stored secret is corrupt ciphertext", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({
      email: FAKE_EMAIL,
      totpSecret: "corrupt:data:here",
      totpEnabledAt: new Date(),
      totpLastUsedStep: null,
    });
    const result = await verifyTotpCode(FAKE_USER_ID, "123456");
    expect(result).toBe(false);
  });
});

// ── isTotpEnabled ─────────────────────────────────────────────────────────────

describe("isTotpEnabled", () => {
  it("returns false when totpEnabledAt is null", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: null });
    expect(await isTotpEnabled(FAKE_USER_ID)).toBe(false);
  });

  it("returns true when totpEnabledAt is set", async () => {
    // @ts-expect-error mocked
    prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: new Date() });
    expect(await isTotpEnabled(FAKE_USER_ID)).toBe(true);
  });
});
