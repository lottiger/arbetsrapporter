import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Brand } from "@/components/ui/brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { AccessError, listCompanies } from "@/server/companies/access";
import { selectCompany } from "./actions";

export const metadata: Metadata = { title: "Välj företag" };

export default async function CompaniesPage() {
  const requestHeaders = await headers();
  let companies;
  try {
    companies = await listCompanies(getAuth(), getDatabase().db, requestHeaders);
  } catch (error) {
    if (error instanceof AccessError) redirect("/logga-in");
    throw new Error("Företagen kunde inte hämtas. Försök igen om en stund.");
  }
  return (
    <main id="huvudinnehall" tabIndex={-1} className="auth-page">
      <Brand href="/" />
      <section className="auth-card">
        <p className="eyebrow">DIN ARBETSYTA</p><h1>Välj företag</h1>
        <p>Fortsätt till företaget du ska arbeta med.</p>
        {companies.length ? <div className="company-list">
          {companies.map((company) => (
            <form action={selectCompany} key={company.id}>
              <input type="hidden" name="organizationId" value={company.id} />
              <button type="submit" className="company-choice"><strong>{company.name}</strong><span aria-hidden="true">→</span></button>
            </form>
          ))}
        </div> : <p className="form-error">Ditt konto har inget aktivt företagsmedlemskap. Kontakta administratören för att få åtkomst.</p>}
        <SignOutButton />
      </section>
    </main>
  );
}
