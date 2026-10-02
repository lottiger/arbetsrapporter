import type { Metadata } from "next";
import { requirePageAccess } from "@/server/auth/page-access";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterNav, resolveFilter, type FilterOption } from "@/components/navigation/filter-nav";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Granskning" };

const filters = [
  { value: "submitted", label: "Att granska", title: "Här börjar granskningen", description: "Inskickade rapporter kommer att samlas här. Öppna ett underlag för att granska uppgifterna." },
  { value: "needs_completion", label: "Väntar på komplettering", title: "Här följer du begärda kompletteringar", description: "Rapporter som skickats tillbaka kommer att visas här medan rapportören uppdaterar uppgifterna." },
  { value: "approved", label: "Godkända", title: "Här samlas godkända rapporter", description: "Färdiggranskade rapporter kommer att finnas här och under Faktureringsunderlag." },
] as const satisfies readonly FilterOption[];

export default async function ReviewPage({ searchParams }: PageProps<"/admin/granskning">) {
  await requirePageAccess(["company_admin"]);
  const selected = resolveFilter((await searchParams).status, filters);
  return (
    <>
      <header className="page-heading"><p className="eyebrow">RAPPORTER</p><h1>Granskning</h1><p>Kontrollera uppgifterna och hjälp varje rapport hela vägen fram.</p></header>
      <div className="review-layout">
        <section className="panel review-panel" aria-label="Rapportkö">
          <FilterNav label="Filtrera granskningskön efter status" basePath="/admin/granskning" options={filters} selected={selected.value} />
          <div className="table-scroll">
            <table className="report-table">
              <caption className="sr-only">Rapporter – {selected.label}. Förhandsvisning utan rapportdata.</caption>
              <thead><tr><th scope="col">Rapport</th><th scope="col">Kund</th><th scope="col">Rapportör</th><th scope="col">Status</th></tr></thead>
              <tbody><tr><td colSpan={4}><EmptyState title={selected.title}><p>{selected.description}</p><p className="empty-note">Rapportkön är inte ansluten ännu.</p></EmptyState></td></tr></tbody>
            </table>
          </div>
        </section>
        <aside className="workflow-card" aria-labelledby="review-guide">
          <span className="eyebrow">SÅ FUNGERAR FLÖDET</span><h2 id="review-guide">Från rapport till underlag</h2>
          <ol className="workflow-steps">
            <li><span>1</span><div><h3>Granska</h3><p>Läs rapporten och kontrollera att uppgifterna är kompletta.</p></div></li>
            <li><span>2</span><div><h3>Begär komplettering</h3><p>Om något saknas: skriv vad rapportören behöver ändra.</p></div></li>
            <li><span>3</span><div><h3>Godkänn</h3><p>En komplett rapport blir ett underlag för fakturering.</p></div></li>
          </ol>
          <div className="workflow-note"><Icon name="comment" /><p>Kommentarer och tidigare versioner ska följa med genom hela flödet.</p></div>
        </aside>
      </div>
    </>
  );
}
