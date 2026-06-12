import { redirect } from "next/navigation";

/** Legacy `/admin` entry — canonical surface is `/admin/dashboard`. */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
