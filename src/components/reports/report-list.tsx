import Link from "next/link";
import { reportStatusLabels, type ReportSummary } from "@/domain/reports";

export function reportTime(value: string, includeSeconds = false) {
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: includeSeconds ? "medium" : "short", timeZone: "Europe/Stockholm" }).format(new Date(value));
}

export function ReportList({ reports }: { reports: ReportSummary[] }) {
  return <ul className="report-list">{reports.map((report) => <li key={report.id}>
    <Link href={`/rapportor/rapporter/${report.id}`} className="report-row">
      <div className="report-row-heading"><strong>{report.title}</strong><span className={`badge status-${report.status}`}>{reportStatusLabels[report.status]}</span></div>
      <span className="report-customer">{report.customer || "Kund inte angiven"}</span>
      <span className="report-row-meta">{report.date || "Datum inte angivet"}</span>
      <span className="report-row-meta">Senast uppdaterad {reportTime(report.updatedAt)}</span>
    </Link>
  </li>)}</ul>;
}

export function ReportPagination({ page, hasMore, basePath, status }: { page: number; hasMore: boolean; basePath: string; status: string }) {
  if (page === 1 && !hasMore) return null;
  return <nav className="report-pagination" aria-label="Bläddra mellan rapportsidor">
    {page > 1 && <Link href={`${basePath}?status=${encodeURIComponent(status)}&page=${page - 1}`}>← Föregående</Link>}
    <span>Sida {page}</span>
    {hasMore && <Link href={`${basePath}?status=${encodeURIComponent(status)}&page=${page + 1}`}>Nästa →</Link>}
  </nav>;
}
