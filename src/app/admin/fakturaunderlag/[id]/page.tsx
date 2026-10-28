import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/server/auth/page-access";
import { reportDependencies } from "@/server/reports/http";
import { getReport, ReportError } from "@/server/reports/service";
import { CompletionNotice, ReportHeading, ReportHistory, SubmittedReport } from "@/components/reports/report-detail";
import { ReviewActions } from "@/components/reports/review-actions";
import { BillingCompletion } from "@/components/reports/billing-completion";

export const metadata: Metadata = { title: "Fakturaunderlag" };
export default async function InvoiceReportPage({ params, searchParams }: PageProps<"/admin/fakturaunderlag/[id]">) {
  const { company, membership } = await requirePageAccess(["company_admin", "billing"]);
  const canReview = membership.roles.includes("company_admin");
  const report = await getReport(reportDependencies(), await headers(), company._id, (await params).id, canReview ? "review" : "billing", (await searchParams).version).catch((error) => {
    if (error instanceof ReportError && [400, 404].includes(error.status)) notFound();
    throw error;
  });
  return <>
    <Link className="back-link" href="/admin/fakturaunderlag">← Fakturaunderlag</Link>
    <ReportHeading report={report} />
    {report.viewingVersion && <p><Link href={`/admin/fakturaunderlag/${report.id}`}>Tillbaka till aktuell rapport</Link></p>}
    <CompletionNotice report={report} />
    {!report.viewingVersion && report.status === "approved" && report.submission && (report.billingStatus === "ready" || report.billingHandled) && <BillingCompletion key={report.revision} organizationId={company._id} reportId={report.id} revision={report.revision} versionId={report.submission.id} handled={report.billingHandled} />}
    <SubmittedReport report={report} />
    {!report.viewingVersion && canReview && report.status === "submitted" && report.submission && <ReviewActions key={report.revision} organizationId={company._id} reportId={report.id} revision={report.revision} versionId={report.submission.id} />}
    <ReportHistory report={report} basePath={`/admin/fakturaunderlag/${report.id}`} />
  </>;
}
