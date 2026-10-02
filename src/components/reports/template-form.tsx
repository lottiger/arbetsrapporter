"use client";

import { useId, useState, type FormEvent } from "react";
import { evaluateAnswers, type Answers, type Evaluation, type FieldDefinition, type TemplateDefinition } from "@/domain/templates";
import { Icon } from "@/components/ui/icon";

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

function Field({ field, prefix, error }: { field: FieldDefinition; prefix: string; error?: string }) {
  const id = `${prefix}-${field.key}`;
  const hintId = field.hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const labelText = `${field.label}${field.unit ? ` (${field.unit})` : ""}`;
  const widthClass = field.width === "half" ? "half" : field.width === "third" ? "third" : "";
  const common = { id, name: field.key, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": field.required || undefined };
  const extras = (
    <>
      {field.hint && <span className="field-hint" id={hintId}>{field.hint}</span>}
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
              <input type={field.type === "yesno" ? "radio" : "checkbox"} name={field.key} value={option.value} />
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
      control = <textarea {...common} maxLength={field.maxLength ?? 2000} rows={4} />;
      break;
    case "select":
      control = (
        <select {...common} defaultValue="">
          <option value="">Välj…</option>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      );
      break;
    case "integer":
      control = <input {...common} type="number" inputMode="numeric" step={1} min={field.min} max={field.max} />;
      break;
    case "decimal":
      control = <input {...common} type="text" inputMode="decimal" placeholder={field.step ? `t.ex. ${field.step.toLocaleString("sv-SE")}` : undefined} maxLength={12} />;
      break;
    case "date":
      control = <input {...common} type="date" />;
      break;
    case "time":
      control = <input {...common} type="time" />;
      break;
    case "email":
      control = <input {...common} type="email" autoComplete="email" maxLength={field.maxLength ?? 200} />;
      break;
    case "phone":
      control = <input {...common} type="tel" autoComplete="tel" maxLength={field.maxLength ?? 25} />;
      break;
    case "registration":
      control = <input {...common} type="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={field.maxLength ?? 12} className="registration-input" />;
      break;
    default:
      control = <input {...common} type="text" maxLength={field.maxLength ?? 200} />;
  }
  return (
    <div className={`field ${widthClass}`}>
      <label htmlFor={id}>{labelText}{field.required && <span aria-hidden="true"> *</span>}</label>
      {control}
      {extras}
    </div>
  );
}

export function TemplateForm({ definition }: { definition: TemplateDefinition }) {
  const prefix = useId();
  const [result, setResult] = useState<Evaluation | null>(null);

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const evaluation = evaluateAnswers(definition, collectAnswers(event.currentTarget, definition));
    setResult(evaluation);
    const first = evaluation.errors.find((error) => error.field);
    if (first?.field) {
      const element = document.getElementById(`${prefix}-${first.field}`) ?? document.querySelector<HTMLElement>(`[name="${first.field}"]`);
      element?.focus();
    }
  }

  const errorFor = (key: string) => result?.errors.find((error) => error.field === key)?.message;

  return (
    <form className="report-form" onSubmit={check} noValidate>
      <p className="form-help required-note">Fält markerade med * måste fyllas i.</p>
      {definition.sections.map((section) => (
        <section className="form-section" key={section.key} aria-labelledby={`${prefix}-${section.key}-title`}>
          <h2 id={`${prefix}-${section.key}-title`}>{section.title}</h2>
          {section.description && <p>{section.description}</p>}
          <div className="field-grid">
            {section.fields.map((field) => <Field key={field.key} field={field} prefix={prefix} error={errorFor(field.key)} />)}
          </div>
        </section>
      ))}
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
      <div className="form-actions">
        <button type="submit" className="button-primary">Kontrollera uppgifterna</button>
      </div>
      <div className="notice">
        <Icon name="clock" />
        <div><h2>Sparande kopplas in i nästa steg</h2><p>Du kan fylla i och kontrollera formuläret, men inget sparas ännu. Utkast, inskick och granskning byggs härnäst.</p></div>
      </div>
    </form>
  );
}
