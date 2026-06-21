"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="admin-doc-stack admin-doc-stack--actions">
      {/* Recipient + optional context for agent drafting */}
      <form action={onDraft} className="admin-doc-stack admin-doc-stack--actions" aria-label="Draft with agent">
        <div className="admin-doc-form-grid-2">
          <label className="block body-xs" htmlFor="ds-to">
            <span className="ct-form-label">Recipient email</span>
            <input
              id="ds-to"
              name="to"
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="lp@fund.io"
              className="ct-input"
            />
          </label>
          <label className="block body-xs" htmlFor="ds-company">
            <span className="ct-form-label">Company (optional — helps the agent)</span>
            <input id="ds-company" name="company" type="text" placeholder="Acme Capital" className="ct-input" />
          </label>
          <label className="block body-xs" htmlFor="ds-firstName">
            <span className="ct-form-label">First name (optional)</span>
            <input id="ds-firstName" name="firstName" type="text" placeholder="Alice" className="ct-input" />
          </label>
          <label className="block body-xs" htmlFor="ds-lastName">
            <span className="ct-form-label">Last name (optional)</span>
            <input id="ds-lastName" name="lastName" type="text" placeholder="Dupont" className="ct-input" />
          </label>
        </div>
        <label className="block body-xs" htmlFor="ds-brief">
          <span className="ct-form-label">Brief for the agent (optional)</span>
          <textarea
            id="ds-brief"
            name="brief"
            rows={2}
            placeholder="Short intro, mention our institutional USDC yield and invite them to the qualification form."
            className="ct-input"
          />
        </label>
        <div className="admin-doc-inline-row">
          <Button type="submit" variant="secondary" size="md" disabled={isDrafting}>
            {isDrafting ? "Drafting…" : "Draft with agent"}
          </Button>
        </div>
      </form>

      {/* Subject + body (editable) → send */}
      <form action={onSend} className="admin-doc-stack admin-doc-stack--actions" aria-label="Compose and send">
        <input type="hidden" name="to" value={to} />
        <label className="block body-xs" htmlFor="ds-subject">
          <span className="ct-form-label">Subject</span>
          <input
            id="ds-subject"
            name="subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Institutional USDC yield — quick intro"
            className="ct-input"
          />
        </label>
        <label className="block body-xs" htmlFor="ds-body">
          <span className="ct-form-label">Body (plain text)</span>
          <textarea
            id="ds-body"
            name="body"
            rows={10}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hello,\n\nA short note about Hearst Connect…"
            className="ct-input"
          />
        </label>
        <div className="admin-doc-inline-row admin-form-row flex-wrap">
          <Button type="submit" variant="primary" size="md" disabled={isSending || !to || !subject || !body}>
            {isSending ? "Sending…" : "Send now"}
          </Button>
          {sentId && <Badge variant="success">Sent · tracked</Badge>}
        </div>
        <p className="body-xs ct-text-muted">
          Sent from the dedicated outreach address with open/click tracking. Recorded
          under the “Direct sends” campaign so it appears in your stats.
        </p>
      </form>
    </div>
  );
}
