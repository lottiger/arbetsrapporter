import type { Metadata } from "next";
import { requirePageAccess } from "@/server/auth/page-access";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterNav, resolveFilter, type FilterOption } from "@/components/navigation/filter-nav";

export const metadata: Metadata = { title: "Mina rapporter" };

const filters = [
  { value: "all", label: "Alla", title: "Här samlas dina rapporter", description: "Följ dina rapporter från utkast till godkännande." },
  { value: "draft", label: "Utkast", title: "Här hittar du dina utkast", description: "Påbörjade rapporter kommer att visas här så att du kan fortsätta senare." },
  { value: "needs_completion", label: "Att komplettera", title: "Här ser du vad som behöver kompletteras", description: "Här kommer du att kunna läsa granskarens kommentar och uppdatera din rapport." },
  { value: "submitted", label: "Inskickade", title: "Här följer du inskickade rapporter", description: "En inskickad rapport väntar på granskning och är låst för redigering." },
  { value: "approved", label: "Godkända", title: "Här visas godkända rapporter", description: "Godkända rapporter är klara för att användas som faktureringsunderlag." },
] as const satisfies readonly FilterOption[];

export default async function ReportsPage({ searchParams }: PageProps<"/rapportor/rapporter">) {
  await requirePageAccess(["reporter"]);
  const selected = resolveFilter((await searchParams).status, filters);
  return (
    <>
      <header className="page-heading"><p className="eyebrow">DITT ARBETE</p><h1>Mina rapporter</h1><p>Från första utkast till färdigt underlag.</p></header>
      <FilterNav label="Filtrera mina rapporter efter status" basePath="/rapportor/rapporter" options={filters} selected={selected.value} />
      <div className="panel" key={selected.value}>
        <EmptyState icon="report" title={selected.title}><p>{selected.description}</p><p className="empty-note">Rapportlistan kopplas in i ett kommande steg.</p></EmptyState>
      </div>
    </>
  );
}
