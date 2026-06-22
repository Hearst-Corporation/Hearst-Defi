// Admin · Onboarding test — manually simulate a Typeform submission.
// Creates a User + Investor + QualificationProfile, calibrates the agent,
// optionally sends the welcome email and syncs the contact to HubSpot.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Onboarding test — Hearst Connect" };

export default function OnboardingTestPage() {
  const hubspotConfigured = Boolean(process.env.HUBSPOT_API_KEY);

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Onboarding test"
        eyebrow="pilot tool · controlled intake"
        description="Pilot test tool — runs a controlled submission through the production intake path. It creates a real investor account and qualification record; the welcome email and HubSpot sync stay opt-in (off by default)."
        lead={
          <Link href="/admin/customers" className="body-xs ct-text-muted hover:ct-text-strong">
            ← Investors
          </Link>
        }
        actions={
          hubspotConfigured ? (
            <Badge variant="success">HubSpot configured</Badge>
          ) : (
            <Badge variant="warning">HubSpot not configured</Badge>
          )
        }
      />

      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Simulator">
        <h2 className="h2">Test submission</h2>
        <p className="body-sm ct-text-muted">
          For pilot testing only. Submitting creates a real investor account and
          applies assistant settings. The welcome email and HubSpot contact are
          opt-in below — both off by default.
        </p>

        <Card className="admin-doc-card-pad-flat" hoverOverlay={false}>
          <OnboardingForm />
        </Card>
      </section>
    </div>
  );
}
