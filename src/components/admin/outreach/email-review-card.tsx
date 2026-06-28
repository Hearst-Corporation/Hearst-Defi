"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import DOMPurify from "dompurify";

import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { Modal } from "@/components/catalyst/modal";
import {
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
  BentoPanel,
} from "@/components/catalyst/bento";
import {
  BENTO_FIELD,
  BENTO_FIELD_LABEL,
  BENTO_INPUT,
} from "@/components/admin/outreach/bento-form";
import { cn } from "@/lib/cn";
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
      <BentoPanel className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="ct-metric-caption font-mono">{email.toEmail}</p>
              <div className="flex flex-wrap items-center gap-2">
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
                  <span className="ct-metric-caption">
                    {fmtEventTime(email.latestEventAt)}
                  </span>
                )}
              </div>
            </div>
            {/* Preview affordance */}
            <button
              type="button"
              className={cn(BENTO_SECONDARY_BTN, "shrink-0 px-3 py-1.5 text-[length:var(--ct-text-2xs)]")}
              onClick={() => setPreviewOpen(true)}
            >
              Preview
            </button>
          </div>

          <label className={BENTO_FIELD} htmlFor={`email-subject-${email.id}`}>
            <span className={BENTO_FIELD_LABEL}>Subject</span>
            <input
              id={`email-subject-${email.id}`}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={locked}
              className={cn(BENTO_INPUT, "disabled:cursor-not-allowed disabled:opacity-60")}
            />
          </label>

          <label className={BENTO_FIELD} htmlFor={`email-body-${email.id}`}>
            <span className={BENTO_FIELD_LABEL}>Body</span>
            <textarea
              id={`email-body-${email.id}`}
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={locked}
              className={cn(BENTO_INPUT, "disabled:cursor-not-allowed disabled:opacity-60")}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={BENTO_SECONDARY_BTN}
              onClick={onSave}
              disabled={locked || savePending || !dirty}
            >
              {savePending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className={BENTO_PRIMARY_BTN}
              onClick={onApprove}
              disabled={locked || approvePending || email.status === "approved"}
            >
              {approvePending ? "Approving…" : "Approve"}
            </button>
          </div>
        </div>
      </BentoPanel>

      {/* Email preview modal — read-only HTML shell, sanitised */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview — ${email.toEmail}`}
        className="max-w-2xl"
      >
        <div className="overflow-hidden rounded-lg border border-[var(--ct-border)] bg-surface-inset">
          <iframe
            title="Email preview"
            srcDoc={renderPreviewHtml(body)}
            sandbox="allow-same-origin"
            className="w-full border-0"
            style={{ minHeight: "340px" }}
          />
        </div>
        <p className="ct-metric-caption mt-3">
          Read-only preview. Actual send uses the same HTML shell via Resend.
        </p>
      </Modal>
    </>
  );
}
