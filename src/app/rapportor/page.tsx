import type { Metadata } from "next";
import { requirePageAccess } from "@/server/auth/page-access";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Din översikt" };

const shortcuts: { status: string; title: string; description: string; icon: IconName; tone: string }[] = [
  { status: "draft", title: "Fortsätt med utkast", description: "Rapporter du har påbörjat", icon: "edit", tone: "neutral" },
  { status: "needs_completion", title: "Att komplettera", description: "Läs återkoppling och uppdatera", icon: "comment", tone: "amber" },
  { status: "submitted", title: "Inskickade rapporter", description: "Följ det du har skickat in", icon: "clock", tone: "green" },
];

export default async function ReporterHome() {
  await requirePageAccess(["reporter"]);
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">DIN ÖVERSIKT</p>
        <h1>Dina arbetsrapporter</h1>
        <p>Rapportera ditt arbete. Ha koll på nästa steg.</p>
      </header>
      <Link className="create-report" href="/rapportor/ny">
        <span className="create-icon"><Icon name="plus" /></span>
        <span><strong>Skapa ny rapport</strong><span>Välj rapporttyp och kom igång</span></span>
        <Icon name="arrow" />
      </Link>
      <section className="section-block" aria-labelledby="follow-up-title">
        <div className="section-heading"><h2 id="follow-up-title">Att följa upp</h2><span>Ett steg i taget</span></div>
        <div className="shortcut-list">
          {shortcuts.map((item) => (
            <Link className="shortcut" key={item.status} href={`/rapportor/rapporter?status=${item.status}`}>
              <span className={`shortcut-icon ${item.tone}`}><Icon name={item.icon} /></span>
              <span className="shortcut-copy"><strong>{item.title}</strong><span>{item.description}</span></span>
              <Icon name="chevron" />
            </Link>
          ))}
        </div>
      </section>
      <section className="section-block" aria-labelledby="recent-title">
        <div className="section-heading"><h2 id="recent-title">Dina rapporter</h2><Link href="/rapportor/rapporter">Visa alla <span aria-hidden="true">↗</span></Link></div>
        <div className="panel">
          <EmptyState icon="report" title="Här börjar din rapportering">
            <p>Här kommer du att se dina senaste rapporter och vad som händer med dem.</p>
          </EmptyState>
        </div>
      </section>
    </>
  );
}
