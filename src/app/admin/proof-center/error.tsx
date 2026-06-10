"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function ProofCenterError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Proof Center · Error"
      homeHref="/admin/proof-center"
      homeLabel="Reload Proof Center"
    />
  );
}
