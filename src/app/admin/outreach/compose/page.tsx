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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Compose"
          titleAccent="email"
          contextLabel="Outreach · One-off send"
          lead={
            <Link href="/admin/outreach" className="text-[12px] text-zinc-500 transition-colors hover:text-white">
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
          <p className="text-[13px] leading-relaxed text-zinc-400">
            Send one tracked email to a single address — no campaign required. Draft
            it yourself or let the agent prepare it (institutional cold-email persona,
            forbidden-words guarded, qualification-funnel CTA). Review before sending;
            nothing leaves until you click{" "}
            <strong className="font-semibold text-white">Send now</strong>.
          </p>

          <BentoPanel className="p-6">
            <DirectSendForm />
          </BentoPanel>
        </section>
      </div>
    </div>
  );
}
