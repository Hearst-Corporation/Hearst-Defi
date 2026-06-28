// Admin · Onboarding test — manually simulate a Typeform submission.
// Creates a User + Investor + QualificationProfile, calibrates the agent,
// optionally sends the welcome email and syncs the contact to HubSpot.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BentoPanel } from "@/components/ui/bento";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Onboarding test — Hearst Connect" };

export default function OnboardingTestPage() {
  return (
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Onboarding"
          titleAccent="test"
          contextLabel="Operations · Pilot tool"
          description="Pilot test tool — runs a controlled submission through the production intake path. It creates a real investor account and qualification record; the welcome email and HubSpot sync stay opt-in (off by default)."
          lead={
            <Link
              href="/admin/customers"
              className="text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-text-strong)]"
            >
              ← Investors
            </Link>
          }
        />

        <section className="flex flex-col gap-4" aria-label="Simulator">
          <h2 className="ct-section-title">
            Create real pilot investor record
          </h2>
          <p className="ct-metric-caption leading-relaxed">
            Not a dry run — submitting creates a real investor account and
            qualification record, and applies assistant settings. You confirm
            before it runs. The welcome email and HubSpot contact are opt-in
            below — both off by default.
          </p>

          <BentoPanel>
            <div className="p-5 lg:p-6">
              <OnboardingForm />
            </div>
          </BentoPanel>
        </section>
      </div>
    </div>
  );
}
