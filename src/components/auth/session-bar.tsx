import Link from "next/link";
import type { CompanyRole } from "@/server/companies/access";
import { SignOutButton } from "./sign-out-button";

export function SessionBar({ company, roles, workspace }: { company: string; roles: CompanyRole[]; workspace: "reporter" | "admin" }) {
  const adminLink = roles.includes("company_admin") || roles.includes("billing") ? "/admin/fakturaunderlag" : null;
  return (
    <div className="session-bar">
      <strong>{company}</strong>
      <nav aria-label="Konto och arbetsyta">
        {workspace === "reporter" && adminLink && <Link href={adminLink}>Administratörsvy</Link>}
        {workspace === "admin" && roles.includes("reporter") && <Link href="/rapportor">Rapportörsvy</Link>}
        <Link href="/foretag">Byt företag</Link>
        {workspace === "reporter" && <a href="/offline">Lokala utkast</a>}
        <SignOutButton />
      </nav>
    </div>
  );
}
