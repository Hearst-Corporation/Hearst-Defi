"use client";

import { AdminErrorBody } from "@/components/admin/admin-error-body";

interface SpecErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SpecError(props: SpecErrorProps) {
  return <AdminErrorBody {...props} scope="Spec · Error" logPrefix="[admin/spec]" />;
}
