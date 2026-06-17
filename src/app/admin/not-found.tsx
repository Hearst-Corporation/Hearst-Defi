import Link from "next/link";

import { ErrorShellLayout } from "@/components/error/error-shell";

export default function AdminNotFound() {
  return (
    <ErrorShellLayout
      tone="warning"
      scope="404"
      title="Admin page not found"
      message="The admin page you are looking for does not exist or has been moved. Check the URL or return to the admin dashboard."
      actions={
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center rounded-full border border-(--ct-border-strong) ct-surface-1 px-[var(--ct-space-4)] py-[var(--ct-space-2)] body-sm font-medium ct-text-primary no-underline"
        >
          Back to admin
        </Link>
      }
    />
  );
}
