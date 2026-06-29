import type { KycStatus } from "@/lib/data/customers";

function resolveSteps(kyc: KycStatus): { name: string; led: string }[] {
  if (kyc === "approved") {
    return [
      { name: "Account created", led: "ct-led-green" },
      { name: "KYC submitted",   led: "ct-led-green" },
      { name: "Approved",        led: "ct-led-green" },
    ];
  }
  if (kyc === "rejected") {
    return [
      { name: "Account created", led: "ct-led-red" },
      { name: "KYC submitted",   led: "ct-led-red" },
      { name: "Rejected",        led: "ct-led-red" },
    ];
  }
  return [
    { name: "Account created", led: "ct-led-amber" },
    { name: "KYC submitted",   led: "ct-led-amber" },
    { name: "Approved",        led: "ct-led-off"   },
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
            aria-label={step.name}
            className={`block size-2.5 rounded-full ${step.led}`}
          />
        </li>
      ))}
    </ol>
  );
}
