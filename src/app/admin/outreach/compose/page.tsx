// Admin · Outreach · Compose — send a single email independently of any
// campaign. Optionally drafted by the agent; sent with open/click tracking.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { BentoPanel } from "@/components/ui/bento";
import { DirectSendForm } from "@/components/admin/outreach/direct-send-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Compose email — Hearst Connect" };

export default function ComposeEmailPage() {
  const configured = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Compose"
          titleAccent="email"
          contextLabel="Outreach · One-off send"
          lead={
            <Link href="/admin/outreach" className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]">
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
        />

        <section className="flex flex-col gap-4" aria-label="Compose">
          <p className="body-sm leading-relaxed text-[var(--ct-text-body)]">
            Send one tracked email to a single address — no campaign required. Draft
            it yourself or let the agent prepare it (institutional cold-email persona,
            forbidden-words guarded, qualification-funnel CTA). Review before sending;
            nothing leaves until you click{" "}
            <strong className="font-semibold text-[var(--ct-text-strong)]">Send now</strong>.
          </p>

          <BentoPanel className="p-6">
            <DirectSendForm />
          </BentoPanel>
        </section>
      </div>
    </div>
  );
}
