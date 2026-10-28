import Link from "next/link";
import { reportStatusLabels, type ReportDetail, type ReportEventType } from "@/domain/reports";
import type { AnswerValue, FieldDefinition } from "@/domain/templates";
import { reportTime } from "./report-list";

function answerLabel(field: FieldDefinition, value: AnswerValue) {
  if (typeof value === "boolean") return value ? "Ja" : "Nej";
  if (Array.isArray(value)) return value.map((item) => field.options?.find((option) => option.value === item)?.label ?? item).join(", ") || "Ej angivet";
  if (!value) return "Ej angivet";
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

export function ReportHeading({ report }: { report: ReportDetail }) {
  return <header className="page-heading">
    <p className="eyebrow">{report.viewingVersion ? "Sparat inskick" : reportStatusLabels[report.status]}</p>
    <h1>{report.title}</h1>
    <p>{report.customer || "Kund inte angiven"}{report.date && ` · ${report.date}`}</p>
  </header>;
}

export function SubmittedReport({ report }: { report: ReportDetail }) {
  const submission = report.submission;
  if (!submission) return null;
  const approved = report.approval?.versionId === submission.id ? report.approval : null;
  return <div className="report-form">
    <section className="notice">
      <div><h2>{approved ? "Godkänd rapport" : report.viewingVersion ? "Sparat inskick" : report.status === "needs_completion" ? "Senast inskickade uppgifter" : "Rapporten är inskickad och låst"}</h2>
        <p>Inskickad av {submission.submittedBy.name} den {reportTime(submission.submittedAt)}.</p>
        <p>{submission.companyName}</p>
        {approved && <p>Godkänd av {approved.actorName} den {reportTime(approved.at)}. {report.billingStatus === "handled" ? "Helt klar – administrerad i bokföringssystemet." : "Klar för fakturering."}</p>}
        {!report.viewingVersion && report.status === "needs_completion" && <p>Rapportören kompletterar uppgifterna. Ändringarna visas här efter ett nytt inskick.</p>}
      </div>
    </section>
    {submission.computed.length > 0 && <div className="form-computed">{submission.computed.map((item) => <span key={item.label}><strong>{item.label}:</strong> {item.value}</span>)}</div>}
    {submission.warnings.map((item) => <p className="form-warning" key={`${item.field}-${item.message}`}>{item.message}</p>)}
    {report.definition.sections.map((section) => <section className="form-section" key={section.key}>
      <h2>{section.title}</h2>
      <dl className="report-answers">{section.fields.map((field) => <div key={field.key}>
        <dt>{field.label}{field.unit && ` (${field.unit})`}</dt><dd>{answerLabel(field, report.answers[field.key])}</dd>
      </div>)}</dl>
    </section>)}
  </div>;
}

export function CompletionNotice({ report }: { report: ReportDetail }) {
  if (!report.completion || report.viewingVersion) return null;
  return <section className="notice completion-notice">
    <div><h2>Komplettering begärd</h2><p className="report-comment">{report.completion.comment}</p>
      <p>{report.completion.actorName} · {reportTime(report.completion.at)}</p>
    </div>
  </section>;
}

export function ReportHistory({ report, basePath }: { report: ReportDetail; basePath: string }) {
  const labels: Record<ReportEventType, string> = { draft_created: "Utkast skapat", draft_saved: "Utkast sparat", submitted: "Rapport inskickad", completion_requested: "Komplettering begärd", completion_saved: "Komplettering sparad", approved: "Rapport godkänd", billing_handled: "Helt klar – administrerad i bokföringssystemet" };
  return <section className="form-section report-history" aria-labelledby="history-title">
    <h2 id="history-title">Historik</h2>
    <p>De senaste 100 händelserna visas. Alla händelser bevaras.</p>
    {report.versions.length > 0 && <details className="report-versions"><summary>Inskick ({report.versions.length})</summary>
      <ul>{report.versions.map((version) => <li key={version.id}><Link href={`${basePath}?version=${version.version}`}>Visa inskick från {reportTime(version.submittedAt, true)}</Link> · {version.submittedBy}{report.submittedVersionId === version.id && " · Senaste inskicket"}{report.approval?.versionId === version.id && " · Godkänt"}</li>)}</ul>
    </details>}
    <ol>{report.events.map((event) => <li key={event.id}><strong>{labels[event.type]}</strong><span>{event.actorName} · {reportTime(event.at)}</span>{event.comment && <p className="report-comment">{event.comment}</p>}</li>)}</ol>
  </section>;
}
