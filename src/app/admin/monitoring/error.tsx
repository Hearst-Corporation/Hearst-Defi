"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function MonitoringError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Monitoring · Error"
      homeHref="/admin/dashboard"
      homeLabel="Back to admin"
    />
  );
}
