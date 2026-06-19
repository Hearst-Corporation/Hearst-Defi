"use client";

import { SegmentError } from "@/components/error/segment-error";

export default function CustomersError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SegmentError
      {...props}
      scope="Investors · Error"
      homeHref="/admin/customers"
      homeLabel="Reload Investors"
    />
  );
}
