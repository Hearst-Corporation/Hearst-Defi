/**
 * Unit tests for src/app/admin/security/actions.ts
 *
 * These server actions wrap the admin-only 2FA TOTP enrolment flow:
 *   - `startEnrolment()` — requireAdmin, then generate a fresh TOTP secret + QR.
 *     Nothing is persisted here; the payload is returned to the UI.
 *   - `confirmEnrolment(input)` — requireAdmin, validate the shape (base32
 *     secret present + 6-digit code), then delegate to `confirmTotpEnrolment`
 *     which validates the code and persists the encrypted secret on success.
 *
 * The TOTP primitives (`generateTotpEnrolment` / `confirmTotpEnrolment`) live in
 * `@/lib/auth/totp` and are mocked here — they own prisma + otpauth + crypto and
 * are unit-tested separately. These tests pin the ACTION layer:
 *   - requireAdmin gating: a non-admin (requireAdmin throws) is rejected and the
 *     TOTP primitives are never reached.
 *   - start: the generated secret/QR payload flows straight back to the caller.
 *   - confirm with a CORRECT code → { ok: true } and the page is revalidated.
 *   - confirm with an INCORRECT code → { ok: false, error } and NO revalidation.
 *   - malformed input (missing secret / non-6-digit code) is rejected before the
 *     primitive is ever called.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (declared before module import) ────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/auth/totp", () => ({
  generateTotpEnrolment: vi.fn(),
  confirmTotpEnrolment: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { generateTotpEnrolment, confirmTotpEnrolment } from "@/lib/auth/totp";
import { revalidatePath } from "next/cache";
import { startEnrolment, confirmEnrolment } from "../actions";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ADMIN = { userId: "admin_sec" } as const;

const ENROLMENT_PAYLOAD = {
  otpauthUri: "otpauth://totp/Hearst%20Connect:a@b.com?secret=JBSWY3DPEHPK3PXP",
  qrDataUrl: "data:image/png;base64,QRQRQR",
  secretBase32: "JBSWY3DPEHPK3PXP",
} as const;

// ── startEnrolment ─────────────────────────────────────────────────────────────

describe("startEnrolment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
    vi.mocked(generateTotpEnrolment).mockResolvedValue(ENROLMENT_PAYLOAD);
  });

  it("gates on requireAdmin and generates a secret for the admin user id", async () => {
    const result = await startEnrolment();

    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(generateTotpEnrolment).toHaveBeenCalledTimes(1);
    expect(generateTotpEnrolment).toHaveBeenCalledWith(ADMIN.userId);

    // The generated payload (secret + QR) flows straight back to the caller.
    expect(result).toEqual(ENROLMENT_PAYLOAD);
  });

  it("REJECTS a non-admin caller and never generates a secret", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(startEnrolment()).rejects.toThrow("Admin access required.");

    expect(generateTotpEnrolment).not.toHaveBeenCalled();
  });
});

// ── confirmEnrolment ───────────────────────────────────────────────────────────

describe("confirmEnrolment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
  });

  it("gates on requireAdmin: a non-admin is rejected before the code is checked", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(
      confirmEnrolment({ secretBase32: ENROLMENT_PAYLOAD.secretBase32, code: "123456" }),
    ).rejects.toThrow("Admin access required.");

    expect(confirmTotpEnrolment).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("confirms enrolment with a CORRECT code → { ok: true } and revalidates the page", async () => {
    vi.mocked(confirmTotpEnrolment).mockResolvedValue({ ok: true });

    const result = await confirmEnrolment({
      secretBase32: ENROLMENT_PAYLOAD.secretBase32,
      code: "123456",
    });

    expect(result).toEqual({ ok: true });
    expect(confirmTotpEnrolment).toHaveBeenCalledTimes(1);
    expect(confirmTotpEnrolment).toHaveBeenCalledWith(
      ADMIN.userId,
      ENROLMENT_PAYLOAD.secretBase32,
      "123456",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/security");
  });

  it("rejects an INCORRECT code → { ok: false, error } and does NOT revalidate", async () => {
    vi.mocked(confirmTotpEnrolment).mockResolvedValue({
      ok: false,
      error: "Invalid code. Check your authenticator app and try again.",
    });

    const result = await confirmEnrolment({
      secretBase32: ENROLMENT_PAYLOAD.secretBase32,
      code: "000000",
    });

    expect(result).toEqual({
      ok: false,
      error: "Invalid code. Check your authenticator app and try again.",
    });
    expect(confirmTotpEnrolment).toHaveBeenCalledWith(
      ADMIN.userId,
      ENROLMENT_PAYLOAD.secretBase32,
      "000000",
    );
    // A failed confirmation must not revalidate (nothing was persisted).
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reads secret + code from a FormData input and confirms on a valid code", async () => {
    vi.mocked(confirmTotpEnrolment).mockResolvedValue({ ok: true });

    const fd = new FormData();
    fd.set("secretBase32", ENROLMENT_PAYLOAD.secretBase32);
    fd.set("code", "654321");

    const result = await confirmEnrolment(fd);

    expect(result).toEqual({ ok: true });
    expect(confirmTotpEnrolment).toHaveBeenCalledWith(
      ADMIN.userId,
      ENROLMENT_PAYLOAD.secretBase32,
      "654321",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/security");
  });

  it("REJECTS a missing secret before the TOTP primitive is called", async () => {
    const result = await confirmEnrolment({ code: "123456" });

    expect(result).toEqual({ ok: false, error: "Missing secret." });
    expect(confirmTotpEnrolment).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("REJECTS a non-6-digit code before the TOTP primitive is called", async () => {
    const result = await confirmEnrolment({
      secretBase32: ENROLMENT_PAYLOAD.secretBase32,
      code: "12ab",
    });

    expect(result).toEqual({
      ok: false,
      error: "Enter the 6-digit code from your authenticator app.",
    });
    expect(confirmTotpEnrolment).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
