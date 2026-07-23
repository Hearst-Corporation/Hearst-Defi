import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real product primitive, imported as-is.
import { Series1ChartPlaceholder } from "@/components/series1-shell/Series1ChartPlaceholder";
import { Series1Panel } from "@/components/series1-shell/Series1Panel";

const meta: Meta<typeof Series1ChartPlaceholder> = {
  title: "02-composants/Series1ChartPlaceholder",
  component: Series1ChartPlaceholder,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1ChartPlaceholder>;

export const Live: Story = {
  args: {
    title: "Reserve trajectory",
    status: "live",
    label: "No accumulation series yet",
    detail:
      "The contract reports a cumulative total, not a per-month series. The curve appears once the ledger indexes monthly credits.",
  },
};

export const Unavailable: Story = {
  args: {
    title: "Reserve trajectory",
    status: "unavailable",
    label: "Indexer unreachable",
    detail: "This is an outage of the read, not a statement that no record exists.",
  },
};

export const Configured: Story = {
  args: {
    title: "Reserve trajectory",
    status: "configured",
    label: "Awaiting v2.1 deployment",
    detail: "Figures resolve once the contract is deployed and reporting.",
  },
};

// Shell/content contract — `embedded` drops the self-owned frame so a parent
// Series1Panel can own the surface without producing a double coque.
export const EmbeddedInParentPanel: Story = {
  name: "Contract: embedded = parent owns surface",
  render: () => (
    <Series1Panel>
      <Series1ChartPlaceholder
        variant="embedded"
        title="Reserve trajectory"
        status="live"
        label="No accumulation series yet"
        detail="The parent panel owns the frame; the placeholder ships header + well only."
      />
    </Series1Panel>
  ),
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByText("No accumulation series yet")).toBeVisible();
    // Exactly one bordered/rounded coque — the parent's. The embedded
    // placeholder added no frame of its own.
    const coques = canvasElement.querySelectorAll('[class*="rounded-(--ct-radius-xl)"]');
    await expect(coques.length).toBe(1);
  },
};
