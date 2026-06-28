// Admin · Outreach · Compose — send a single email independently of any
// campaign. Optionally drafted by the agent; sent with open/click tracking.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { DirectSendForm } from "@/components/admin/outreach/direct-send-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Compose email — Hearst Connect" };

export default function ComposeEmailPage() {
  const configured = Boolean(process.env.RESEND_API_KEY);

  return (
    <AdminPageShell
      titleLead="Compose"
      titleAccent="email"
      contextLabel="Outreach · One-off send"
      lead={
        <Link
          href="/admin/outreach"
          className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]"
        >
          ← Outreach
        </Link>
      }
      actions={
        configured ? (
          <Badge variant="success">Email configured</Badge>
        ) : (
          <Badge variant="warning">Email not configured</Badge>
        )
      }
    >
      {/* Single welded section — header + form fused in one bg-surface-card box.
          No BentoPanel-in-section cage. */}
      <AdminSectionCard
        ariaLabel="Compose"
        title="One-off tracked email"
        subtitle="No campaign required — draft yourself or let the agent prepare it."
      >
        <div className="flex flex-col gap-5 p-5">
          <p className="body-sm leading-relaxed text-[var(--ct-text-body)]">
            Send one tracked email to a single address. Draft it yourself or let
            the agent prepare it (institutional cold-email persona, forbidden-words
            guarded, qualification-funnel CTA). Review before sending; nothing
            leaves until you click{" "}
            <strong className="font-semibold text-[var(--ct-text-strong)]">
              Send now
            </strong>
            .
          </p>
          <DirectSendForm />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
