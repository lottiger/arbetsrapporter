import { redirect } from "next/navigation";
import { requirePageAccess } from "@/server/auth/page-access";

export default async function AdminHome() {
  await requirePageAccess(["company_admin", "billing"]);
  redirect("/admin/fakturaunderlag");
}
