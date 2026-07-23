import type { Meta, StoryObj } from "@storybook/nextjs-vite";

// Zero-copy: the real product primitives, imported as-is.
import {
  Series1Panel,
  Series1PanelHeader,
  Series1Row,
  Series1RowList,
} from "@/components/series1-shell/Series1Panel";

const meta: Meta<typeof Series1Panel> = {
  title: "02-composants/Series1Panel",
  component: Series1Panel,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Series1Panel>;

export const WithRows: Story = {
  render: () => (
    <Series1Panel>
      <Series1PanelHeader title="Deployment" description="Live · read 07:01 UTC" />
      <Series1RowList>
        <Series1Row label="Contract" value="DynaVault v2.1" />
        <Series1Row
          label="Network"
          value="Base Sepolia"
          hint="chainId 84532 · testnet only"
        />
        <Series1Row
          label="Vault address"
          value="0x2bd1…329e"
          hint="Legacy deployment — the v2.1 address has not been posted"
        />
      </Series1RowList>
    </Series1Panel>
  ),
};
