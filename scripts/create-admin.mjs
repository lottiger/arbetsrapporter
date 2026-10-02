import { fileURLToPath } from "node:url";
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import nextEnv from "@next/env";
import { getDatabase } from "../src/server/db.ts";
import { provisionCompany } from "../src/server/provisioning.ts";

if (!process.stdin.isTTY) {
  console.error("Kör npm run admin:create i en interaktiv terminal. Lösenord ska inte anges som kommandoradsargument.");
  process.exitCode = 1;
} else {
  let muted = false;
  let client;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  try {
    nextEnv.loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true, { info() {}, error() {} });
    const connection = getDatabase();
    client = connection.client;
    console.log("Skapa ett nytt företag och dess första administratör. Befintliga konton ändras inte.");
    const company = await prompt.question("Företagsnamn: ");
    const name = await prompt.question("Ditt namn: ");
    const email = await prompt.question("E-postadress: ");
    process.stdout.write("Lösenord (12–128 tecken, visas inte): ");
    muted = true;
    const password = await prompt.question("");
    muted = false;
    process.stdout.write("\nUpprepa lösenordet (visas inte): ");
    muted = true;
    const confirmation = await prompt.question("");
    muted = false;
    process.stdout.write("\n");
    if (password !== confirmation) {
      console.error("Lösenorden stämmer inte överens. Inget konto har skapats.");
      process.exitCode = 1;
    } else {
      await provisionCompany(client, connection.db, connection.config, { company, name, email, password });
      console.log("Företaget och administratörskontot är skapade. Logga in på http://localhost:3000/logga-in.");
    }
  } catch {
    console.error("Kontot kunde inte skapas. Kontrollera uppgifterna, att företag/e-post inte redan finns, samt npm run db:check. Befintliga konton har inte ändrats.");
    process.exitCode = 1;
  } finally {
    muted = false;
    prompt.close();
    await client?.close();
  }
}
