// PresetPicker preview — accessible scenario dropdown (listbox). Shown in its
// resting/closed state (the trigger): a selected value on side A, an empty side B.
import { PresetPicker } from "hearst-connect";

const noop = () => {};

const OPTIONS = [
  { value: "base", label: "Base case", description: "Hashprice flat, margins steady" },
  { value: "soft", label: "Soft hashprice", description: "Mining margin −12%" },
  { value: "stress", label: "Stress", description: "Margin −25%, distributions defended" },
];

export const Selected = () => (
  <div style={{ width: "320px" }}>
    <PresetPicker side="A" value="base" options={OPTIONS} onChange={noop} />
  </div>
);

export const Empty = () => (
  <div style={{ width: "320px" }}>
    <PresetPicker side="B" value={null} options={OPTIONS} onChange={noop} />
  </div>
);

export const Disabled = () => (
  <div style={{ width: "320px" }}>
    <PresetPicker side="A" value="soft" options={OPTIONS} onChange={noop} disabled />
  </div>
);
