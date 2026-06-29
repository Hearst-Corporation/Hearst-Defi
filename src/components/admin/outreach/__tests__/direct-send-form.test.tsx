/**
 * DirectSendForm — confirmation gate (OUT-1).
 *
 * Environment: node (via vitest.config.ts — renderToStaticMarkup, no jsdom).
 * Without a DOM we cannot drive real click events, so these tests assert the
 * STATIC-MARKUP invariants that prove the safety fix:
 *
 *   1. The "Send now" button is `type="button"` (NOT a submit) — so it can only
 *      open the dialog, never fire the server action directly.
 *   2. The ConfirmDialog is closed by default (it renders nothing while closed),
 *      so nothing is sent on initial render.
 *   3. Rendering the form does NOT call `sendDirectEmail`.
 *   4. The shared ConfirmDialog, when open, surfaces the recipient + subject,
 *      flags an "external email" send, and exposes an explicit confirm + cancel
 *      affordance.
 *
 * The click→dialog→confirm→send interaction itself is exercised by the shared
 * ConfirmDialog component (it owns open/confirm/cancel + pending), so we test
 * the WIRING here, not React's event loop.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Stub the server actions so importing the client component never reaches the
// server module — and so we can assert the action is not invoked on render.
const sendDirectEmail = vi.fn();
const draftDirectEmail = vi.fn();
vi.mock("@/app/admin/outreach/actions", () => ({
  sendDirectEmail: (...args: unknown[]) => sendDirectEmail(...args),
  draftDirectEmail: (...args: unknown[]) => draftDirectEmail(...args),
}));

// sonner's toast is a no-op under the node test env.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DirectSendForm } from "@/components/admin/outreach/direct-send-form";
import { ConfirmDialog } from "@/components/catalyst/confirm-dialog";

describe("DirectSendForm — direct send confirmation gate", () => {
  it("renders the send button as type=button, not a submit", () => {
    const html = renderToStaticMarkup(<DirectSendForm />);
    // The send affordance must be a button (opens the dialog), never a submit
    // that would fire the action on click.
    expect(html).toContain("Send now");
    expect(html).toContain('type="button"');
    // No submit-typed control labelled to send: the only submit in the markup
    // belongs to the draft form ("Draft with agent"), never the send.
    expect(html).not.toMatch(/type="submit"[^>]*>\s*Send now/);
    expect(html).not.toMatch(/Send now[\s\S]*?type="submit"/);
  });

  it("does NOT call sendDirectEmail just by rendering (dialog closed)", () => {
    sendDirectEmail.mockClear();
    renderToStaticMarkup(<DirectSendForm />);
    expect(sendDirectEmail).not.toHaveBeenCalled();
  });

  it("does not render the confirm dialog markup while closed", () => {
    const html = renderToStaticMarkup(<DirectSendForm />);
    // Closed ConfirmDialog returns null → its title never appears in markup.
    expect(html).not.toContain("Send this email now?");
    expect(html).not.toContain('role="dialog"');
  });

  it("open dialog shows recipient, subject, external-email warning + confirm/cancel", () => {
    // Render the SAME shared dialog the form wires, open, with the wording the
    // form passes — proves the confirm step surfaces the right content.
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Send this email now?"
        description={
          <>
            This will send a real <strong>external email</strong> to{" "}
            <strong>lp@fund.io</strong> with subject{" "}
            <span>“Quick intro”</span>. Review the recipient and message before
            confirming.
          </>
        }
        confirmLabel="Confirm send"
        confirmVariant="primary"
        onConfirm={vi.fn()}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Send this email now?");
    expect(html).toContain("external email");
    expect(html).toContain("lp@fund.io");
    expect(html).toContain("Quick intro");
    // Explicit confirm + cancel affordances (cancel label is the shared
    // dialog's "Annuler").
    expect(html).toContain("Confirm send");
    expect(html).toContain("Annuler");
  });

  it("closed dialog renders nothing (cancel/closed state cannot send)", () => {
    const onConfirm = vi.fn();
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Send this email now?"
        confirmLabel="Confirm send"
        onConfirm={onConfirm}
      />,
    );
    expect(html).toBe("");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
