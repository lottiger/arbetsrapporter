import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAnswers, minutesBetween, templateDefinitionIssues } from "../src/domain/templates.ts";
import { builtInTemplates } from "../src/domain/templates/index.ts";
import { tmaTemplate } from "../src/domain/templates/tma.ts";
import { bargningTemplate } from "../src/domain/templates/bargning.ts";

// Ifyllt enligt pappersexemplet: 15/9, Roadrental, E14, Lillänge, 22:30–00:30, rast 0, 2 debiterbara timmar.
const tmaExample = {
  tmaRegnr: "wbe 60u", datum: "2026-09-15", kund: "Roadrental", markning: "8752256004", vagnummer: "E14 87an", arbetsplats: "Lillänge",
  starttid: "22:30", sluttid: "00:30", rast: "0", debiterbaraTimmar: "2",
  kontrollFore: "ja", arbetsuppgifter: "Skyddat PIA vid avskyltning av Lillängerondellen", tillbud: "nej", namn: "Olivia Lönn",
};

test("the built-in TMA and towing templates are valid definitions", () => {
  assert.equal(builtInTemplates.length, 2);
  for (const template of builtInTemplates) assert.deepEqual(templateDefinitionIssues(template), [], template.key);
});

test("definition checks catch duplicate keys, missing options and rules pointing at wrong fields", () => {
  const duplicate = { ...tmaTemplate, sections: [...tmaTemplate.sections, { key: "extra", title: "Extra", fields: [{ key: "kund", label: "Kund igen", type: "text" }] }] };
  assert.ok(templateDefinitionIssues(duplicate).some((issue) => issue.includes("kund")));
  const noOptions = { ...tmaTemplate, sections: [{ key: "a", title: "A", fields: [{ key: "val", label: "Val", type: "select" }] }], rules: [] };
  assert.ok(templateDefinitionIssues(noOptions).length);
  const badRule = { ...tmaTemplate, rules: [{ type: "time_span", label: "T", startField: "kund", endField: "sluttid", billableHoursField: "debiterbaraTimmar", overnight: true }] };
  assert.ok(templateDefinitionIssues(badRule).some((issue) => issue.includes("Tidsregeln")));
});

test("TMA over midnight: 22:30 to 00:30 is two hours and matches the billable hours", () => {
  assert.equal(minutesBetween("22:30", "00:30", true), 120);
  assert.equal(minutesBetween("22:30", "00:30", false), null);
  assert.equal(minutesBetween("08:00", "08:00", true), 0);
  const result = evaluateAnswers(tmaTemplate, tmaExample);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.computed, [{ label: "Arbetad tid", value: "2 h (över midnatt)" }]);
  assert.equal(result.answers.tmaRegnr, "WBE60U");
  assert.equal(result.answers.kontrollFore, true);
  assert.equal(result.answers.tillbud, false);
});

test("billable hours that differ from worked time are kept and only produce a warning", () => {
  const result = evaluateAnswers(tmaTemplate, { ...tmaExample, debiterbaraTimmar: "3", rast: "30" });
  assert.deepEqual(result.errors, []);
  assert.equal(result.answers.debiterbaraTimmar, "3");
  assert.deepEqual(result.computed, [{ label: "Arbetad tid", value: "1,5 h (över midnatt)" }]);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].field, "debiterbaraTimmar");
  assert.ok(result.warnings[0].message.includes("1,5"));
});

test("required fields, breaks longer than the shift and incidents without description are errors", () => {
  const missing = evaluateAnswers(tmaTemplate, {});
  const requiredKeys = tmaTemplate.sections.flatMap((section) => section.fields).filter((field) => field.required).map((field) => field.key);
  assert.deepEqual(missing.errors.map((error) => error.field), requiredKeys);
  const longBreak = evaluateAnswers(tmaTemplate, { ...tmaExample, rast: "180" });
  assert.ok(longBreak.errors.some((error) => error.message.includes("Rasten")));
  assert.deepEqual(longBreak.computed, []);
  const incident = evaluateAnswers(tmaTemplate, { ...tmaExample, tillbud: "ja" });
  assert.deepEqual(incident.errors.map((error) => error.field), ["tillbudBeskrivning"]);
  assert.deepEqual(evaluateAnswers(tmaTemplate, { ...tmaExample, tillbud: "ja", tillbudBeskrivning: "Nära påkörning." }).errors, []);
  const badFormat = evaluateAnswers(tmaTemplate, { ...tmaExample, sluttid: "24:30", debiterbaraTimmar: "2,555" });
  assert.deepEqual(badFormat.errors.map((error) => error.field).sort(), ["debiterbaraTimmar", "sluttid"]);
});

test("towing template: registration for car or trailer, other cause needs text, times over midnight", () => {
  const base = {
    kund: "SOS International", regnrBil: "ju 95759", objektMarke: "16876743", fordonstyp: "personbil", olycksplats: "E14 Brunflo",
    datum: "2026-09-20", forareBargare: "Olivia Lönn", start: "23:15", aterStation: "01:45", anvandTid: "2,5", totalKm: "64",
    orsak: ["motorfel"], uppdrag: ["transport"],
    ovrigInformation: "Uppställningsplats 45 dygn à 250 kr exkl. moms/dygn. Transport till skrot 1000 kr exkl. moms.",
  };
  const ok = evaluateAnswers(bargningTemplate, base);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.warnings, []);
  assert.equal(ok.answers.regnrBil, "JU95759");
  assert.equal(ok.answers.anvandTid, "2.5");
  assert.deepEqual(ok.computed, [{ label: "Tid från start till åter station", value: "2,5 h (över midnatt)" }]);
  const noVehicle = evaluateAnswers(bargningTemplate, { ...base, regnrBil: "" });
  assert.ok(noVehicle.errors.some((error) => error.message.includes("registreringsnummer")));
  assert.deepEqual(evaluateAnswers(bargningTemplate, { ...base, regnrBil: "", regnrSlap: "ABC123" }).errors, []);
  const otherCause = evaluateAnswers(bargningTemplate, { ...base, orsak: ["annan"] });
  assert.deepEqual(otherCause.errors.map((error) => error.field), ["annanOrsak"]);
  const unknownOption = evaluateAnswers(bargningTemplate, { ...base, orsak: ["hacked"], fordonstyp: "rymdskepp" });
  assert.deepEqual(unknownOption.errors.map((error) => error.field).sort(), ["fordonstyp", "orsak"]);
  const badEmail = evaluateAnswers(bargningTemplate, { ...base, fakturaMail: "inte-en-adress" });
  assert.deepEqual(badEmail.errors.map((error) => error.field), ["fakturaMail"]);
});
