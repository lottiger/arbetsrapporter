import type { Metadata } from "next";
import { requirePageAccess } from "@/server/auth/page-access";
import { getDatabase } from "@/server/db";
import { getPublishedTemplate, listTemplates } from "@/server/templates/service";
import { describeRule, fieldTypeLabels, sectionDescription } from "@/components/reports/field-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "Mallar" };

const dateFormat = new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" });

export default async function TemplatesPage() {
  const { company } = await requirePageAccess(["company_admin"]);
  const db = getDatabase().db;
  const summaries = await listTemplates(db, company._id);
  const templates = (await Promise.all(summaries.map((summary) => getPublishedTemplate(db, company._id, summary.key))))
    .filter((template): template is NonNullable<typeof template> => template !== null);
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">INSTÄLLNINGAR</p>
        <h1>Mallar</h1>
        <p>Företagets rapportmallar med fält, anvisningar och regler.</p>
      </header>
      {templates.length === 0 && (
        <section className="panel">
          <EmptyState icon="template" title="Inga mallar är publicerade för företaget">
            <p>Kontakta den som ansvarar för tjänsten för att lägga till företagets rapportmallar.</p>
          </EmptyState>
        </section>
      )}
      {templates.map((template) => (
        <section className="panel template-block" key={template.templateId} aria-labelledby={`template-${template.definition.key}`}>
          <header className="template-block-heading">
            <div>
              <h2 id={`template-${template.definition.key}`}>{template.definition.title}</h2>
              <p>{template.definition.description}</p>
            </div>
            <dl className="template-facts">
              <div><dt>Publicerad</dt><dd>{dateFormat.format(template.publishedAt)}</dd></div>
              <div><dt>Källa</dt><dd>{template.definition.source}</dd></div>
            </dl>
          </header>
          {template.definition.sections.map((section) => (
            <div className="template-section" key={section.key}>
              <h3>{section.title}</h3>
              {sectionDescription(template.definition, section) && <p className="template-section-note">{sectionDescription(template.definition, section)}</p>}
              <div className="table-scroll">
                <table className="report-table field-table">
                  <thead><tr><th scope="col">Fält</th><th scope="col">Typ</th><th scope="col">Krav</th><th scope="col">Anvisning och alternativ</th></tr></thead>
                  <tbody>
                    {section.fields.map((field) => (
                      <tr key={field.key}>
                        <th scope="row">{field.label}{field.unit && <span className="field-unit"> ({field.unit})</span>}</th>
                        <td>{fieldTypeLabels[field.type]}</td>
                        <td>{field.required ? "Obligatoriskt" : "Valfritt"}</td>
                        <td>
                          {field.hint && <span>{field.hint}</span>}
                          {field.options && <span className="option-list">{field.options.map((option) => option.label).join(" · ")}</span>}
                          {(field.min !== undefined || field.max !== undefined) && <span className="option-list">Tillåtet intervall: {field.min ?? "–"} till {field.max ?? "–"}{field.unit ? ` ${field.unit}` : ""}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {template.definition.rules.length > 0 && (
            <div className="template-section">
              <h3>Regler</h3>
              <ul className="rule-list">
                {template.definition.rules.map((rule, index) => <li key={index}>{describeRule(template.definition, rule)}</li>)}
              </ul>
            </div>
          )}
        </section>
      ))}
      <div className="notice">
        <Icon name="template" />
        <div><h2>Ändra en mall</h2><p>Kontakta den som ansvarar för tjänsten om ett fält eller en regel behöver ändras. Uppdaterade mallar används för nya rapporter. Befintliga rapporter behåller sina uppgifter och anvisningar.</p></div>
      </div>
    </>
  );
}
