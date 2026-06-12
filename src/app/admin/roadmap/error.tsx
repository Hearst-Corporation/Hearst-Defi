"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function RoadmapError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Roadmap · Error"
      homeHref="/admin/dashboard"
      homeLabel="Back to admin"
    />
  );
}
