"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function GovernanceError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Governance · Error"
      homeHref="/admin/governance"
      homeLabel="Reload Governance"
    />
  );
}
