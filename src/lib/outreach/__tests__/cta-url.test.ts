import { afterEach, describe, expect, it, vi } from "vitest";

import { bodyHasCtaUrl, ensureCtaInBody, resolveCtaUrl } from "../cta-url";

const PROD_FALLBACK = "https://connect.hearst.app/apply";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveCtaUrl", () => {
  it("prefers the explicit qualification-form override", () => {
    vi.stubEnv("NEXT_PUBLIC_QUALIFICATION_FORM_URL", "https://forms.example/q");
    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_URL", "https://typeform.example/legacy");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:4105");
    expect(resolveCtaUrl()).toBe("https://forms.example/q");
  });

  it("falls back to the legacy typeform alias when no explicit override", () => {
    vi.stubEnv("NEXT_PUBLIC_QUALIFICATION_FORM_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_URL", "https://typeform.example/legacy");
    expect(resolveCtaUrl()).toBe("https://typeform.example/legacy");
  });

  it("trims surrounding whitespace on an explicit override", () => {
    vi.stubEnv("NEXT_PUBLIC_QUALIFICATION_FORM_URL", "  https://forms.example/q  ");
    expect(resolveCtaUrl()).toBe("https://forms.example/q");
  });

  it("uses the in-app /apply funnel on the configured app base when no override", () => {
    vi.stubEnv("NEXT_PUBLIC_QUALIFICATION_FORM_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:4105");
    expect(resolveCtaUrl()).toBe("http://localhost:4105/apply");
  });

  it("strips a trailing slash on the app base so /apply never doubles up", () => {
    vi.stubEnv("NEXT_PUBLIC_QUALIFICATION_FORM_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.hearst.app/");
    expect(resolveCtaUrl()).toBe("https://staging.hearst.app/apply");
  });

  it("falls back to the production host as a last resort", () => {
    vi.stubEnv("NEXT_PUBLIC_QUALIFICATION_FORM_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    expect(resolveCtaUrl()).toBe(PROD_FALLBACK);
  });

  it("treats a whitespace-only override as absent", () => {
    vi.stubEnv("NEXT_PUBLIC_QUALIFICATION_FORM_URL", "   ");
    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
    expect(resolveCtaUrl()).toBe("https://app.example/apply");
  });
});

describe("bodyHasCtaUrl", () => {
  it("detects an embedded CTA URL", () => {
    expect(bodyHasCtaUrl(`see ${PROD_FALLBACK} now`, PROD_FALLBACK)).toBe(true);
  });

  it("returns false when the URL is absent", () => {
    expect(bodyHasCtaUrl("no link here", PROD_FALLBACK)).toBe(false);
  });

  it("ignores surrounding whitespace on the CTA URL", () => {
    expect(bodyHasCtaUrl(`go to ${PROD_FALLBACK}`, `  ${PROD_FALLBACK}  `)).toBe(true);
  });
});

describe("ensureCtaInBody", () => {
  it("appends the CTA when the body omits it", () => {
    const out = ensureCtaInBody("Short greeting.\n\nBest,", PROD_FALLBACK);
    expect(out).toContain(PROD_FALLBACK);
    expect(out.startsWith("Short greeting.")).toBe(true);
  });

  it("leaves the body untouched when the CTA is already present", () => {
    const body = `Hello — qualify at ${PROD_FALLBACK}.`;
    expect(ensureCtaInBody(body, PROD_FALLBACK)).toBe(body);
  });

  it("never appends an empty CTA URL", () => {
    const body = "Hello there.";
    expect(ensureCtaInBody(body, "   ")).toBe(body);
  });

  it("does not append the CTA twice across repeated calls", () => {
    const once = ensureCtaInBody("Greeting.", PROD_FALLBACK);
    const twice = ensureCtaInBody(once, PROD_FALLBACK);
    expect(twice).toBe(once);
    expect(twice.split(PROD_FALLBACK).length - 1).toBe(1);
  });
});
