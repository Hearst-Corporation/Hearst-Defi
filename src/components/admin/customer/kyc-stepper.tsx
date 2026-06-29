import type { KycStatus } from "@/lib/data/customers";

const GRAY = "bg-[color-mix(in_srgb,var(--ct-text-strong)_25%,transparent)]";
const YELLOW = "bg-[var(--ct-status-warning)]";
const ORANGE = "bg-[var(--ct-status-danger)]";
const GREEN = "bg-[var(--ct-accent)]";

function resolveSteps(kyc: KycStatus): { name: string; color: string }[] {
  if (kyc === "approved") {
    return [
      { name: "Account opened", color: GREEN },
      { name: "KYC", color: GREEN },
      { name: "Approved", color: GREEN },
    ];
  }
  if (kyc === "rejected") {
    return [
      { name: "Account opened", color: YELLOW },
      { name: "KYC", color: ORANGE },
      { name: "Approved", color: GRAY },
    ];
  }
  // pending — account open, KYC not yet done
  return [
    { name: "Account opened", color: YELLOW },
    { name: "KYC", color: GRAY },
    { name: "Approved", color: GRAY },
  ];
}

export function KycStepper({ status }: { status: KycStatus }) {
  const steps = resolveSteps(status);

  return (
    <ol role="list" className="flex items-center gap-1.5" aria-label="KYC progress">
      {steps.map((step) => (
        <li key={step.name}>
          <span
            title={step.name}
            className={`block size-2 rounded-full ${step.color}`}
            aria-label={step.name}
          />
        </li>
      ))}
    </ol>
  );
}
