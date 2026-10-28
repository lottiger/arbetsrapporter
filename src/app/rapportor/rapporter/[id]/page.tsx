import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/server/auth/page-access";
import { reportDependencies } from "@/server/reports/http";
import { getReport, ReportError } from "@/server/reports/service";
import { OfflineReportForm } from "@/components/reports/offline-report-form";
import { CompletionNotice, ReportHeading, ReportHistory, SubmittedReport } from "@/components/reports/report-detail";

export const metadata: Metadata = { title: "Min rapport" };
export default async function ReportPage({ params, searchParams }: PageProps<"/rapportor/rapporter/[id]">) {
  const { company, user } = await requirePageAccess(["reporter"]);
  const { id } = await params;
  const requestHeaders = await headers();
  const query = await searchParams;
  const report = await getReport(reportDependencies(), requestHeaders, company._id, id, "mine", query.version).catch((error) => {
    if (error instanceof ReportError && [400, 404].includes(error.status)) notFound();
    throw error;
  });
  return <>
    <Link className="back-link" href="/rapportor/rapporter">← Mina rapporter</Link>
    <ReportHeading report={report} />
    {report.viewingVersion && <p><Link href={`/rapportor/rapporter/${report.id}`}>Tillbaka till aktuell rapport</Link></p>}
    {!report.viewingVersion && query.sparad === "1" && ["draft", "needs_completion", "submitted"].includes(report.status) && <p className="form-success report-save-message" role="status">{report.status === "draft" ? "Utkastet är sparat." : report.status === "needs_completion" ? "Kompletteringen är sparad. Skicka in igen när du är klar." : "Rapporten är inskickad till granskning."}</p>}
    <CompletionNotice report={report} />
    {!report.viewingVersion && ["draft", "needs_completion"].includes(report.status) ? <OfflineReportForm userId={user.id} companyName={company.name} key={`${report.id}-${report.revision}`} definition={report.definition}
      organizationId={company._id} templateVersionId={report.templateVersionId} reportId={report.id} revision={report.revision} initialAnswers={report.answers} automaticTimeFields={report.automaticTimeFields} completion={report.status === "needs_completion"} />
      : <SubmittedReport report={report} />}
    <ReportHistory report={report} basePath={`/rapportor/rapporter/${report.id}`} />
  </>;
}
