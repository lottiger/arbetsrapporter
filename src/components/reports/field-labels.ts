import { fieldByKey, type FieldType, type TemplateDefinition, type TemplateRule } from "@/domain/templates";

export const fieldTypeLabels: Record<FieldType, string> = {
  text: "Text",
  textarea: "Fritext",
  registration: "Registreringsnummer",
  email: "E-postadress",
  phone: "Telefonnummer",
  integer: "Heltal",
  decimal: "Tal",
  date: "Datum",
  time: "Klockslag",
  yesno: "Ja/Nej",
  select: "Ett val",
  multiselect: "Flera val",
};

export function describeRule(definition: TemplateDefinition, rule: TemplateRule) {
  const label = (key: string) => fieldByKey(definition, key)?.label ?? key;
  const optionLabel = (fieldKey: string, value: string) =>
    fieldByKey(definition, fieldKey)?.options?.find((option) => option.value === value)?.label ?? (value === "ja" ? "Ja" : value === "nej" ? "Nej" : value);
  switch (rule.type) {
    case "time_span":
      return `${rule.label} beräknas från ${label(rule.startField).toLowerCase()} till ${label(rule.endField).toLowerCase()}` +
        (rule.breakMinutesField ? ` minus ${label(rule.breakMinutesField).toLowerCase()}` : "") +
        (rule.overnight ? ", även över midnatt" : "") +
        `. Värdet visas bredvid ${label(rule.billableHoursField).toLowerCase()} och ersätter aldrig det angivna värdet; en avvikelse ger en varning.`;
    case "required_if":
      return `${label(rule.field)} måste fyllas i när ${label(rule.whenField).toLowerCase()} är ${rule.equalsAny.map((value) => optionLabel(rule.whenField, value).toLowerCase()).join(" eller ")}.`;
    case "at_least_one":
      return `Minst ett av fälten ${rule.fields.map(label).join(", ")} måste fyllas i.`;
    default:
      return "";
  }
}
