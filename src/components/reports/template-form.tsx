"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { calculatedTimeHours, evaluateAnswers, type Answers, type Evaluation, type FieldDefinition, type TemplateDefinition } from "@/domain/templates";
import { sectionDescription } from "./field-labels";

type TimeField = { value: string; automatic: boolean; calculated: string | null };
type TimeControl = TimeField & { edit: (value: string) => void; reset: () => void };
const displayHours = (value: string | null) => value?.replace(".", ",") ?? "";

function collectAnswers(form: HTMLFormElement, definition: TemplateDefinition): Answers {
  const data = new FormData(form);
  const answers: Answers = {};
  for (const section of definition.sections) {
    for (const field of section.fields) {
      if (field.type === "multiselect") {
        answers[field.key] = data.getAll(field.key).filter((value): value is string => typeof value === "string");
      } else {
        const value = data.get(field.key);
        answers[field.key] = typeof value === "string" ? value : undefined;
      }
    }
  }
  return answers;
}

function Field({ field, prefix, error, value, timeControl }: { field: FieldDefinition; prefix: string; error?: string; value?: Answers[string]; timeControl?: TimeControl }) {
  const id = `${prefix}-${field.key}`;
  const hintId = field.hint || timeControl ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const labelText = `${field.label}${field.unit ? ` (${field.unit})` : ""}`;
  const widthClass = field.width === "half" ? "half" : field.width === "third" ? "third" : "";
  const common = { id, name: field.key, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": field.required || undefined };
  const extras = (
    <>
      {(field.hint || timeControl) && <span className="field-hint" id={hintId}>
        {field.hint}
        {timeControl && <span aria-live="polite">{timeControl.automatic
          ? "Fylls i automatiskt från tiderna. Du kan ändra värdet själv."
          : `Manuellt värde. ${timeControl.calculated === null ? "Fyll i giltiga tider för att se beräknad tid." : `Beräknad tid: ${displayHours(timeControl.calculated)} h.`}`}</span>}
      </span>}
      {timeControl && !timeControl.automatic && <button type="button" className="text-button" onClick={timeControl.reset}>Använd beräknad tid</button>}
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </>
  );

  if (field.type === "yesno" || field.type === "multiselect") {
    const options = field.type === "yesno" ? [{ value: "ja", label: "Ja" }, { value: "nej", label: "Nej" }] : field.options ?? [];
    return (
      <fieldset className={`field ${widthClass}`} aria-describedby={describedBy} aria-invalid={error ? true : undefined} aria-required={field.required || undefined}>
        <legend>{labelText}{field.required && <span aria-hidden="true"> *</span>}</legend>
        <div className="choice-group">
          {options.map((option) => (
            <label key={option.value}>
              <input type={field.type === "yesno" ? "radio" : "checkbox"} name={field.key} value={option.value}
                defaultChecked={Array.isArray(value) ? value.includes(option.value) : (typeof value === "boolean" ? (value ? "ja" : "nej") : value) === option.value} />
              {option.label}
            </label>
          ))}
        </div>
        {extras}
      </fieldset>
    );
  }

  let control;
  switch (field.type) {
    case "textarea":
      control = <textarea {...common} defaultValue={typeof value === "string" ? value : ""} maxLength={field.maxLength ?? 2000} rows={4} />;
      break;
    case "select":
      control = (
        <select {...common} defaultValue={typeof value === "string" ? value : ""}>
          <option value="">Välj…</option>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      );
      break;
    case "integer":
      control = <input {...common} defaultValue={typeof value === "string" ? value : ""} type="number" inputMode="numeric" step={1} min={field.min} max={field.max} />;
      break;
    case "decimal":
      control = <input {...common} {...(timeControl ? { value: timeControl.value, onChange: (event: React.ChangeEvent<HTMLInputElement>) => timeControl.edit(event.currentTarget.value) } : { defaultValue: typeof value === "string" ? value : "" })} type="text" inputMode="decimal" placeholder={field.step ? `t.ex. ${field.step.toLocaleString("sv-SE")}` : undefined} maxLength={12} />;
      break;
    case "date":
      control = <input {...common} defaultValue={typeof value === "string" ? value : ""} type="date" />;
      break;
    case "time":
      control = <input {...common} defaultValue={typeof value === "string" ? value : ""} type="time" />;
      break;
    case "email":
      control = <input {...common} defaultValue={typeof value === "string" ? value : ""} type="email" autoComplete="email" maxLength={field.maxLength ?? 200} />;
      break;
    case "phone":
      control = <input {...common} defaultValue={typeof value === "string" ? value : ""} type="tel" autoComplete="tel" maxLength={field.maxLength ?? 25} />;
      break;
    case "registration":
      control = <input {...common} defaultValue={typeof value === "string" ? value : ""} type="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={field.maxLength ?? 12} className="registration-input" />;
      break;
    default:
      control = <input {...common} defaultValue={typeof value === "string" ? value : ""} type="text" maxLength={field.maxLength ?? 200} />;
  }
  return (
    <div className={`field ${widthClass}`}>
      <label htmlFor={id}>{labelText}{field.required && <span aria-hidden="true"> *</span>}</label>
      {control}
      {extras}
    </div>
  );
}

export type FormSnapshot = { id: string; answers: Answers; automaticTimeFields: string[] };
export type TemplateFormProps = {
  definition: TemplateDefinition; organizationId: string; templateVersionId: string;
  reportId?: string; revision?: number; initialAnswers?: Answers; automaticTimeFields?: string[]; completion?: boolean;
  initialId?: string; onLocalChange?: (snapshot: FormSnapshot) => void;
  beforePersist?: () => Promise<void>; onPersisted?: () => void | Promise<void>;
};

export function TemplateForm({ definition, organizationId, templateVersionId, reportId, revision, initialAnswers = {}, automaticTimeFields, completion = false,
  initialId, onLocalChange, beforePersist, onPersisted }: TemplateFormProps) {
  const prefix = useId();
  const [result, setResult] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [recoveryId, setRecoveryId] = useState(reportId);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const timeRules = definition.rules.filter((rule) => rule.type === "time_span");
  const [timeFields, setTimeFields] = useState<Record<string, TimeField>>(() => Object.fromEntries(timeRules.map((rule) => {
    const saved = initialAnswers[rule.billableHoursField];
    // Legacy reports have no mode: preserve every nonempty saved value as manual.
    const automatic = automaticTimeFields ? automaticTimeFields.includes(rule.billableHoursField) : !saved;
    const calculated = calculatedTimeHours(rule, initialAnswers);
    return [rule.billableHoursField, { automatic, calculated, value: automatic ? displayHours(calculated) : typeof saved === "string" ? saved : "" }];
  })));
  const [dirty, setDirty] = useState(() => Object.entries(timeFields).some(([key, field]) => field.automatic && field.value.replace(",", ".") !== String(initialAnswers[key] ?? "").replace(",", ".")));
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(dirty);
  const savingRef = useRef(false);
  const newId = useRef<string | null>(initialId ?? null);
  const [editCount, setEditCount] = useState(0);

  useEffect(() => {
    // Opening a form is not an edit; only user changes create a local draft.
    if (editCount === 0 || !formRef.current || savingRef.current || !onLocalChange) return;
    onLocalChange({ id: reportId ?? (newId.current ??= crypto.randomUUID()),
      answers: collectAnswers(formRef.current, definition),
      automaticTimeFields: Object.entries(timeFields).filter(([, field]) => field.automatic).map(([key]) => key) });
  }, [editCount, timeFields, onLocalChange, reportId, definition]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; }
    }
    function beforeNavigate(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (dirtyRef.current && anchor && !window.confirm("Du har osparade ändringar. Vill du lämna rapporten?")) {
        event.preventDefault(); event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeNavigate, true); };
  }, []);

  function markDirty() {
    setEditCount((count) => count + 1);
    dirtyRef.current = true; setDirty(true); setConfirmSubmit(false); setResult(null); if (!conflict) setMessage("");
  }

  function updateTimes(form: HTMLFormElement) {
    const answers = collectAnswers(form, definition);
    setTimeFields((current) => Object.fromEntries(timeRules.map((rule) => {
      const field = current[rule.billableHoursField];
      const calculated = calculatedTimeHours(rule, answers);
      return [rule.billableHoursField, { ...field, calculated, value: field.automatic ? displayHours(calculated) : field.value }];
    })));
  }

  function timeControl(key: string): TimeControl | undefined {
    const field = timeFields[key];
    if (!field) return undefined;
    return { ...field,
      edit: (value) => setTimeFields((current) => ({ ...current, [key]: { ...current[key], automatic: false, value } })),
      reset: () => {
        setTimeFields((current) => ({ ...current, [key]: { ...current[key], automatic: true, value: displayHours(current[key].calculated) } }));
        markDirty();
      },
    };
  }

  function check(form: HTMLFormElement) {
    const evaluation = evaluateAnswers(definition, collectAnswers(form, definition));
    setResult(evaluation);
    const first = evaluation.errors.find((error) => error.field);
    if (first?.field) {
      const element = document.getElementById(`${prefix}-${first.field}`) ?? document.querySelector<HTMLElement>(`[name="${first.field}"]`);
      element?.focus();
    }
    return evaluation.errors.length === 0;
  }

  async function persist(submit: boolean) {
    if (savingRef.current || conflict || !formRef.current) return;
    if (!navigator.onLine) {
      setMessage("Ingen anslutning. Rapporten har inte skickats till servern. Fortsätt arbeta och försök igen när du har täckning. Kontrollera ovan att utkastet är sparat på enheten.");
      setConfirmSubmit(false);
      return;
    }
    // Collect before disabling controls, since disabled inputs are excluded from FormData.
    const answers = collectAnswers(formRef.current, definition);
    const automaticTimeFields = Object.entries(timeFields).filter(([, field]) => field.automatic).map(([key]) => key);
    savingRef.current = true;
    setBusy(true);
    setMessage("");
    const chosenId = reportId ?? (newId.current ??= crypto.randomUUID());
    const base = `/api/foretag/${encodeURIComponent(organizationId)}/rapporter`;
    try {
      await beforePersist?.();
      const response = await fetch(`${base}${reportId ? `/${reportId}` : ""}${submit ? "/skicka-in" : ""}`, {
        method: reportId && !submit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportId ? { revision, answers, automaticTimeFields } : { id: chosenId, templateVersionId, answers, automaticTimeFields }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.evaluation) setResult(data.evaluation);
        setConflict(response.status === 409);
        setMessage(data.message ?? "Rapporten kunde inte sparas.");
        setConfirmSubmit(false);
        return;
      }
      if (!reportId && data.created === false) {
        setConflict(true);
        setRecoveryId(data.id);
        const savedMessage = data.status === "draft" ? "Utkastet finns redan sparat." : "Rapporten är redan inskickad.";
        setMessage(`${savedMessage} Dina uppgifter finns kvar i formuläret. Öppna den sparade rapporten för att kontrollera vad som sparades innan du fortsätter.`);
        setConfirmSubmit(false);
        return;
      }
      dirtyRef.current = false;
      await onPersisted?.();
      // A full navigation also works from the cached, standalone offline page.
      window.location.replace(`/rapportor/rapporter/${encodeURIComponent(data.id)}?sparad=1`);
    } catch (error) {
      setMessage(error instanceof Error && error.name === "Error" ? error.message : "Kunde inte bekräfta sparandet. Dina uppgifter finns kvar här. Kontrollera anslutningen och försök igen.");
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "save";
    if (action === "save") { void persist(false); return; }
    setConfirmSubmit(check(event.currentTarget));
  }

  async function openSaved() {
    if (!window.confirm("Dina lokala ändringar ersätts av uppgifterna på servern. Vill du fortsätta?")) return;
    dirtyRef.current = false;
    await onPersisted?.();
    window.location.assign(recoveryId ? `/rapportor/rapporter/${encodeURIComponent(recoveryId)}` : "/rapportor/ny");
  }

  const errorFor = (key: string) => result?.errors.find((error) => error.field === key)?.message;

  return (
    <form ref={formRef} className="report-form" onSubmit={handleSubmit} onChange={(event) => {
      updateTimes(event.currentTarget); markDirty();
    }} noValidate aria-busy={busy}>
      <p className="form-help required-note">Fält markerade med * krävs vid inskick. Skicka in när du är klar eller spara ett utkast för att fortsätta senare.</p>
      <p className="form-help" role="status">{dirty ? "Du har ändringar som inte sparats på servern." : reportId ? completion ? "Du arbetar med en komplettering." : "Du arbetar med ett utkast." : "Rapporten är inte sparad på servern ännu."} Skicka in eller välj {completion ? "Spara komplettering" : "Spara utkast"} för att spara på servern.</p>
      <fieldset className="report-fields" disabled={busy}>
      <legend className="sr-only">Rapportuppgifter</legend>
      {definition.sections.map((section) => (
        <section className="form-section" key={section.key} aria-labelledby={`${prefix}-${section.key}-title`}>
          <h2 id={`${prefix}-${section.key}-title`}>{section.title}</h2>
          {sectionDescription(definition, section) && <p>{sectionDescription(definition, section)}</p>}
          <div className="field-grid">
            {section.fields.map((field) => <Field key={field.key} field={field} prefix={prefix} error={errorFor(field.key)} value={initialAnswers[field.key]} timeControl={timeControl(field.key)} />)}
          </div>
        </section>
      ))}
      </fieldset>
      <div className="form-results" aria-live="polite">
        {result && result.computed.length > 0 && (
          <div className="form-computed">
            {result.computed.map((item) => <span key={item.label}><strong>{item.label}:</strong> {item.value}</span>)}
          </div>
        )}
        {result?.warnings.map((warning) => <p className="form-warning" key={`${warning.field}-${warning.message}`}>{warning.message}</p>)}
        {result && result.errors.length > 0 && (
          <div className="form-error" role="alert">
            <strong>Kontrollera {result.errors.length === 1 ? "uppgiften" : `${result.errors.length} uppgifter`}:</strong>
            <ul>{result.errors.map((error) => <li key={`${error.field}-${error.message}`}>{error.message}</li>)}</ul>
          </div>
        )}
        {result && result.errors.length === 0 && <p className="form-success">Uppgifterna är kompletta enligt mallen.</p>}
      </div>
      {message && <p className="form-error" role="alert">{message}</p>}
      {conflict && <button type="button" className="text-button" onClick={openSaved}>{recoveryId ? "Öppna den sparade rapporten" : "Öppna Ny rapport igen"}</button>}
      <div className="form-actions">
        <button type="submit" value="submit" className="button-primary" disabled={busy || conflict}>{completion ? "Skicka in igen" : "Skicka in"}</button>
        <button type="submit" value="save" className="button-secondary" disabled={busy || conflict}>{completion ? "Spara komplettering" : "Spara utkast"}</button>
      </div>
      {busy && <p className="form-help" role="status">Sparar…</p>}
      {confirmSubmit && <section className="form-section" aria-labelledby={`${prefix}-submit`}>
        <h2 id={`${prefix}-submit`}>Skicka rapporten till granskning</h2>
        <p>Uppgifterna sparas och rapporten låses för redigering. Ditt konto och tidpunkten registreras vid inskick.{completion && " Tidigare inskick finns kvar i historiken."}</p>
        <div className="form-actions"><button type="button" className="button-primary" disabled={busy || conflict} onClick={() => void persist(true)}>Bekräfta och skicka in</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmSubmit(false)}>Fortsätt redigera</button></div>
      </section>}
    </form>
  );
}
