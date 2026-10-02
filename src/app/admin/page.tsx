import { redirect } from "next/navigation";
import { requirePageAccess } from "@/server/auth/page-access";

export default async function AdminHome() {
  const { membership } = await requirePageAccess(["company_admin", "billing"]);
  redirect(membership.roles.includes("company_admin") ? "/admin/granskning" : "/admin/underlag");
}
