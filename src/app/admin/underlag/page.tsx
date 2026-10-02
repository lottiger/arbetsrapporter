import type { Metadata } from "next";
import { requirePageAccess } from "@/server/auth/page-access";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { FilterNav, resolveFilter, type FilterOption } from "@/components/navigation/filter-nav";

export const metadata: Metadata = { title: "Faktureringsunderlag" };

const filters = [
  { value: "ready", label: "Att hantera", title: "Här samlas underlag att fakturera", description: "Godkända rapporter som ännu inte har hanterats i Fortnox kommer att visas här." },
  { value: "handled", label: "Hanterade", title: "Här följer du hanterade underlag", description: "Rapporter som markerats som hanterade i Fortnox kommer att visas här, med vem som gjorde det och när." },
] as const satisfies readonly FilterOption[];

export default async function BillingPage({ searchParams }: PageProps<"/admin/underlag">) {
  await requirePageAccess(["company_admin", "billing"]);
  const selected = resolveFilter((await searchParams).status, filters);
  return (
    <>
      <header className="page-heading"><p className="eyebrow">FAKTURERING</p><h1>Faktureringsunderlag</h1><p>Godkända rapporter, redo för nästa steg.</p></header>
      <div className="notice billing-notice"><Icon name="layers" /><div><h2>Faktureringen görs i Fortnox</h2><p>Här ska du kunna hämta underlag och följa vilka som har hanterats. Rapportens godkännande och faktureringsstatus hålls isär.</p></div></div>
      <section className="panel review-panel" aria-label="Godkända faktureringsunderlag">
        <FilterNav label="Filtrera efter faktureringsstatus" basePath="/admin/underlag" options={filters} selected={selected.value} />
        <EmptyState icon="layers" title={selected.title}><p>{selected.description}</p><p className="empty-note">Faktureringsunderlag och PDF byggs i ett senare steg.</p></EmptyState>
      </section>
    </>
  );
}
