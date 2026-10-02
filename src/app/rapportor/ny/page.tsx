import type { Metadata } from "next";
import Link from "next/link";
import { requirePageAccess } from "@/server/auth/page-access";
import { getDatabase } from "@/server/db";
import { listTemplates } from "@/server/templates/service";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Ny rapport" };

const presentation: Record<string, { icon: IconName; tone: string }> = {
  tma: { icon: "truck", tone: "green" },
  bargning: { icon: "report", tone: "neutral" },
};

export default async function NewReportPage() {
  const { company } = await requirePageAccess(["reporter"]);
  const templates = await listTemplates(getDatabase().db, company._id);
  return (
    <>
      <Link href="/rapportor" className="back-link">← Till översikten</Link>
      <header className="page-heading">
        <p className="eyebrow">NY RAPPORT</p>
        <h1>Vad har du arbetat med?</h1>
        <p>{templates.length ? "Välj den rapporttyp som passar uppdraget." : "Här kommer företagets rapportmallar att finnas."}</p>
      </header>
      {templates.length ? (
        <div className="template-grid">
          {templates.map((template) => {
            const look = presentation[template.key] ?? { icon: "report", tone: "neutral" };
            return (
              <Link className="template-card template-link" key={template.key} href={`/rapportor/ny/${encodeURIComponent(template.key)}`}>
                <span className={`shortcut-icon ${look.tone}`}><Icon name={look.icon} /></span>
                <span className="badge">Version {template.version}</span>
                <h2>{template.title}</h2>
                <p>{template.description}</p>
                <span className="template-meta">{template.fieldCount} fält, {template.requiredCount} obligatoriska</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="notice">
          <Icon name="clock" />
          <div><h2>Mallarna är inte publicerade för företaget ännu</h2><p>Administratören publicerar företagets mallar för TMA och bärgning. Därefter kan rapporter påbörjas här.</p></div>
        </div>
      )}
    </>
  );
}
