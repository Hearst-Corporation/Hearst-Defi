// Admin · Onboarding test — manually simulate a Typeform submission.
// Creates a User + Investor + QualificationProfile, calibrates the agent,
// optionally sends the welcome email and syncs the contact to HubSpot.
// Server Component — inherits the /admin layout's requireAdmin() gate.

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
        eyebrow="dev · manual Typeform simulator"
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
        <p className="body-sm ct-text-muted">
          Fill the questionnaire by hand and submit — this runs the exact same
          flow as the live Typeform webhook: it creates the User + Investor,
          stores the answers, calibrates the cockpit-chat agent, and (optionally)
          sends the welcome email and creates the HubSpot contact.
        </p>

        <Card className="p-5" hoverOverlay={false}>
          <OnboardingForm />
        </Card>
      </section>
    </div>
  );
}
