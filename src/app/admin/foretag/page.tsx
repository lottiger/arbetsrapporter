import type { Metadata } from "next";
import { requirePageAccess } from "@/server/auth/page-access";
import { CompanyForm } from "@/components/company/company-form";

export const metadata: Metadata = { title: "Företagsuppgifter" };

export default async function CompanyPage() {
  const { company } = await requirePageAccess(["company_admin"]);
  return (
    <>
      <header className="page-heading"><p className="eyebrow">INSTÄLLNINGAR</p><h1>Företagsuppgifter</h1><p>Uppgifterna gäller det företag du har valt.</p></header>
      <section className="panel"><CompanyForm id={company._id} name={company.name} /></section>
    </>
  );
}
