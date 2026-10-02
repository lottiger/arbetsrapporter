import { createLocalEnv } from "./local-config.mjs";

try {
  const result = await createLocalEnv(new URL("../.env.local", import.meta.url));
  console.log(result === "created"
    ? ".env.local skapad med en slumpgenererad authnyckel. Atlas-adressen är ännu tom. Ingen anslutning har gjorts."
    : ".env.local finns redan och har lämnats oförändrad.");
} catch {
  console.error("Kunde inte skapa .env.local. Kontrollera skrivrättigheterna i projektmappen.");
  process.exitCode = 1;
}
