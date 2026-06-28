// Admin · Onboarding test — manually simulate a Typeform submission.
// Creates a User + Investor + QualificationProfile, calibrates the agent,
// optionally sends the welcome email and syncs the contact to HubSpot.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";

import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Onboarding test — Hearst Connect" };

export default function OnboardingTestPage() {
  return (
    <AdminPageShell
      titleLead="Onboarding"
      titleAccent="test"
      contextLabel="Operations · Pilot tool"
      headerActions={
        <Link
          href="/admin/customers"
          className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-text-strong)]"
        >
          ← Investors
        </Link>
      }
    >
      {/* Single welded section card — title + the long pilot caveat live in the
          card sub-header; the form sits directly in the padded body (no
          BentoPanel-in-section cage). */}
      <AdminSectionCard
        ariaLabel="Simulator"
        title="Create real pilot investor record"
        subtitle="Not a dry run — submitting creates a real investor account and qualification record, and applies assistant settings. You confirm before it runs. The welcome email and HubSpot contact are opt-in below — both off by default."
      >
        <div className="p-5 lg:p-6">
          <OnboardingForm />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
