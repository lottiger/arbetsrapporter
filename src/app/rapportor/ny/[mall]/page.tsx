import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/server/auth/page-access";
import { getDatabase } from "@/server/db";
import { getPublishedTemplate } from "@/server/templates/service";
import { TemplateForm } from "@/components/reports/template-form";

export const metadata: Metadata = { title: "Ny rapport" };

export default async function NewReportFromTemplatePage({ params }: PageProps<"/rapportor/ny/[mall]">) {
  const { company } = await requirePageAccess(["reporter"]);
  const { mall } = await params;
  const template = await getPublishedTemplate(getDatabase().db, company._id, mall);
  if (!template) notFound();
  return (
    <>
      <Link href="/rapportor/ny" className="back-link">← Välj en annan rapporttyp</Link>
      <header className="page-heading">
        <p className="eyebrow">NY RAPPORT · VERSION {template.version}</p>
        <h1>{template.definition.title}</h1>
        <p>{template.definition.description}</p>
      </header>
      <TemplateForm definition={template.definition} />
    </>
  );
}
