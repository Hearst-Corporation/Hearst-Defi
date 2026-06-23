import { Card } from "@/components/ui/card";
import { OpsContactCard } from "@/components/onboarding/OpsContactCard";
import type { IrContact } from "@/lib/ir-contact";

/**
 * ApplyAside — the right-hand column of the /apply qualification chamber.
 *
 * When an Investor Relations contact is configured (env-driven, via getIrContact)
 * it shows the real IR card — name, email (mailto), and a Calendly link. When it
 * is not configured it shows a calm static intro instead.
 *
 * This replaced a presentational "assistant" panel whose status dot, suggestion
 * buttons, and message field were all disabled — it implied a working chat that
 * did nothing. The aside now carries a real, honest affordance (or nothing fake).
 */
export function ApplyAside({ irContact }: { irContact: IrContact | null }) {
  if (irContact) {
    return (
      <OpsContactCard
        name={irContact.name}
        title={irContact.title}
        email={irContact.email}
        calendlyHref={irContact.calendlyHref}
      />
    );
  }

  return (
    <Card
      role="complementary"
      aria-label="About this application"
      className="w-full product-doc-stack--actions"
    >
      <span className="eyebrow ct-text-muted">About this application</span>
      <p className="body-sm ct-text-muted m-0">
        A short qualification — a few quick steps covering who you are, your
        capacity, an intended first allocation, and timing. Under a minute, no
        commitment. We review fit and follow up directly.
      </p>
    </Card>
  );
}
