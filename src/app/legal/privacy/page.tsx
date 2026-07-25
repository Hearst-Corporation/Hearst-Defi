import { LegalPageHeader } from "@/components/legal/legal-page-header";

export const dynamic = "force-static";

export const metadata = {
  title: "Privacy Policy",
  description: "How Hearst Connect collects, stores, and processes investor data.",
};

export default function PrivacyPage() {
  return (
    <>
      <LegalPageHeader title="Privacy Policy" />

      <div className="legal-stub">
        <strong>Current review draft</strong>
        <p>
          The structure below reflects the data Hearst Connect actually
          processes (session, KYC, analytics, on-chain transactions). The legal
          language must be reviewed and finalized by qualified counsel before
          this page becomes the final issued privacy notice.
        </p>
      </div>

      <h2 className="h2">1. Controller</h2>
      <p>
        Hearst Yield Vault SPV (Cayman Islands). Contact for privacy requests:
        privacy@hearst.app.
      </p>

      <h2 className="h2">2. Data we collect</h2>
      <ul>
        <li>
          <strong>Account &amp; authentication</strong> — email address,
          password hash (argon2id), session identifier (opaque, httpOnly
          cookie), role.
        </li>
        <li>
          <strong>KYC / AML</strong> — identity documents, address, source of
          funds, sanctions screening results. Collected and stored only for
          accredited investor verification, retained per AML regulation.
        </li>
        <li>
          <strong>On-chain identifiers</strong> — wallet addresses linked to
          your account for subscriptions, distributions, and proof-of-reserves
          attestations.
        </li>
        <li>
          <strong>Operational telemetry</strong> — request identifiers, hashed
          user identifiers (SHA-256), error reports (Sentry), product analytics
          (PostHog, no autocapture).
        </li>
      </ul>

      <h2 className="h2">3. Legal bases</h2>
      <p>
        Contract performance (account, subscription), legal obligation (AML /
        accredited investor records), legitimate interest (security, fraud
        prevention, product analytics).
      </p>

      <h2 className="h2">4. Storage &amp; retention</h2>
      <p>
        Account and KYC data: retained for the legal minimum required by Cayman
        AML regulation after account closure. Session records: rolling 30 days,
        extended on activity. Operational logs: 90 days unless required longer
        for incident investigation.
      </p>

      <h2 className="h2">5. Recipients</h2>
      <ul>
        <li>Cloud infrastructure (Railway — application hosting, PostgreSQL).</li>
        <li>Error reporting (Sentry).</li>
        <li>Product analytics (PostHog, EU instance).</li>
        <li>Identity verification &amp; KYC processor: Sumsub (Sum and Substance Ltd.).</li>
        <li>Custody provider (Fireblocks, read-only proof-of-reserves access).</li>
      </ul>

      <h2 className="h2">6. International transfers</h2>
      <p>
        Data may be transferred outside your jurisdiction to the providers
        listed above. Standard contractual clauses or equivalent safeguards
        apply where required.
      </p>

      <h2 className="h2">7. Your rights</h2>
      <p>
        Subject to applicable law, you may request access, rectification,
        deletion (subject to AML retention obligations), portability, and
        restriction of processing. Contact privacy@hearst.app.
      </p>

      <h2 className="h2">8. Cookies</h2>
      <p>
        Strictly necessary cookies only: <code>hc_session</code> (authentication,
        httpOnly, sameSite=strict, secure in production). No third-party
        advertising cookies. Analytics is event-based, not autocapture, and
        opted out in development environments.
      </p>

      <h2 className="h2">9. Changes</h2>
      <p>
        Material changes will be communicated by email and reflected in the
        effective date above.
      </p>
    </>
  );
}
