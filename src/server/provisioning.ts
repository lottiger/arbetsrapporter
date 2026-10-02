import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins/admin";
import type { Db, MongoClient } from "mongodb";
import type { ServerConfig } from "./config.ts";
import { authOptions } from "./auth/factory.ts";
import { ensureCompanyIndexes } from "./db.ts";
import type { Membership, Organization } from "./companies/access.ts";

// Invoked only from the local operator script, never mounted as a web endpoint.
export async function provisionCompany(
  client: MongoClient, db: Db, config: ServerConfig,
  input: { company: string; name: string; email: string; password: string },
) {
  const companyName = input.company.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (companyName.length < 2 || companyName.length > 120 || !name || name.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.password.length < 12 || input.password.length > 128) {
    throw new Error("Kontrollera företagsnamn, namn och e-post. Lösenordet ska ha 12–128 tecken.");
  }
  await ensureCompanyIndexes(db);
  if (await db.collection("user").findOne({ email })) {
    throw new Error("E-postadressen har redan ett konto. Befintliga konton ändras inte av kommandot.");
  }
  if (await db.collection<Organization>("organizations").findOne({ name: companyName })) {
    throw new Error("Företagsnamnet finns redan. Inga nya konton har skapats.");
  }
  const provisioningAuth = betterAuth({ ...authOptions(client, db, config), plugins: [admin()] });
  const { user } = await provisioningAuth.api.createUser({ body: { email, name, password: input.password, role: "user" } });
  const organizationId = randomUUID();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      await db.collection<Organization>("organizations").insertOne({
        _id: organizationId, name: companyName, status: "active", createdAt: now,
      }, { session });
      await db.collection<Membership>("memberships").insertOne({
        _id: randomUUID(), organizationId, userId: user.id,
        roles: ["reporter", "company_admin", "billing"], status: "active", createdAt: now,
      }, { session });
      await db.collection("organizationEvents").insertOne({
        organizationId, userId: user.id, type: "company_created", createdAt: now,
      }, { session });
    });
    return { organizationId, userId: user.id };
  } catch {
    // Only undo the account just created by this invocation. Existing accounts are untouched.
    await db.collection("account").deleteMany({ userId: user.id });
    await db.collection<{ _id: string }>("user").deleteOne({ _id: user.id });
    throw new Error("Företaget kunde inte skapas. Kontrollera databasens behörighet och försök igen.");
  } finally {
    await session.endSession();
  }
}
