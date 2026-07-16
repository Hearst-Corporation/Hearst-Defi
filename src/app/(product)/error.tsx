"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function ProductError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Product · Error"
      homeHref="/dashboard"
      homeLabel="Aller au dashboard"
    />
  );
}
