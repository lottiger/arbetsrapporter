import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { MongoClient } from "mongodb";
import { configIssues } from "./local-config.mjs";

let client;
try {
  nextEnv.loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true, { info() {}, error() {} });
  const issues = configIssues(process.env);
  if (issues.length) {
    for (const issue of issues) console.error(issue);
    process.exitCode = 1;
  } else {
    client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      timeoutMS: 15000,
      maxPoolSize: 2,
    });
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    await db.command({ ping: 1 });
    const topology = await db.command({ hello: 1 });
    const access = await db.command({ connectionStatus: 1 });
    const roles = access.authInfo?.authenticatedUserRoles ?? [];
    const scoped = roles.some((role) => role.role === "readWrite" && role.db === process.env.MONGODB_DB);
    const broad = roles.some((role) => ["atlasAdmin", "root", "readWriteAnyDatabase"].includes(role.role));
    console.log("MongoDB: anslutning och ping OK. Inga dokument har skapats eller ändrats.");
    console.log(`Transaktionsstöd: ${topology.setName || topology.msg === "isdbgrid" ? "replica set/kluster identifierat" : "behöver verifieras"}.`);
    console.log(`Databasroll: ${broad ? "bredare än appdatabasen; begränsa till readWrite för arbetsrapporter_dev" : scoped ? "readWrite för appdatabasen" : "behöver verifieras i Atlas"}.`);
  }
} catch (error) {
  const cause = error?.code === 18 ? "Autentisering misslyckades. Kontrollera databasanvändaren och lösenordet." : "Kontrollera Atlas IP-lista, nätverk och databasbehörighet.";
  console.error(`MongoDB kunde inte verifieras. ${cause} Inga anslutningsuppgifter visas.`);
  process.exitCode = 1;
} finally {
  await client?.close();
}
