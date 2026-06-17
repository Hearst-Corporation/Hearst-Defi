import Link from "next/link";

import { ErrorShellLayout } from "@/components/error/error-shell";

export default function AdminNotFound() {
  return (
    <ErrorShellLayout
      tone="warning"
      scope="404"
      title="Page admin introuvable"
      message="La page admin que vous cherchez n'existe pas ou a été déplacée. Vérifiez l'URL ou revenez au tableau de bord administrateur."
      actions={
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center rounded-full border border-(--ct-border-strong) ct-surface-1 px-[var(--ct-space-4)] py-[var(--ct-space-2)] body-sm font-medium ct-text-primary no-underline"
        >
          Retour à l&apos;admin
        </Link>
      }
    />
  );
}
