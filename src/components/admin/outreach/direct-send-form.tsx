"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
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
 * "Send now"; the agent only fills the fields for review.
 */
export function DirectSendForm() {
  const [isDrafting, startDraft] = useTransition();
  const [isSending, startSend] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sentId, setSentId] = useState<string | null>(null);

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

  function onSend(formData: FormData) {
    // The draft form's contact fields aren't in this form; subject/body come
    // from controlled state, recipient from the hidden mirror below.
    startSend(async () => {
      const result = await sendDirectEmail(formData);
      if (result.ok) {
        setSentId(result.resendEmailId ?? "sent");
        toast.success("Email sent");
      } else {
        toast.error(result.error ?? "Send failed");
      }
    });
  }

  const [to, setTo] = useState("");

  return (
    <div className="flex flex-col gap-5">
      {/* Recipient + optional context for agent drafting */}
      <form action={onDraft} className="flex flex-col gap-4" aria-label="Draft with agent">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={BENTO_FIELD} htmlFor="ds-to">
            <span className={BENTO_FIELD_LABEL}>Recipient email</span>
            <input
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
            <input id="ds-company" name="company" type="text" placeholder="Acme Capital" className={BENTO_INPUT} />
          </label>
          <label className={BENTO_FIELD} htmlFor="ds-firstName">
            <span className={BENTO_FIELD_LABEL}>First name (optional)</span>
            <input id="ds-firstName" name="firstName" type="text" placeholder="Alice" className={BENTO_INPUT} />
          </label>
          <label className={BENTO_FIELD} htmlFor="ds-lastName">
            <span className={BENTO_FIELD_LABEL}>Last name (optional)</span>
            <input id="ds-lastName" name="lastName" type="text" placeholder="Dupont" className={BENTO_INPUT} />
          </label>
        </div>
        <label className={BENTO_FIELD} htmlFor="ds-brief">
          <span className={BENTO_FIELD_LABEL}>Brief for the agent (optional)</span>
          <textarea
            id="ds-brief"
            name="brief"
            rows={2}
            placeholder="Short intro, mention our institutional USDC yield and invite them to the qualification form."
            className={BENTO_INPUT}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className={BENTO_SECONDARY_BTN} disabled={isDrafting}>
            {isDrafting ? "Drafting…" : "Draft with agent"}
          </button>
        </div>
      </form>

      {/* Subject + body (editable) → send */}
      <form action={onSend} className="flex flex-col gap-4" aria-label="Compose and send">
        <input type="hidden" name="to" value={to} />
        <label className={BENTO_FIELD} htmlFor="ds-subject">
          <span className={BENTO_FIELD_LABEL}>Subject</span>
          <input
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
          <textarea
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
          <button type="submit" className={BENTO_PRIMARY_BTN} disabled={isSending || !to || !subject || !body}>
            {isSending ? "Sending…" : "Send now"}
          </button>
          {sentId && <Badge variant="success">Sent · tracked</Badge>}
        </div>
        <p className="text-[12px] text-zinc-400">
          Sent from the dedicated outreach address with open/click tracking. Recorded
          under the “Direct sends” campaign so it appears in your stats.
        </p>
      </form>
    </div>
  );
}
