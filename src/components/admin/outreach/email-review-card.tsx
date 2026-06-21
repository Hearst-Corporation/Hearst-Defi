"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import DOMPurify from "dompurify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { approveEmail, updateEmail } from "@/app/admin/outreach/actions";
import { buildEmailHtmlShell } from "@/lib/email/html-shell";

function renderPreviewHtml(body: string): string {
  const safe = DOMPurify.sanitize(body, { ALLOWED_TAGS: ["br", "b", "i", "a", "p", "em", "strong"] });
  return buildEmailHtmlShell(safe);
}

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

interface OutreachEmailReview {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: string;
  draftedByAgent: boolean;
  /** Latest Resend webhook event type (e.g. "delivered", "opened"). */
  latestEventType?: string | null;
  /** When the latest event occurred. */
  latestEventAt?: Date | null;
}

/** Delivery statuses that indicate the email left the building. */
const DELIVERY_STATUSES = new Set(["sent", "delivered", "opened", "clicked", "bounced", "failed"]);

/** Format a Date for display as a short timestamp. */
function fmtEventTime(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

/**
 * One reviewable email row inside a campaign. Subject + body are editable;
 * "Save" persists edits via updateEmail, "Approve" flips the email to `approved`
 * via approveEmail (sending itself is a separate, gated step). Forbidden-word
 * and APY-range validation is enforced server-side in the actions — the card
 * just surfaces the rejection toast. Approve is disabled once the email has
 * already left the draft/approved stages (sent and beyond).
 *
 * After sending: a delivery-status badge (sent/delivered/opened/bounced…) and
 * the latest event timestamp are shown below the recipient address.
 * A "Preview" button opens a Modal rendering the email body through the same
 * HTML shell used for actual sends (DOMPurify-sanitised, read-only).
 */
export function EmailReviewCard({ email }: { email: OutreachEmailReview }) {
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [savePending, startSave] = useTransition();
  const [approvePending, startApprove] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);

  const variant = STATUS_VARIANT[email.status] ?? "default";
  const dirty = subject !== email.subject || body !== email.body;
  const locked = email.status !== "draft" && email.status !== "approved";
  const hasDelivery = DELIVERY_STATUSES.has(email.status);

  // Delivery badge variant: bounced/failed → danger, others → success
  const deliveryVariant: "success" | "danger" =
    email.status === "bounced" || email.status === "failed" ? "danger" : "success";

  function onSave() {
    startSave(async () => {
      try {
        const fd = new FormData();
        fd.set("emailId", email.id);
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
        fd.set("emailId", email.id);
        await approveEmail(fd);
        toast.success("Email approved");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Approve failed: ${message}`);
      }
    });
  }

  return (
    <>
      <Card className="admin-card" hoverOverlay={false}>
        <div className="admin-doc-stack admin-doc-stack--actions">
          <div className="admin-doc-row-spread">
            <div className="admin-doc-stack admin-doc-stack--micro">
              <p className="body-xs ct-text-muted mono">{email.toEmail}</p>
              <div className="admin-doc-inline-row admin-doc-inline-row--tight">
                <Badge variant={variant}>{email.status}</Badge>
                {email.draftedByAgent && (
                  <Badge variant="default">agent draft</Badge>
                )}
                {/* Delivery status badge — shown once the email has been dispatched */}
                {hasDelivery && email.latestEventType && (
                  <Badge variant={deliveryVariant}>
                    {email.latestEventType}
                  </Badge>
                )}
                {hasDelivery && email.latestEventAt && (
                  <span className="body-xs ct-text-muted">
                    {fmtEventTime(email.latestEventAt)}
                  </span>
                )}
              </div>
            </div>
            {/* Preview affordance */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPreviewOpen(true)}
            >
              Preview
            </Button>
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

      {/* Email preview modal — read-only HTML shell, sanitised */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview — ${email.toEmail}`}
        className="max-w-2xl"
      >
        <div className="rounded-lg overflow-hidden bg-(--ct-bg-deep)">
          <iframe
            title="Email preview"
            srcDoc={renderPreviewHtml(body)}
            sandbox="allow-same-origin"
            className="w-full border-0"
            style={{ minHeight: "340px" }}
          />
        </div>
        <p className="body-xs ct-text-muted admin-note-spaced">
          Read-only preview. Actual send uses the same HTML shell via Resend.
        </p>
      </Modal>
    </>
  );
}
