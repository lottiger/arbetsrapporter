import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./index.ts";
import { getDatabase } from "../db.ts";
import { AccessError, requireCompanyAccess, type CompanyRole } from "../companies/access.ts";

export const COMPANY_COOKIE = "arbetsrapporter_company";

export async function requirePageAccess(roles?: readonly CompanyRole[]) {
  const organizationId = (await cookies()).get(COMPANY_COOKIE)?.value;
  if (!organizationId) redirect("/foretag");
  try {
    return await requireCompanyAccess(getAuth(), getDatabase().db, await headers(), organizationId, roles);
  } catch (error) {
    if (error instanceof AccessError) redirect(error.status === 401 ? "/logga-in" : "/ingen-behorighet");
    throw new Error("Företagsåtkomsten kunde inte kontrolleras. Försök igen om en stund.");
  }
}
