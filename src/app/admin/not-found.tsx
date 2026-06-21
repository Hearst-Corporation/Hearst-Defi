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
          className="admin-doc-pill-action body-sm"
        >
          Back to admin
        </Link>
      }
    />
  );
}
