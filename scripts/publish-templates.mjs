import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import nextEnv from "@next/env";
import { getDatabase } from "../src/server/db.ts";
import { publishBuiltInTemplates } from "../src/server/templates/service.ts";

/**
 * Publicerar de inbyggda mallarna (TMA och Bärgning) för ett företag.
 * Användning: npm run templates:publish -- "Företagsnamn"
 * Utan argument visas företagen och namnet efterfrågas i terminalen.
 */
let client;
try {
  nextEnv.loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true, { info() {}, error() {} });
  const connection = getDatabase();
  client = connection.client;
  const companies = await connection.db.collection("organizations").find({ status: "active" }).sort({ name: 1 }).toArray();
  if (!companies.length) {
    console.error("Inga aktiva företag finns. Kör npm run admin:create först.");
    process.exitCode = 1;
  } else {
    let name = process.argv[2]?.trim();
    if (!name) {
      if (!process.stdin.isTTY) throw new Error("Ange företagsnamnet som argument när terminalen inte är interaktiv.");
      console.log("Aktiva företag:");
      for (const company of companies) console.log(`- ${company.name}`);
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try { name = (await prompt.question("Publicera mallarna för företag: ")).trim(); } finally { prompt.close(); }
    }
    const company = companies.find((candidate) => candidate.name === name);
    if (!company) {
      console.error("Företaget hittades inte bland de aktiva företagen. Kontrollera stavningen.");
      process.exitCode = 1;
    } else {
      const results = await publishBuiltInTemplates(client, connection.db, company._id, null);
      const describe = { created: "publicerad som version", updated: "uppdaterad till version", unchanged: "oförändrad, version" };
      for (const result of results) console.log(`${result.title}: ${describe[result.action]} ${result.version}.`);
      console.log(`Klart. Mallarna visas under Ny rapport och Mallar för ${company.name}.`);
    }
  }
} catch (error) {
  console.error(error instanceof Error && /Malldefinitionen|Företaget/.test(error.message)
    ? error.message
    : "Mallarna kunde inte publiceras. Kontrollera npm run db:check och försök igen. Inga befintliga mallversioner har ändrats.");
  process.exitCode = 1;
} finally {
  await client?.close();
}
