import { fileURLToPath } from "node:url";
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import nextEnv from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { getDatabase } from "../src/server/db.ts";

// Local operator command only. Never expose this operation as a web endpoint.
if (!process.stdin.isTTY || process.argv.length > 2) {
  console.error("Kör npm.cmd run account:reset-password i en interaktiv terminal utan argument.");
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
    const db = connection.db;
    const email = (await prompt.question("Kontots e-postadress: ")).trim().toLowerCase();
    const user = await db.collection("user").findOne({ email });
    if (!user) throw new Error("missing user");
    console.log(`Byter lösenord för ${email} och avslutar kontots gamla inloggningar.`);
    process.stdout.write("Nytt lösenord (6–128 tecken, visas inte): ");
    muted = true;
    const password = await prompt.question("");
    muted = false;
    process.stdout.write("\nUpprepa lösenordet (visas inte): ");
    muted = true;
    const confirmation = await prompt.question("");
    muted = false;
    process.stdout.write("\n");
    if (password.length < 6 || password.length > 128 || password !== confirmation) {
      console.error("Lösenorden måste vara lika och ha 6–128 tecken. Inget har ändrats.");
      process.exitCode = 1;
    } else {
      const hash = await hashPassword(password);
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          const filter = { userId: user._id, providerId: "credential" };
          if (await db.collection("account").countDocuments(filter, { session }) !== 1) {
            throw new Error("expected one password account");
          }
          const result = await db.collection("account").updateOne(filter,
            { $set: { password: hash, updatedAt: new Date() } }, { session });
          if (result.matchedCount !== 1) throw new Error("account missing");
          await db.collection("session").deleteMany({ userId: user._id }, { session });
        });
      } finally {
        await session.endSession();
      }
      console.log("Lösenordet är ändrat. Logga in med ditt nya lösenord. Företag, behörigheter och rapporter är oförändrade.");
    }
  } catch {
    console.error("Lösenordsbytet kunde inte bekräftas. Kontrollera e-postadressen och databasanslutningen. Vid ett anslutningsavbrott, prova att logga in med det nya lösenordet.");
    process.exitCode = 1;
  } finally {
    muted = false;
    prompt.close();
    await client?.close();
  }
}
