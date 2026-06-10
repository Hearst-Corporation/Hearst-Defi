"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function ScenarioLabError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Scenario Lab · Error"
      homeHref="/admin/scenario-lab"
      homeLabel="Reload Scenario Lab"
    />
  );
}
