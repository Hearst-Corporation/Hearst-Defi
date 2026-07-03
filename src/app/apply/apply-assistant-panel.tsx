import { OpsContactCard } from "@/components/onboarding/OpsContactCard";
import type { IrContact } from "@/lib/ir-contact";

/**
 * ApplyAside — the right-hand column of the /apply qualification chamber.
 *
 * When an Investor Relations contact is configured (env-driven, via getIrContact)
 * it shows the real IR card — name, email (mailto), and a Calendly link. When it
 * is not configured, there is no aside — OnboardingChamber falls back to its
 * single-column layout.
 */
export function ApplyAside({
  irContact,
}: {
  irContact: IrContact | null;
}): React.ReactElement | null {
  if (!irContact) return null;

  return (
    <OpsContactCard
      name={irContact.name}
      title={irContact.title}
      email={irContact.email}
      calendlyHref={irContact.calendlyHref}
    />
  );
}
