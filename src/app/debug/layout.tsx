import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSession } from "@/lib/auth/session";

export default async function DebugLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const session = await getSession();
  if (!session) {
    redirect("/login?from=/debug");
  }

  if (session.role !== "admin") {
    notFound();
  }

  return <>{children}</>;
}
