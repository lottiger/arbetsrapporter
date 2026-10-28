import type { Metadata } from "next";
import { headers } from "next/headers";
import { requirePageAccess } from "@/server/auth/page-access";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterNav, resolveFilter, type FilterOption } from "@/components/navigation/filter-nav";
import { listReports } from "@/server/reports/service";
import { reportDependencies } from "@/server/reports/http";
import { reportPage } from "@/domain/reports";
import { ReportPagination } from "@/components/reports/report-list";
import { InvoiceList } from "@/components/reports/invoice-list";

export const metadata: Metadata = { title: "Fakturaunderlag" };
const filters = [
  { value: "all", label: "Alla", title: "Inga fakturaunderlag ännu", description: "Här samlas rapporterna när de har skickats in." },
  { value: "open", label: "Att hantera", title: "Inga underlag att hantera", description: "Alla tillgängliga underlag är klara." },
  { value: "handled", label: "Helt klara", title: "Inga helt klara underlag ännu", description: "Här visas underlag som har lagts in i bokföringssystemet." },
] as const satisfies readonly FilterOption[];

export default async function InvoicePage({ searchParams }: PageProps<"/admin/fakturaunderlag">) {
  const { company, membership } = await requirePageAccess(["company_admin", "billing"]);
  const canReview = membership.roles.includes("company_admin");
  const query = await searchParams;
  const selected = resolveFilter(query.status === "ready" ? "open" : query.status, filters);
  const status = !canReview && selected.value === "open" ? "ready" : selected.value;
  const result = await listReports(reportDependencies(), await headers(), company._id, canReview ? "review" : "billing", status, reportPage(query.page));
  return <>
    <header className="page-heading"><h1>Fakturaunderlag</h1><p>Gröna kort är inlagda och helt klara i bokföringssystemet.</p></header>
    <section className="panel review-panel" aria-label="Fakturaunderlag">
      <FilterNav label="Filtrera fakturaunderlag" basePath="/admin/fakturaunderlag" options={filters} selected={selected.value} />
      {result.reports.length ? <InvoiceList reports={result.reports} organizationId={company._id} /> : <EmptyState title={selected.title}><p>{!canReview && selected.value === "all" ? "Här visas godkända rapporter." : selected.description}</p></EmptyState>}
      <ReportPagination page={result.page} hasMore={result.hasMore} basePath="/admin/fakturaunderlag" status={selected.value} />
    </section>
  </>;
}
