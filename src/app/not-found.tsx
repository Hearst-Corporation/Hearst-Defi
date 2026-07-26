import Link from "next/link";

import { getSession } from "@/lib/auth/session";
import { Button } from "@/ui/button";
import { PageLayout } from "@/views/_shared/product-layout";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  const session = await getSession();
  const target = session ? "/dashboard" : "/login";
  const label = session ? "Go to dashboard" : "Sign in";

  return (
    <PageLayout className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="hc-eyebrow text-warning">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        This page does not exist or has been moved.
      </p>
      <Link href={target} className="mt-6">
        <Button variant="secondary">{label}</Button>
      </Link>
    </PageLayout>
  );
}
