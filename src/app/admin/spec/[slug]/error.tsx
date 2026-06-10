"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function SpecError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Spec · Error"
      homeHref="/admin/spec"
      homeLabel="Back to spec"
    />
  );
}
