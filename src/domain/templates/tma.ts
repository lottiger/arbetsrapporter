import type { TemplateDefinition } from "../templates.ts";

/**
 * Baserad på blanketten "Underlag TMA" (Jämtlands Bärgningstjänst AB).
 * Underskriften på pappret ersätts av den inloggade rapportören som skickar in rapporten.
 */
export const tmaTemplate: TemplateDefinition = {
  key: "tma",
  title: "Underlag TMA",
  description: "Rapportera ett utfört TMA-arbete: uppdrag, tider, kontroll och eventuella avvikelser.",
  source: "Blanketten Underlag TMA",
  sections: [
    {
      key: "uppdrag",
      title: "Uppdrag",
      fields: [
        { key: "tmaRegnr", label: "Regnr TMA-bil", type: "registration", required: true, width: "half" },
        { key: "datum", label: "Datum", type: "date", required: true, width: "half" },
        { key: "kund", label: "Kund", type: "text", required: true, width: "half" },
        { key: "markning", label: "Märkning", type: "text", hint: "Kundens referens eller märkning för fakturan.", width: "half" },
        { key: "vagnummer", label: "Vägnummer", type: "text", required: true, width: "half" },
        { key: "arbetsplats", label: "Arbetsplats", type: "text", required: true, width: "half" },
      ],
    },
    {
      key: "tid",
      title: "Tid",
      description: "Sluttid före starttid räknas som nästa dygn. Arbetad tid beräknas och visas, men debiterbara timmar anges alltid av dig.",
      fields: [
        { key: "starttid", label: "Starttid", type: "time", required: true, width: "third" },
        { key: "sluttid", label: "Sluttid", type: "time", required: true, width: "third" },
        { key: "rast", label: "Rast", type: "integer", unit: "minuter", min: 0, max: 600, required: true, width: "third" },
        { key: "debiterbaraTimmar", label: "Debiterbara timmar", type: "decimal", unit: "h", min: 0, max: 48, step: 0.25, required: true, width: "half" },
      ],
    },
    {
      key: "arbete",
      title: "Kontroll och arbete",
      fields: [
        { key: "kontrollFore", label: "Kontroll före avfärd samt innan påbörjat arbete, är det gjort?", type: "yesno", required: true },
        { key: "arbetsuppgifter", label: "Arbetsuppgifter under dagen", type: "textarea", required: true },
        { key: "avvikelser", label: "Avvikelser under dagen", type: "textarea", hint: "Beskriv även varför debiterbara timmar avviker från arbetad tid, om de gör det." },
        { key: "tillbud", label: "Tillbud under dagen?", type: "yesno", required: true, hint: "Vid ja: kontakta ansvarig chef för hantering." },
        { key: "tillbudBeskrivning", label: "Beskrivning av tillbudet", type: "textarea" },
      ],
    },
    {
      key: "underskrift",
      title: "Underskrift",
      description: "Rapporten undertecknas digitalt av den inloggade rapportören när den skickas in.",
      fields: [
        { key: "namn", label: "Namn", type: "text", required: true, width: "half" },
      ],
    },
  ],
  rules: [
    { type: "time_span", label: "Arbetad tid", startField: "starttid", endField: "sluttid", breakMinutesField: "rast", billableHoursField: "debiterbaraTimmar", overnight: true },
    { type: "required_if", field: "tillbudBeskrivning", whenField: "tillbud", equalsAny: ["ja"] },
  ],
};
