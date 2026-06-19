"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function OutreachError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Outreach · Error"
      homeHref="/admin/outreach"
      homeLabel="Reload Outreach"
    />
  );
}
