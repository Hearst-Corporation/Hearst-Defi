"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { approveEmail, updateEmail } from "@/app/admin/outreach/actions";

/** Email status → Badge variant. Unknown states fall back to neutral. */
const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "accent"
> = {
  draft: "default",
  approved: "accent",
  sent: "success",
  delivered: "success",
  opened: "success",
  clicked: "success",
  bounced: "danger",
  failed: "danger",
};

export interface OutreachEmailReview {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  draftedByAgent: boolean;
}

/**
 * One reviewable email row inside a campaign. Subject + body are editable;
 * "Save" persists edits via updateEmail, "Approve" flips the email to `approved`
 * via approveEmail (sending itself is a separate, gated step). Forbidden-word
 * and APY-range validation is enforced server-side in the actions — the card
 * just surfaces the rejection toast. Approve is disabled once the email has
 * already left the draft/approved stages (sent and beyond).
 */
export function EmailReviewCard({ email }: { email: OutreachEmailReview }) {
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [savePending, startSave] = useTransition();
  const [approvePending, startApprove] = useTransition();

  const variant = STATUS_VARIANT[email.status] ?? "default";
  const dirty = subject !== email.subject || body !== email.body;
  const locked = email.status !== "draft" && email.status !== "approved";

  function onSave() {
    startSave(async () => {
      try {
        const fd = new FormData();
        fd.set("id", email.id);
        fd.set("subject", subject);
        fd.set("body", body);
        await updateEmail(fd);
        toast.success("Email saved");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Save failed: ${message}`);
      }
    });
  }

  function onApprove() {
    startApprove(async () => {
      try {
        const fd = new FormData();
        fd.set("id", email.id);
        await approveEmail(fd);
        toast.success("Email approved");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Approve failed: ${message}`);
      }
    });
  }

  return (
    <Card className="p-5" hoverOverlay={false}>
      <div className="admin-doc-stack admin-doc-stack--actions">
        <div className="admin-doc-row-spread">
          <div className="admin-doc-stack admin-doc-stack--micro">
            <p className="body-xs ct-text-muted mono">{email.toEmail}</p>
            <div className="admin-doc-inline-row admin-doc-inline-row--tight">
              <Badge variant={variant}>{email.status}</Badge>
              {email.draftedByAgent && (
                <Badge variant="default">agent draft</Badge>
              )}
            </div>
          </div>
        </div>

        <label className="admin-doc-field" htmlFor={`email-subject-${email.id}`}>
          <span className="ct-form-label">Subject</span>
          <input
            id={`email-subject-${email.id}`}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={locked}
            className="ct-input"
          />
        </label>

        <label className="admin-doc-field" htmlFor={`email-body-${email.id}`}>
          <span className="ct-form-label">Body</span>
          <textarea
            id={`email-body-${email.id}`}
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={locked}
            className="ct-input"
          />
        </label>

        <div className="admin-form-actions">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onSave}
            disabled={locked || savePending || !dirty}
          >
            {savePending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onApprove}
            disabled={locked || approvePending || email.status === "approved"}
          >
            {approvePending ? "Approving…" : "Approve"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
