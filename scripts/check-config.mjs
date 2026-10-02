import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { configIssues } from "./local-config.mjs";

try {
  let loadFailed = false;
  nextEnv.loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true, {
    info() {},
    error() { loadFailed = true; },
  });
  if (loadFailed) throw new Error("Environment loading failed");

  const issues = configIssues(process.env);
  if (issues.length) {
    console.error("Konfigurationen är inte klar:");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("Konfigurationens format är OK. Databasåtkomst, lösenord och inloggning är inte verifierade ännu.");
  }
  console.log("Kontrollen är lokal. Ingen anslutning eller databasändring har gjorts.");
} catch {
  console.error("Kunde inte kontrollera konfigurationen. Kontrollera .env.local. Inga hemliga värden visas.");
  process.exitCode = 1;
}
