import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product composition, imported as-is (this session's own
// commit ad35cd99 — the stepper that replaced the static PROOF_EVENTS grid).
import { Series1ProofEventStepper } from "@/components/proof-center/series1-proof-event-stepper";
import type {
  Series1ProofEventNodeModel,
  Series1ProofStepperState,
} from "@/lib/proof-center/series1-event-stepper";

const meta: Meta<typeof Series1ProofEventStepper> = {
  title: "05-pages/Series1ProofEventStepper",
  component: Series1ProofEventStepper,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1ProofEventStepper>;

function node(overrides: Partial<Series1ProofEventNodeModel> = {}): Series1ProofEventNodeModel {
  return {
    id: "evt-1",
    eventName: "Deposit",
    displayLabel: "Capital in",
    description: "Investor subscription — USDC deposited, shares minted.",
    isKnownEventType: true,
    status: "indexed",
    blockNumber: "48965894",
    txHash: "0x36d953d6f3b7a2c1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7",
    logIndex: 9,
    investorAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    assetAmountAtomic: "100000000000",
    shareAmountAtomic: "100000000000",
    occurredAt: "2026-07-22T12:02:39.000Z",
    indexedAt: "2026-07-22T19:47:18.388Z",
    chainId: 31337,
    contractAddress: "0xA7830000000000000000000000000000B146",
    provenance: { networkKind: "preprod_fork", label: "Fork preprod" },
    ...overrides,
  };
}

export const Live: Story = {
  args: {
    state: {
      envelopeStatus: "live",
      events: [
        node({ id: "a", eventName: "StrategyAdded", isKnownEventType: false, displayLabel: "On-chain event", description: "Indexed on-chain event, type not yet catalogued.", blockNumber: "48965893", logIndex: 0 }),
        node({ id: "b", eventName: "Deposit", blockNumber: "48965894", logIndex: 9 }),
        node({ id: "c", eventName: "MiningMetricsReported", isKnownEventType: false, displayLabel: "On-chain event", description: "Indexed on-chain event, type not yet catalogued.", blockNumber: "48965894", logIndex: 12, assetAmountAtomic: null, shareAmountAtomic: null }),
      ],
    } satisfies Series1ProofStepperState,
  },
};

export const Empty: Story = {
  args: {
    state: { envelopeStatus: "empty", events: [] },
  },
};

export const Unavailable: Story = {
  args: {
    state: { envelopeStatus: "unavailable", events: [] },
  },
};

export const SimulatedRejected: Story = {
  args: {
    state: {
      envelopeStatus: "not_configured",
      notConfiguredReason: "simulated_rejected",
      events: [],
    },
  },
};

export const NetworkMismatch: Story = {
  args: {
    state: {
      envelopeStatus: "live",
      events: [node({ chainId: 1, provenance: { networkKind: "network_mismatch", label: "Network mismatch" } })],
    },
  },
};
