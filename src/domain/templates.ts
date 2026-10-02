/**
 * Rapportmallar: domäntyper, kontroll av malldefinition och utvärdering av svar.
 * Ingen databas- eller klientkod här. Modulen används av server, skript och klient.
 * Mallar är deklarativa: ingen JavaScript från en mall körs någonsin.
 */

export type FieldType =
  | "text" | "textarea" | "registration" | "email" | "phone"
  | "integer" | "decimal" | "date" | "time" | "yesno" | "select" | "multiselect";

export type FieldOption = { value: string; label: string };

export type FieldDefinition = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: FieldOption[];
  width?: "full" | "half" | "third";
};

export type SectionDefinition = {
  key: string;
  title: string;
  description?: string;
  fields: FieldDefinition[];
};

/** Tillåtna regler. Varje regel refererar till fältnycklar i samma mall. */
export type TemplateRule =
  | {
      type: "time_span";
      label: string;
      startField: string;
      endField: string;
      breakMinutesField?: string;
      billableHoursField: string;
      /** Sluttid före starttid tolkas som nästa dygn. */
      overnight: boolean;
    }
  | { type: "required_if"; field: string; whenField: string; equalsAny: string[] }
  | { type: "at_least_one"; fields: string[]; message: string };

export type TemplateDefinition = {
  key: string;
  title: string;
  description: string;
  /** Kort beskrivning av källan, t.ex. blankettens namn. */
  source: string;
  sections: SectionDefinition[];
  rules: TemplateRule[];
};

export type AnswerValue = string | string[] | boolean | undefined;
export type Answers = Record<string, AnswerValue>;

export type Evaluation = {
  errors: { field: string | null; message: string }[];
  warnings: { field: string | null; message: string }[];
  computed: { label: string; value: string }[];
  /** Normaliserade svar: trimmade texter, versala regnr, tomma värden borttagna. */
  answers: Answers;
};

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,39}$/;
const OPTION_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DECIMAL_PATTERN = /^-?\d+(\.\d{1,2})?$/;

export function allFields(definition: TemplateDefinition) {
  return definition.sections.flatMap((section) => section.fields);
}

export function fieldByKey(definition: TemplateDefinition, key: string) {
  return allFields(definition).find((field) => field.key === key);
}

/** Kontrollerar att en malldefinition är konsekvent. Tom lista betyder godkänd. */
export function templateDefinitionIssues(definition: TemplateDefinition): string[] {
  const issues: string[] = [];
  if (!KEY_PATTERN.test(definition.key)) issues.push("Mallens nyckel har fel format.");
  if (!definition.title.trim() || definition.title.length > 120) issues.push("Mallens titel saknas eller är för lång.");
  if (!definition.sections.length) issues.push("Mallen saknar sektioner.");
  const seenKeys = new Set<string>();
  const sectionKeys = new Set<string>();
  for (const section of definition.sections) {
    if (!KEY_PATTERN.test(section.key) || sectionKeys.has(section.key)) issues.push(`Sektionen "${section.title}" har ogiltig eller dubblerad nyckel.`);
    sectionKeys.add(section.key);
    if (!section.fields.length) issues.push(`Sektionen "${section.title}" saknar fält.`);
    for (const field of section.fields) {
      if (!KEY_PATTERN.test(field.key)) issues.push(`Fältet "${field.label}" har ogiltig nyckel.`);
      if (seenKeys.has(field.key)) issues.push(`Fältnyckeln "${field.key}" används mer än en gång.`);
      seenKeys.add(field.key);
      if (!field.label.trim()) issues.push(`Fältet "${field.key}" saknar etikett.`);
      const needsOptions = field.type === "select" || field.type === "multiselect";
      if (needsOptions && !(field.options && field.options.length >= 2)) issues.push(`Fältet "${field.key}" behöver minst två alternativ.`);
      if (!needsOptions && field.options) issues.push(`Fältet "${field.key}" ska inte ha alternativ.`);
      if (field.options) {
        const values = field.options.map((option) => option.value);
        if (new Set(values).size !== values.length || values.some((value) => !OPTION_PATTERN.test(value))) {
          issues.push(`Fältet "${field.key}" har dubblerade eller ogiltiga alternativvärden.`);
        }
      }
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) issues.push(`Fältet "${field.key}" har min större än max.`);
      if (field.maxLength !== undefined && (field.maxLength < 1 || field.maxLength > 5000)) issues.push(`Fältet "${field.key}" har ogiltig maxlängd.`);
    }
  }
  const typeOf = (key: string) => fieldByKey(definition, key)?.type;
  for (const rule of definition.rules) {
    if (rule.type === "time_span") {
      if (typeOf(rule.startField) !== "time" || typeOf(rule.endField) !== "time") issues.push("Tidsregeln pekar inte på två tidsfält.");
      if (rule.breakMinutesField && typeOf(rule.breakMinutesField) !== "integer") issues.push("Tidsregelns rastfält måste vara ett heltalsfält.");
      if (typeOf(rule.billableHoursField) !== "decimal") issues.push("Tidsregelns fält för debiterbar tid måste vara ett decimalfält.");
    } else if (rule.type === "required_if") {
      const whenType = typeOf(rule.whenField);
      if (!typeOf(rule.field) || (whenType !== "select" && whenType !== "multiselect" && whenType !== "yesno")) {
        issues.push(`Villkorsregeln för "${rule.field}" pekar på okända eller olämpliga fält.`);
      }
      if (fieldByKey(definition, rule.field)?.required) issues.push(`Fältet "${rule.field}" är redan obligatoriskt; villkorsregeln är överflödig.`);
    } else if (rule.type === "at_least_one") {
      if (rule.fields.length < 2 || rule.fields.some((key) => !typeOf(key))) issues.push("Regeln för minst ett ifyllt fält behöver minst två kända fält.");
    }
  }
  return issues;
}

/** Minuter mellan två klockslag. Sluttid före start tolkas som nästa dygn om overnight är satt. */
export function minutesBetween(start: string, end: string, overnight: boolean): number | null {
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) return null;
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const diff = toMinutes(end) - toMinutes(start);
  if (diff < 0) return overnight ? diff + 24 * 60 : null;
  return diff;
}

export function formatHours(minutes: number) {
  return (Math.round((minutes / 60) * 100) / 100).toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}

function normalize(field: FieldDefinition, raw: AnswerValue): AnswerValue {
  if (field.type === "multiselect") {
    const values = Array.isArray(raw) ? raw : typeof raw === "string" && raw ? [raw] : [];
    return values.length ? values : undefined;
  }
  if (field.type === "yesno") {
    if (typeof raw === "boolean") return raw;
    if (raw === "ja") return true;
    if (raw === "nej") return false;
    return undefined;
  }
  if (typeof raw !== "string") return undefined;
  let value = raw.trim();
  if (field.type === "registration") value = value.toUpperCase().replace(/\s+/g, "");
  if (field.type === "decimal") value = value.replace(",", ".");
  return value === "" ? undefined : value;
}

function isEmpty(value: AnswerValue) {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function fieldError(field: FieldDefinition, value: AnswerValue): string | null {
  if (isEmpty(value)) return null;
  const text = typeof value === "string" ? value : "";
  const maxLength = field.maxLength ?? (field.type === "textarea" ? 2000 : 200);
  if (typeof value === "string" && value.length > maxLength) return `${field.label}: högst ${maxLength} tecken.`;
  switch (field.type) {
    case "integer":
      if (!/^-?\d+$/.test(text)) return `${field.label}: ange ett heltal.`;
      break;
    case "decimal":
      if (!DECIMAL_PATTERN.test(text)) return `${field.label}: ange ett tal med högst två decimaler.`;
      break;
    case "date":
      if (!DATE_PATTERN.test(text)) return `${field.label}: ange datum som ÅÅÅÅ-MM-DD.`;
      break;
    case "time":
      if (!TIME_PATTERN.test(text)) return `${field.label}: ange klockslag som HH:MM.`;
      break;
    case "email":
      if (!EMAIL_PATTERN.test(text)) return `${field.label}: ange en giltig e-postadress.`;
      break;
    case "phone":
      if (!/^\+?[\d\s()-]{5,25}$/.test(text)) return `${field.label}: ange ett giltigt telefonnummer.`;
      break;
    case "registration":
      if (!/^[A-Z0-9-]{2,12}$/.test(text)) return `${field.label}: ange registreringsnumret med bokstäver och siffror.`;
      break;
    case "select":
      if (!field.options?.some((option) => option.value === value)) return `${field.label}: välj ett av alternativen.`;
      break;
    case "multiselect":
      if (!Array.isArray(value) || value.some((item) => !field.options?.some((option) => option.value === item))) return `${field.label}: välj bland alternativen.`;
      break;
    case "yesno":
      if (typeof value !== "boolean") return `${field.label}: välj Ja eller Nej.`;
      break;
    default:
      break;
  }
  if (field.type === "integer" || field.type === "decimal") {
    const number = Number(text);
    const unit = field.unit ? ` ${field.unit}` : "";
    if (field.min !== undefined && number < field.min) return `${field.label}: minst ${field.min}${unit}.`;
    if (field.max !== undefined && number > field.max) return `${field.label}: högst ${field.max}${unit}.`;
  }
  return null;
}

/**
 * Utvärderar svar mot en mall. Fel hindrar inskick; varningar visas men hindrar inte.
 * Beräknad tid presenteras alltid separat och ersätter aldrig angiven debiterbar tid.
 */
export function evaluateAnswers(definition: TemplateDefinition, raw: Answers): Evaluation {
  const result: Evaluation = { errors: [], warnings: [], computed: [], answers: {} };
  for (const field of allFields(definition)) {
    const value = normalize(field, raw[field.key]);
    if (!isEmpty(value)) result.answers[field.key] = value;
    if (field.required && isEmpty(value)) {
      result.errors.push({ field: field.key, message: `${field.label} måste fyllas i.` });
      continue;
    }
    const error = fieldError(field, value);
    if (error) result.errors.push({ field: field.key, message: error });
  }
  const label = (key: string) => fieldByKey(definition, key)?.label ?? key;
  for (const rule of definition.rules) {
    if (rule.type === "required_if") {
      const trigger = result.answers[rule.whenField];
      const active = Array.isArray(trigger)
        ? trigger.some((item) => rule.equalsAny.includes(item))
        : typeof trigger === "boolean"
          ? rule.equalsAny.includes(trigger ? "ja" : "nej")
          : typeof trigger === "string" && rule.equalsAny.includes(trigger);
      if (active && isEmpty(result.answers[rule.field])) {
        result.errors.push({ field: rule.field, message: `${label(rule.field)} måste fyllas i med det val som gjorts under ${label(rule.whenField).toLowerCase()}.` });
      }
    } else if (rule.type === "at_least_one") {
      if (rule.fields.every((key) => isEmpty(result.answers[key]))) result.errors.push({ field: rule.fields[0], message: rule.message });
    } else if (rule.type === "time_span") {
      const start = result.answers[rule.startField];
      const end = result.answers[rule.endField];
      if (typeof start !== "string" || typeof end !== "string" || !TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) continue;
      const span = minutesBetween(start, end, rule.overnight);
      if (span === null) {
        result.errors.push({ field: rule.endField, message: `${label(rule.endField)} kan inte vara före ${label(rule.startField).toLowerCase()}.` });
        continue;
      }
      if (span === 0) result.warnings.push({ field: rule.endField, message: `${label(rule.startField)} och ${label(rule.endField).toLowerCase()} är lika. Kontrollera tiderna.` });
      const breakRaw = rule.breakMinutesField ? result.answers[rule.breakMinutesField] : undefined;
      const breakMinutes = typeof breakRaw === "string" && /^\d+$/.test(breakRaw) ? Number(breakRaw) : 0;
      if (breakMinutes > span) {
        result.errors.push({ field: rule.breakMinutesField ?? null, message: "Rasten är längre än tiden mellan start och slut." });
        continue;
      }
      const worked = span - breakMinutes;
      const overnight = minutesBetween(start, end, false) === null;
      result.computed.push({ label: rule.label, value: `${formatHours(worked)} h${overnight ? " (över midnatt)" : ""}` });
      const billable = result.answers[rule.billableHoursField];
      if (typeof billable === "string" && DECIMAL_PATTERN.test(billable) && Math.abs(Number(billable) - worked / 60) > 0.01) {
        result.warnings.push({
          field: rule.billableHoursField,
          message: `${label(rule.billableHoursField)} (${Number(billable).toLocaleString("sv-SE")} h) skiljer sig från ${rule.label.toLowerCase()} (${formatHours(worked)} h). Det angivna värdet behålls. Förklara avvikelsen i rapporten.`,
        });
      }
    }
  }
  return result;
}
