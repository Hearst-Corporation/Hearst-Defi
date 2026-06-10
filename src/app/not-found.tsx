import Link from "next/link";

import { ErrorShellLayout } from "@/components/error/error-shell";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  const session = await getSession();
  const target = session ? "/portfolio" : "/login";
  const label = session ? "Go to Portfolio" : "Sign in";

  return (
    <ErrorShellLayout
      tone="warning"
      scope="404"
      title="Page not found"
      message="This page does not exist or has been moved."
      actions={
        <Button variant="secondary" size="sm" asChild>
          <Link href={target}>{label}</Link>
        </Button>
      }
    />
  );
}
