import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

/** Create only; rerunning setup must never rotate a key or overwrite credentials. */
export async function createLocalEnv(file) {
  const content = [
    "# Lokal utveckling. Denna fil ignoreras av Git.",
    "# Klistra in Atlas-adressen på MONGODB_URI när konfigurationen gåtts igenom.",
    'MONGODB_URI=""',
    "MONGODB_DB=arbetsrapporter_dev",
    `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}`,
    "BETTER_AUTH_URL=http://localhost:3000",
    "",
  ].join("\n");

  try {
    await writeFile(file, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return "created";
  } catch (error) {
    if (error.code === "EEXIST") return "exists";
    throw error;
  }
}

/** Validate locally. Do not connect or include supplied values in diagnostics. */
export function configIssues(env) {
  const issues = [];
  const uri = env.MONGODB_URI?.trim();
  const database = env.MONGODB_DB?.trim();
  const secret = env.BETTER_AUTH_SECRET?.trim();
  const authUrl = env.BETTER_AUTH_URL?.trim();

  if (!uri) {
    issues.push("MONGODB_URI saknas. Fyll i Atlas-adressen i .env.local.");
  } else {
    try {
      const parsed = new URL(uri);
      if (
        parsed.protocol !== "mongodb+srv:" ||
        !parsed.hostname.endsWith(".mongodb.net") ||
        !parsed.username ||
        !parsed.password ||
        /[<>\s]/.test(uri) ||
        /%3c|%3e/i.test(uri)
      ) {
        throw new Error("Invalid Atlas URI");
      }
      // Construction parses options but does not open a network connection.
      const client = new MongoClient(uri);
      if (
        !client.options.tls ||
        client.options.tlsInsecure ||
        client.options.rejectUnauthorized === false ||
        client.options.checkServerIdentity !== undefined
      ) {
        throw new Error("Invalid TLS configuration");
      }
    } catch {
      issues.push("MONGODB_URI behöver kontrolleras: använd Atlas SRV-adress med databasens användarnamn och lösenord, utan platshållare eller avstängd TLS-kontroll.");
    }
  }

  if (!database || !/^[A-Za-z0-9_-]+$/.test(database) || /^(admin|local|config)$/i.test(database)) {
    issues.push("MONGODB_DB ska vara appens databasnamn, exempelvis arbetsrapporter_dev.");
  }

  if (!secret || secret.length < 32 || /[<>\s]/.test(secret)) {
    issues.push("BETTER_AUTH_SECRET saknas eller är för kort. Använd en slumpgenererad nyckel med minst 32 tecken.");
  }

  try {
    const parsed = new URL(authUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      !(parsed.protocol === "https:" || (local && parsed.protocol === "http:")) ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      parsed.pathname !== "/"
    ) {
      throw new Error("Invalid auth origin");
    }
  } catch {
    issues.push("BETTER_AUTH_URL ska vara appens basadress, lokalt http://localhost:3000, utan extra sökväg.");
  }

  return issues;
}
