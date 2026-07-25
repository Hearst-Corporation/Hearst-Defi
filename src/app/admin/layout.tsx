import { getSession } from "@/lib/auth/session";
import { notFound, redirect } from "next/navigation";

export const metadata = {
  title: "Admin — Hearst Connect",
};

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
  return children;
}
