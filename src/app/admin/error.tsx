"use client";

import { AdminErrorBody } from "@/components/admin/admin-error-body";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError(props: AdminErrorProps) {
  return <AdminErrorBody {...props} />;
}
