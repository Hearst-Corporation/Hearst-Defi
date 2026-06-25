import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  probeReviewMode,
  __resetReviewModeProbe,
} from "@/lib/admin/review-mode-probe";

// The shared probe must hit /api/admin/review-mode AT MOST ONCE per session:
// the first caller fetches, concurrent callers share the in-flight promise, and
// the resolved result is cached for subsequent callers (zero extra network).

const fetchMock = vi.fn();

beforeEach(() => {
  __resetReviewModeProbe();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  __resetReviewModeProbe();
});

function okResponse(mode: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ mode }),
  } as unknown as Response;
}
function errResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({ error: "nope" }),
  } as unknown as Response;
}

describe("probeReviewMode — dedup + cache", () => {
  it("admin: fetches once and reports the mode", async () => {
    fetchMock.mockResolvedValue(okResponse("review"));
    const result = await probeReviewMode();
    expect(result).toEqual({ isAdmin: true, mode: "review" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/review-mode");
  });

  it("caches the admin result — a second caller does NOT re-fetch", async () => {
    fetchMock.mockResolvedValue(okResponse("admin"));
    await probeReviewMode();
    await probeReviewMode();
    await probeReviewMode();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedups concurrent callers into a single in-flight request", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((r) => {
        resolveFetch = r;
      }),
    );
    // Fire three probes before the fetch resolves.
    const p1 = probeReviewMode();
    const p2 = probeReviewMode();
    const p3 = probeReviewMode();
    resolveFetch(okResponse("normal"));
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // ONE request for three callers
    expect(r1).toEqual({ isAdmin: true, mode: "normal" });
    expect(r2).toEqual(r1);
    expect(r3).toEqual(r1);
  });

  it("non-admin (403): fails closed and caches (LP majority never re-hits)", async () => {
    fetchMock.mockResolvedValue(errResponse(403));
    const a = await probeReviewMode();
    const b = await probeReviewMode();
    expect(a).toEqual({ isAdmin: false, mode: null });
    expect(b).toEqual(a);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 403 is a definitive "not admin"
  });

  it("logged-out (401): fails closed and caches", async () => {
    fetchMock.mockResolvedValue(errResponse(401));
    expect(await probeReviewMode()).toEqual({ isAdmin: false, mode: null });
    await probeReviewMode();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limited (429): fails closed but does NOT cache — a later caller retries", async () => {
    fetchMock.mockResolvedValueOnce(errResponse(429));
    const first = await probeReviewMode();
    expect(first).toEqual({ isAdmin: false, mode: null });
    // The limiter clears; a later caller should be allowed to probe again.
    fetchMock.mockResolvedValueOnce(okResponse("review"));
    const second = await probeReviewMode();
    expect(second).toEqual({ isAdmin: true, mode: "review" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("network error: fails closed without caching (allows retry)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await probeReviewMode()).toEqual({ isAdmin: false, mode: null });
    fetchMock.mockResolvedValueOnce(okResponse("admin"));
    expect(await probeReviewMode()).toEqual({ isAdmin: true, mode: "admin" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
