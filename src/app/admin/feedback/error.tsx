"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function FeedbackError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Feedback · Error"
      homeHref="/admin/dashboard"
      homeLabel="Back to admin"
    />
  );
}
