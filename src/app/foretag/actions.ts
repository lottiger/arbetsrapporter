"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { AccessError, homeForRoles, requireCompanyAccess } from "@/server/companies/access";
import { COMPANY_COOKIE } from "@/server/auth/page-access";

export async function selectCompany(form: FormData) {
  const id = form.get("organizationId");
  if (typeof id !== "string") redirect("/ingen-behorighet");
  let destination;
  try {
    const { db, config } = getDatabase();
    const context = await requireCompanyAccess(getAuth(), db, await headers(), id);
    (await cookies()).set(COMPANY_COOKIE, context.company._id, {
      httpOnly: true,
      secure: config.baseURL.startsWith("https://"),
      sameSite: "lax",
      path: "/",
    });
    destination = homeForRoles(context.membership.roles);
  } catch (error) {
    if (error instanceof AccessError) redirect(error.status === 401 ? "/logga-in" : "/ingen-behorighet");
    throw new Error("Företaget kunde inte väljas. Försök igen om en stund.");
  }
  redirect(destination);
}
