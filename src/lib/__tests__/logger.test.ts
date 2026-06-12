import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for logger.ts — specifically that logger.error auto-forwards to
 * captureError (Sentry), while other levels do not.
 *
 * We cannot import logger.ts directly (it is `server-only` and imports env.ts
 * which crashes in test without DATABASE_URL). Instead we test the integration
 * point by mocking the module graph:
 *  - mock `server-only` (no-op)
 *  - mock `./env` to return a minimal env object
 *  - mock `./request-context` to return null
 *  - mock `./error-tracking` to spy on captureError
 *
 * Then import the logger and assert the call counts.
 */

vi.mock("server-only", () => ({}));

vi.mock("../env", () => ({
  env: {
    LOG_LEVEL: "debug",
    NODE_ENV: "test",
  },
}));

vi.mock("../request-context", () => ({
  getRequestContext: () => null,
}));

const mockCaptureError = vi.fn();
const mockCaptureMessage = vi.fn();
const mockSetUserContext = vi.fn();

vi.mock("../error-tracking", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  setUserContext: (...args: unknown[]) => mockSetUserContext(...args),
}));

describe("logger — Sentry integration", () => {
  let logger: typeof import("../logger").logger;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import the module fresh after mocks are established
    const mod = await import("../logger");
    logger = mod.logger;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("calls captureError when logger.error is invoked with an Error", () => {
    const err = new Error("boom");
    logger.error("something failed", { key: "value" }, err);
    expect(mockCaptureError).toHaveBeenCalledOnce();
    expect(mockCaptureError).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ key: "value" }),
    );
  });

  it("calls captureError with a fallback Error when no error object is passed", () => {
    logger.error("silent failure");
    expect(mockCaptureError).toHaveBeenCalledOnce();
    const [firstArg] = mockCaptureError.mock.calls[0] as [Error, ...unknown[]];
    expect(firstArg).toBeInstanceOf(Error);
    expect(firstArg.message).toBe("silent failure");
  });

  it("does NOT call captureError for logger.info", () => {
    logger.info("just info", { x: 1 });
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it("does NOT call captureError for logger.warn", () => {
    const err = new Error("warn-level");
    logger.warn("a warning", {}, err);
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it("does NOT call captureError for logger.debug", () => {
    logger.debug("debug noise");
    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});

describe("logger — userId PII guard", () => {
  let logger: typeof import("../logger").logger;
  let hashId: typeof import("../logger").hashId;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../logger");
    logger = mod.logger;
    hashId = mod.hashId;
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
    vi.resetModules();
  });

  it("hashes a raw userId passed in the call-site context (never plaintext)", () => {
    const raw = "user-secret-abc123";
    logger.info("did a thing", { userId: raw });
    const line = infoSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line) as { userId?: string };
    expect(parsed.userId).toBe(hashId(raw));
    expect(parsed.userId).not.toBe(raw);
    expect(line).not.toContain(raw);
  });

  it("forwards only the hashed userId to Sentry on error", () => {
    const raw = "user-secret-def456";
    logger.error("boom", { userId: raw }, new Error("x"));
    expect(mockCaptureError).toHaveBeenCalledOnce();
    const [, extra] = mockCaptureError.mock.calls[0] as [
      unknown,
      { userId?: string },
    ];
    expect(extra.userId).toBe(hashId(raw));
    expect(extra.userId).not.toBe(raw);
  });
});
