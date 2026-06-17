/**
 * KycDocumentForm — unit tests (node env, no jsdom; renderToStaticMarkup +
 * createElement capture, matching the repo's onboarding test convention).
 *
 * Covered:
 *   1. The form renders OUR native Cockpit markup — a <form>, the document-type
 *      and country selects, a file input, and the "Submit for verification" CTA.
 *   2. There is ZERO Sumsub asset / WebSDK / iframe / CDN reference in the output.
 *   3. Submitting the form calls the submitKycDocument server action with the
 *      FormData (the <form action={...}> wiring).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the server action so we can assert the form submit calls it.
const submitKycDocumentMock = vi.fn(async (_formData: FormData) => ({
  ok: true as const,
  applicantId: "appl-123",
}));

vi.mock("@/lib/onboarding/actions", () => ({
  submitKycDocument: (formData: FormData) => submitKycDocumentMock(formData),
}));

// next/navigation is not used by the form itself, but keep router stable in case.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { KycDocumentForm } from "../kyc-document-form";

beforeEach(() => {
  submitKycDocumentMock.mockClear();
});

// ---------------------------------------------------------------------------
// 1 + 2. Renders OUR markup, no Sumsub asset
// ---------------------------------------------------------------------------

describe("KycDocumentForm — markup", () => {
  it("renders a native Cockpit form with type, country, file and submit", () => {
    const html = renderToStaticMarkup(<KycDocumentForm />);

    // It is a real <form>, not an iframe / embed.
    expect(html).toContain("<form");
    expect(html).toContain('data-testid="kyc-document-form"');

    // Document type select + every Sumsub idDocType option value.
    expect(html).toContain('name="idDocType"');
    expect(html).toContain('value="PASSPORT"');
    expect(html).toContain('value="ID_CARD"');
    expect(html).toContain('value="DRIVERS"');
    expect(html).toContain('value="RESIDENCE_PERMIT"');

    // Country select (ISO3) + a known code.
    expect(html).toContain('name="country"');
    expect(html).toContain('value="GBR"');

    // File input wired to the action field name expected by the server.
    expect(html).toContain('name="file"');
    expect(html).toContain('type="file"');

    // The submit CTA.
    expect(html).toContain("Submit for verification");
    expect(html).toContain("Choose document");
  });

  it("ships ZERO Sumsub asset / WebSDK / iframe reference", () => {
    const html = renderToStaticMarkup(<KycDocumentForm />);

    expect(html).not.toContain("sumsub");
    expect(html).not.toContain("Sumsub");
    expect(html).not.toContain("static.sumsub.com");
    expect(html).not.toContain("snsWebSdk");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("Powered by");
  });
});

// ---------------------------------------------------------------------------
// 3. Submitting the form calls submitKycDocument with the FormData
// ---------------------------------------------------------------------------

describe("KycDocumentForm — submit wiring", () => {
  it("invokes submitKycDocument with the FormData when the form action fires", async () => {
    // The form action is bound at render time; walk the rendered React element
    // tree (no DOM) to recover the function passed to <form action={...}>.
    type FormActionFn = (formData: FormData) => void | Promise<void>;

    function findFormAction(node: unknown): FormActionFn | undefined {
      if (node === null || typeof node !== "object") return undefined;

      // React element: { type, props: { action?, children? } }.
      const el = node as {
        type?: unknown;
        props?: { action?: unknown; children?: unknown };
      };

      if (
        el.type === "form" &&
        typeof el.props?.action === "function"
      ) {
        return el.props.action as FormActionFn;
      }

      const children = el.props?.children;
      if (Array.isArray(children)) {
        for (const child of children) {
          const found = findFormAction(child);
          if (found) return found;
        }
      } else if (children) {
        return findFormAction(children);
      }
      return undefined;
    }

    // Render the component function once under React's static dispatcher so its
    // hooks resolve, then inspect the returned element tree.
    const ReactDOMServer = await import("react-dom/server");
    let capturedAction: FormActionFn | undefined;

    function Probe() {
      const element = KycDocumentForm({});
      capturedAction = findFormAction(element);
      return null;
    }

    ReactDOMServer.renderToStaticMarkup(<Probe />);

    expect(capturedAction).toBeTypeOf("function");

    const formData = new FormData();
    formData.set("idDocType", "PASSPORT");
    formData.set("country", "GBR");

    await capturedAction?.(formData);

    expect(submitKycDocumentMock).toHaveBeenCalledTimes(1);
    expect(submitKycDocumentMock).toHaveBeenCalledWith(formData);
  });
});
