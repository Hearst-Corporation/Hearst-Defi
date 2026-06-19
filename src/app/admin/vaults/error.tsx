"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function VaultsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Vaults · Error"
      homeHref="/admin/vaults"
      homeLabel="Reload Vaults"
    />
  );
}
