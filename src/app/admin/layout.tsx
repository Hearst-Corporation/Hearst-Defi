import { notFound, redirect } from "next/navigation";

import { AdminRailIntra } from "@/components/nav/product-rail-intra";
import { CommandPalette } from "@/components/power/command-palette";
import { getSession } from "@/lib/auth/session";

import "../doc-flow.css";
import "./admin-crm.css";
import "./admin-docs.css";

export const metadata = {
  title: "Admin — Hearst Connect",
};

/**
 * Server-side admin gate.
 *
 * The edge proxy can only verify that an `hc_session` cookie is PRESENT — it
 * cannot read the user's role without the DB. This layout is therefore the
 * authoritative admin check: it calls `getSession()` and gates on
 * `session.role === "admin"` for every `/admin/*` route before rendering any
 * admin UI.
 *
 *  - No / invalid session  → redirect to /login?from=/admin (must sign in).
 *  - Authenticated, non-admin → notFound() (404 hides the admin area's
 *    existence instead of advertising a 403).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login?from=/admin");
  }

  if (session.role !== "admin") {
    notFound();
  }

  return (
    <>
      <AdminRailIntra />
      <div className="admin-search-dock">
        <CommandPalette />
      </div>
      <div className="admin-doc admin-doc-shell w-full min-w-0">{children}</div>
    </>
  );
}
