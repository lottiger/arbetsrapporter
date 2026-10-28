import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/server/auth/page-access";
import { getDatabase } from "@/server/db";
import { getPublishedTemplate } from "@/server/templates/service";
import { OfflineReportForm } from "@/components/reports/offline-report-form";

export const metadata: Metadata = { title: "Ny rapport" };

export default async function NewReportFromTemplatePage({ params }: PageProps<"/rapportor/ny/[mall]">) {
  const { company, user } = await requirePageAccess(["reporter"]);
  const { mall } = await params;
  const template = await getPublishedTemplate(getDatabase().db, company._id, mall);
  if (!template) notFound();
  return (
    <>
      <Link href="/rapportor/ny" className="back-link">← Välj en annan rapporttyp</Link>
      <header className="page-heading">
        <p className="eyebrow">NY RAPPORT</p>
        <h1>{template.definition.title}</h1>
        <p>{template.definition.description}</p>
      </header>
      <OfflineReportForm userId={user.id} companyName={company.name} definition={template.definition} organizationId={company._id} templateVersionId={template.versionId} />
    </>
  );
}
