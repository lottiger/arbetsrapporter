import Link from "next/link";
import { reportStatusLabels, type ReportSummary } from "@/domain/reports";
import { Icon } from "@/components/ui/icon";
import { BillingCompletion } from "./billing-completion";
import { reportTime } from "./report-list";

export function InvoiceList({ reports, organizationId }: { reports: ReportSummary[]; organizationId: string }) {
  return <ul className="report-list invoice-list">{reports.map((report) => {
    const handled = report.billingStatus === "handled";
    const label = handled ? "Inlagd / helt klar" : report.status === "approved" ? "Att lägga in" : report.status === "submitted" ? "Att granska" : reportStatusLabels[report.status];
    return <li key={report.id} className={`invoice-card${handled ? " is-handled" : ""}`}>
      <Link href={`/admin/fakturaunderlag/${report.id}`} className="report-row">
        <div className="report-row-heading"><strong>{report.title}</strong><span role="status" className={`badge ${handled ? "status-handled" : `status-${report.status}`}`}>{handled && <Icon name="check" />}{label}</span></div>
        <span className="report-customer">{report.customer || "Kund inte angiven"}</span>
        <span className="report-row-meta">{report.date || "Datum inte angivet"} · {report.authorName}</span>
        <span className="report-row-meta">Senast uppdaterad {reportTime(report.updatedAt)}</span>
      </Link>
      {report.status === "approved" && report.billingStatus === "ready" && report.submittedVersionId && <div className="invoice-card-actions">
        <BillingCompletion key={report.revision} organizationId={organizationId} reportId={report.id} revision={report.revision} versionId={report.submittedVersionId} handled={null} />
      </div>}
    </li>;
  })}</ul>;
}
