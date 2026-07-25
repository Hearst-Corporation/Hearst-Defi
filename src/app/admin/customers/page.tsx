import { AdminCustomersView } from "@/views/admin/customers-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Investors — Hearst Connect",
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const parsed = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;

  return <AdminCustomersView page={page} />;
}
