// Admin · Outreach · Compose — send a single email independently of any
// campaign. Optionally drafted by the agent; sent with open/click tracking.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DirectSendForm } from "@/components/admin/outreach/direct-send-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Compose email — Hearst Connect" };

export default function ComposeEmailPage() {
  const configured = Boolean(process.env.RESEND_API_KEY);

  return (
    <>
      <AdminPageHeader
        titleLead="Compose"
        titleAccent="email"
        contextLabel="Outreach · One-off send"
        lead={
          <Link href="/admin/outreach" className="body-xs ct-text-muted hover:ct-text-strong">
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

      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Compose">
        <p className="body-sm ct-text-muted">
          Send one tracked email to a single address — no campaign required. Draft
          it yourself or let the agent prepare it (institutional cold-email persona,
          forbidden-words guarded, qualification-funnel CTA). Review before sending;
          nothing leaves until you click <strong>Send now</strong>.
        </p>

        <Card className="p-[var(--ct-space-6)]" hoverOverlay={false}>
          <DirectSendForm />
        </Card>
      </section>
    </>
  );
}
