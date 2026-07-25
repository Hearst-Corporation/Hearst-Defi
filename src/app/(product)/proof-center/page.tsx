import {
  getSeries1EventsFromBackend,
  type Envelope,
  type Series1EventsDTO,
} from "@/lib/backend";
import { getVaultAddress, getVaultMode } from "@/lib/chain/dynavault";
import {
  series1ProofStepperErrorState,
  toSeries1ProofStepperStateFromEnvelope,
  type Series1ProofStepperState,
} from "@/lib/proof-center/series1-event-stepper";
import { ProofCenterView } from "@/views/investor/proof-center-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proof Center · Hearst Bitcoin Reserve Vault — Series 1",
};

async function readProofStepperState(): Promise<Series1ProofStepperState> {
  let envelope: Envelope<Series1EventsDTO>;
  try {
    envelope = await getSeries1EventsFromBackend(200);
  } catch (error) {
    console.error("[proof-center] series1 events fetch failed", error);
    return series1ProofStepperErrorState(
      error instanceof Error ? error.message : "unknown error",
    );
  }
  return toSeries1ProofStepperStateFromEnvelope(
    envelope.meta.status,
    envelope.data.events,
  );
}

export default async function ProductProofCenterPage() {
  const [stepper] = await Promise.all([readProofStepperState()]);
  const mode = getVaultMode();
  const vaultAddress = getVaultAddress();

  return (
    <ProofCenterView
      mode={mode}
      vaultAddress={vaultAddress}
      stepper={stepper}
    />
  );
}
