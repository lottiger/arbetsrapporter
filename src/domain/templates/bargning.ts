import type { TemplateDefinition } from "../templates.ts";

/**
 * Baserad på blanketten "Bärgningsbesked/underlag".
 * Bilder, baksidan för utlandskund och strukturerade kostnadsrader ingår inte i denna version;
 * kostnader anges tills vidare under Övrig information som på pappersblanketten.
 */
export const bargningTemplate: TemplateDefinition = {
  key: "bargning",
  title: "Bärgningsbesked/underlag",
  description: "Samla uppgifter om kund, fordon, plats, tider, orsak och uppdrag för ett bärgningsuppdrag.",
  source: "Blanketten Bärgningsbesked/underlag",
  sections: [
    {
      key: "kund",
      title: "Kund",
      fields: [
        { key: "kund", label: "Kund", type: "text", required: true, width: "half" },
        { key: "forareFordon", label: "Förare av fordonet", type: "text", width: "half" },
        { key: "telefonForare", label: "Telefon förare", type: "phone", width: "half" },
        { key: "personOrgnr", label: "Person-/organisationsnummer", type: "text", maxLength: 20, width: "half" },
        { key: "korkort", label: "Körkort 4d", type: "text", maxLength: 40, hint: "Fält 4d på körkortet.", width: "half" },
        { key: "forsakringsbolag", label: "Försäkringsbolag", type: "text", width: "half" },
        { key: "sjalvrisk", label: "Självrisk", type: "text", maxLength: 40, width: "half" },
        { key: "skadenr", label: "Skadenummer", type: "text", maxLength: 40, width: "half" },
        { key: "telefonForetag", label: "Telefon företag/kontor", type: "phone", width: "half" },
        { key: "fakturaMail", label: "Mailadress för faktura", type: "email", width: "half" },
      ],
    },
    {
      key: "fordon",
      title: "Fordon",
      description: "Ange registreringsnummer för bil och/eller släp.",
      fields: [
        { key: "regnrBil", label: "Regnr bil", type: "registration", width: "half" },
        { key: "regnrSlap", label: "Regnr släp/vagn/trailer", type: "registration", width: "half" },
        { key: "objektMarke", label: "Objekt/märke", type: "text", required: true, width: "half" },
        {
          key: "fordonstyp", label: "Fordonstyp", type: "select", required: true, width: "half",
          options: [
            { value: "personbil", label: "Personbil" },
            { value: "buss", label: "Buss" },
            { value: "lastbil", label: "Lastbil" },
            { value: "slap", label: "Släp" },
            { value: "annat", label: "Annat" },
          ],
        },
        { key: "lastTon", label: "Last", type: "decimal", unit: "ton", min: 0, max: 200, width: "third" },
        { key: "bruttovikt", label: "Bärgad bruttovikt", type: "text", maxLength: 40, hint: "Ange värde och enhet, till exempel 3 500 kg.", width: "third" },
        { key: "matarstallning", label: "Mätarställning kundfordon", type: "integer", unit: "km", min: 0, max: 9999999, hint: "Behövs för garanti- och försäkringsärenden.", width: "third" },
      ],
    },
    {
      key: "plats",
      title: "Plats",
      fields: [
        { key: "olycksplats", label: "Olycksplats, adress", type: "text", required: true },
        { key: "bargadTill", label: "Bärgad till / KPP", type: "text" },
      ],
    },
    {
      key: "tider",
      title: "Uppdrag och tider",
      description: "Åter station före start räknas som nästa dygn. Använd tid beräknas och visas men anges alltid av dig.",
      fields: [
        { key: "datum", label: "Datum", type: "date", required: true, width: "third" },
        { key: "forareBargare", label: "Förare bärgaren", type: "text", required: true, width: "third" },
        { key: "extraMan", label: "Extra man", type: "text", width: "third" },
        { key: "start", label: "Start", type: "time", required: true, width: "third" },
        { key: "ankomst", label: "Ankomst", type: "time", width: "third" },
        { key: "lastad", label: "Lastad", type: "time", width: "third" },
        { key: "utfort", label: "Utfört/KPP", type: "time", width: "third" },
        { key: "aterStation", label: "Åter station", type: "time", required: true, width: "third" },
        { key: "anvandTid", label: "Använd/total tid", type: "decimal", unit: "h", min: 0, max: 72, step: 0.25, required: true, width: "third" },
        { key: "totalKm", label: "Total körsträcka", type: "integer", unit: "km", min: 0, max: 5000, required: true, width: "third" },
      ],
    },
    {
      key: "orsak",
      title: "Orsak och uppdrag",
      fields: [
        {
          key: "orsak", label: "Orsak", type: "multiselect", required: true,
          options: [
            { value: "motorfel", label: "Motorfel" },
            { value: "fast_avakning", label: "Fast/avåkning" },
            { value: "kollision_annat", label: "Kollision med annat fordon" },
            { value: "kollision_singel", label: "Kollision singel" },
            { value: "viltolycka", label: "Viltolycka" },
            { value: "brand", label: "Brand" },
            { value: "stold", label: "Stöld" },
            { value: "kraftoverforing", label: "Fel på kraftöverföring" },
            { value: "lasoppning", label: "Låsöppning" },
            { value: "starthjalp", label: "Starthjälp" },
            { value: "annan", label: "Annan orsak" },
          ],
        },
        { key: "annanOrsak", label: "Annan orsak, beskrivning", type: "text" },
        {
          key: "uppdrag", label: "Uppdrag", type: "multiselect", required: true,
          options: [
            { value: "bargning_vinschning", label: "Bärgning/vinschning" },
            { value: "rep_kpp", label: "Rep/klar på plats KPP" },
            { value: "transport", label: "Transport" },
          ],
        },
      ],
    },
    {
      key: "ovrigt",
      title: "Övrig information",
      description: "Ta bilder för er säkerhet: eventuella skador före bärgningen, X-ljus, hur bilen står, kopplat och liknande. Bilduppladdning kommer i ett senare steg.",
      fields: [
        {
          key: "ovrigInformation", label: "Övrig information", type: "textarea", maxLength: 3000,
          hint: "Extra personal, maskiner, mer kostnad för uppdraget och eventuella skador på kundens fordon. Uppställning, transport och skrotning anges här.",
        },
      ],
    },
  ],
  rules: [
    { type: "at_least_one", fields: ["regnrBil", "regnrSlap"], message: "Ange registreringsnummer för bil eller släp." },
    { type: "required_if", field: "annanOrsak", whenField: "orsak", equalsAny: ["annan"] },
    { type: "time_span", label: "Tid från start till åter station", startField: "start", endField: "aterStation", billableHoursField: "anvandTid", overnight: true },
  ],
};
