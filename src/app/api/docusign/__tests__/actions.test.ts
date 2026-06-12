/**
 * createSubscriptionEnvelope — Vitest unit tests.
 *
 * All HTTP calls are mocked via `vi.stubGlobal("fetch", …)` so no real
 * DocuSign API is contacted. Prisma is mocked so no DB is required.
 *
 * Coverage:
 *   1. Happy path: creates envelope, persists to DB, returns { envelopeId, signingUrl }.
 *   2. Missing env vars throw a clear error before any fetch call.
 *   3. DocuSign createEnvelope HTTP error propagates.
 *   4. DocuSign createRecipientView HTTP error propagates.
 *   5. Invalid input (negative amount) throws validation error.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma before importing the module under test
// ---------------------------------------------------------------------------

const mockCreate = vi.fn().mockResolvedValue({ id: "env-1" });

vi.mock("@/lib/db", () => ({
  prisma: {
    subscriptionEnvelope: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------

import {
  createSubscriptionEnvelope,
  docusignCreateEnvelope,
  docusignCreateRecipientView,
} from "@/lib/docusign/envelope";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelopeResponse(envelopeId = "env-abc-123") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "",
    json: async () => ({ envelopeId, status: "sent" }),
  } as unknown as Response;
}

function makeRecipientViewResponse(url = "https://demo.docusign.net/signing?t=abc") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "",
    json: async () => ({ url }),
  } as unknown as Response;
}

function makeErrorResponse(status = 400, statusText = "Bad Request", body = "error body") {
  return {
    ok: false,
    status,
    statusText,
    text: async () => body,
    json: async () => ({}),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("docusignCreateEnvelope", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns envelopeId on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeEnvelopeResponse("env-xyz")));

    const result = await docusignCreateEnvelope(
      "https://demo.docusign.net/restapi",
      "test-api-key",
      "account-id-1",
      { userId: "user-1", email: "user1@example.com", vaultId: "vault-1", amount: 250_000 },
    );

    expect(result.envelopeId).toBe("env-xyz");
    expect(result.status).toBe("sent");
  });

  it("throws on HTTP error from DocuSign", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeErrorResponse(401, "Unauthorized", "bad token")));

    await expect(
      docusignCreateEnvelope(
        "https://demo.docusign.net/restapi",
        "bad-key",
        "account-id-1",
        { userId: "user-1", email: "user1@example.com", vaultId: "vault-1", amount: 250_000 },
      ),
    ).rejects.toThrow("DocuSign createEnvelope failed: 401 Unauthorized");
  });
});

describe("docusignCreateRecipientView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns signing URL on success", async () => {
    const url = "https://demo.docusign.net/signing?t=token123";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeRecipientViewResponse(url)));

    const result = await docusignCreateRecipientView(
      "https://demo.docusign.net/restapi",
      "test-api-key",
      "account-id-1",
      "env-abc",
      { userId: "user-1", email: "user1@example.com", returnUrl: "https://connect.hearst.app/profile" },
    );

    expect(result).toBe(url);
  });

  it("throws on HTTP error from DocuSign", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(makeErrorResponse(404, "Not Found", "envelope not found")));

    await expect(
      docusignCreateRecipientView(
        "https://demo.docusign.net/restapi",
        "test-api-key",
        "account-id-1",
        "env-missing",
        { userId: "user-1", email: "user1@example.com", returnUrl: "https://connect.hearst.app/profile" },
      ),
    ).rejects.toThrow("DocuSign createRecipientView failed: 404 Not Found");
  });
});

describe("createSubscriptionEnvelope (server action)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.DOCUSIGN_BASE_URL = "https://demo.docusign.net/restapi";
    process.env.DOCUSIGN_API_KEY = "mock-api-key";
    process.env.DOCUSIGN_ACCOUNT_ID = "mock-account-id";
    mockCreate.mockClear();
  });

  afterEach(() => {
    process.env.DOCUSIGN_BASE_URL = originalEnv.DOCUSIGN_BASE_URL;
    process.env.DOCUSIGN_API_KEY = originalEnv.DOCUSIGN_API_KEY;
    process.env.DOCUSIGN_ACCOUNT_ID = originalEnv.DOCUSIGN_ACCOUNT_ID;
    vi.restoreAllMocks();
  });

  it("happy path: creates envelope, persists to DB, returns result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeEnvelopeResponse("env-happy"))
      .mockResolvedValueOnce(makeRecipientViewResponse("https://demo.docusign.net/signing?t=happy"));

    vi.stubGlobal("fetch", fetchMock);

    const result = await createSubscriptionEnvelope("user-1", "vault-1", 250_000, "user1@example.com");

    expect(result.envelopeId).toBe("env-happy");
    expect(result.signingUrl).toBe("https://demo.docusign.net/signing?t=happy");

    // DB persistence — verify prisma.subscriptionEnvelope.create was called with correct data
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        vaultId: "vault-1",
        envelopeId: "env-happy",
        status: "sent",
      },
    });
  });

  it("throws when DOCUSIGN_BASE_URL is missing", async () => {
    delete process.env.DOCUSIGN_BASE_URL;

    await expect(
      createSubscriptionEnvelope("user-1", "vault-1", 250_000, "user1@example.com"),
    ).rejects.toThrow("Missing DocuSign configuration");

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws when DOCUSIGN_API_KEY is missing", async () => {
    delete process.env.DOCUSIGN_API_KEY;

    await expect(
      createSubscriptionEnvelope("user-1", "vault-1", 250_000, "user1@example.com"),
    ).rejects.toThrow("Missing DocuSign configuration");

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws on invalid input (negative amount)", async () => {
    await expect(
      createSubscriptionEnvelope("user-1", "vault-1", -1, "user1@example.com"),
    ).rejects.toThrow("Invalid input");

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("does not persist to DB if createEnvelope fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error", "DocuSign down")),
    );

    await expect(
      createSubscriptionEnvelope("user-1", "vault-1", 250_000, "user1@example.com"),
    ).rejects.toThrow("DocuSign createEnvelope failed");

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("does not return signingUrl if createRecipientView fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeEnvelopeResponse("env-partial"))
        .mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error", "view error")),
    );

    await expect(
      createSubscriptionEnvelope("user-1", "vault-1", 250_000, "user1@example.com"),
    ).rejects.toThrow("DocuSign createRecipientView failed");
  });
});
