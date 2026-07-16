"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { ConfirmDialog } from "@/components/catalyst/confirm-dialog";
import { Input } from "@/components/catalyst/input";
import { Textarea } from "@/components/catalyst/textarea";
import {
  BENTO_FIELD,
  BENTO_FIELD_LABEL,
  BENTO_INPUT,
} from "@/components/admin/outreach/bento-form";
import { draftDirectEmail, sendDirectEmail } from "@/app/admin/outreach/actions";

/**
 * One-off email composer: send a single tracked email to one address, without
 * creating a campaign. Optionally drafts the subject + body with the agent
 * (cold-email persona, Typeform CTA). Nothing is sent until the operator clicks
 * "Send now" AND confirms the dialog — this is a REAL external email, so the
 * send is two-step (mirrors SendCampaignButton); the agent only fills the
 * fields for review.
 */
export function DirectSendForm() {
  const [isDrafting, startDraft] = useTransition();
  const [isSending, startSend] = useTransition();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sentId, setSentId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onDraft(formData: FormData) {
    setSentId(null);
    startDraft(async () => {
      try {
        const draft = await draftDirectEmail(formData);
        setSubject(draft.subject);
        setBody(draft.body);
        toast.success("Draft ready — review before sending");
      } catch (e) {
        toast.error(`Draft failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  /**
   * Fires the actual send AFTER the confirm dialog is accepted. Throws on a
   * failed send so the ConfirmDialog surfaces the error inline and stays open;
   * resolves cleanly on success so the dialog closes itself.
   */
  async function onConfirmSend(): Promise<void> {
    const fd = new FormData();
    fd.set("to", to);
    fd.set("subject", subject);
    fd.set("body", body);
    await new Promise<void>((resolve, reject) => {
      startSend(async () => {
        const result = await sendDirectEmail(fd);
        if (result.ok) {
          setSentId(result.resendEmailId ?? "sent");
          toast.success("Email sent");
          resolve();
        } else {
          const message = result.error ?? "Send failed";
          toast.error(message);
          reject(new Error(message));
        }
      });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Recipient + optional context for agent drafting */}
      <form action={onDraft} className="flex flex-col gap-4" aria-label="Draft with agent">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={BENTO_FIELD} htmlFor="ds-to">
            <span className={BENTO_FIELD_LABEL}>Recipient email</span>
            <Input
              id="ds-to"
              name="to"
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="lp@fund.io"
              className={BENTO_INPUT}
            />
          </label>
          <label className={BENTO_FIELD} htmlFor="ds-company">
            <span className={BENTO_FIELD_LABEL}>Company (optional — helps the agent)</span>
            <Input id="ds-company" name="company" type="text" placeholder="Acme Capital" className={BENTO_INPUT} />
          </label>
          <label className={BENTO_FIELD} htmlFor="ds-firstName">
            <span className={BENTO_FIELD_LABEL}>First name (optional)</span>
            <Input id="ds-firstName" name="firstName" type="text" placeholder="Alice" className={BENTO_INPUT} />
          </label>
          <label className={BENTO_FIELD} htmlFor="ds-lastName">
            <span className={BENTO_FIELD_LABEL}>Last name (optional)</span>
            <Input id="ds-lastName" name="lastName" type="text" placeholder="Dupont" className={BENTO_INPUT} />
          </label>
        </div>
        <label className={BENTO_FIELD} htmlFor="ds-brief">
          <span className={BENTO_FIELD_LABEL}>Brief for the agent (optional)</span>
          <Textarea
            id="ds-brief"
            name="brief"
            rows={2}
            placeholder="Short intro, mention our institutional USDC yield and invite them to the qualification form."
            className={BENTO_INPUT}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <CockpitButton
            type="submit"
            variant="secondary"
            shape="rect"
            size="lg"
            disabled={isDrafting}
          >
            {isDrafting ? "Drafting…" : "Draft with agent"}
          </CockpitButton>
        </div>
      </form>

      {/* Subject + body (editable) → confirm → send. Not a native submit: the
          send is gated behind an explicit confirmation dialog (real external
          email), so the button opens the dialog instead of firing the action. */}
      <form
        className="flex flex-col gap-4"
        aria-label="Compose and send"
        onSubmit={(e) => e.preventDefault()}
      >
        <input type="hidden" name="to" value={to} />
        <label className={BENTO_FIELD} htmlFor="ds-subject">
          <span className={BENTO_FIELD_LABEL}>Subject</span>
          <Input
            id="ds-subject"
            name="subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Institutional USDC yield — quick intro"
            className={BENTO_INPUT}
          />
        </label>
        <label className={BENTO_FIELD} htmlFor="ds-body">
          <span className={BENTO_FIELD_LABEL}>Body (plain text)</span>
          <Textarea
            id="ds-body"
            name="body"
            rows={10}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hello,\n\nA short note about Hearst Connect…"
            className={BENTO_INPUT}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <CockpitButton
            type="button"
            variant="primary"
            shape="rect"
            size="lg"
            onClick={() => setConfirmOpen(true)}
            disabled={isSending || !to || !subject || !body}
            aria-busy={isSending}
          >
            {isSending ? "Sending…" : "Send now"}
          </CockpitButton>
          {sentId && <Badge variant="success">Sent · tracked</Badge>}
        </div>
        <p className="ct-metric-caption">
          Sent from the dedicated outreach address with open/click tracking. Recorded
          under the “Direct sends” campaign so it appears in your stats.
        </p>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send this email now?"
        description={
          <>
            This will send a real{" "}
            <strong className="font-semibold text-[var(--ct-text-strong)]">
              external email
            </strong>{" "}
            to{" "}
            <strong className="font-semibold text-[var(--ct-text-strong)]">
              {to || "(no recipient)"}
            </strong>
            {subject ? (
              <>
                {" "}
                with subject{" "}
                <span className="mono">“{subject}”</span>
              </>
            ) : null}
            . Review the recipient and message before confirming.
          </>
        }
        confirmLabel="Confirm send"
        confirmVariant="primary"
        onConfirm={onConfirmSend}
      />
    </div>
  );
}
