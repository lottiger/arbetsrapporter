import "server-only";
import { randomUUID } from "node:crypto";
import type { Db, MongoClient } from "mongodb";
import type { AppAuth } from "../auth/factory.ts";
import { requireCompanyAccess, type Organization } from "./access.ts";

export async function getCompany(auth: AppAuth, db: Db, headers: Headers, id: string) {
  const { company } = await requireCompanyAccess(auth, db, headers, id);
  return { id: company._id, name: company.name };
}

export async function renameCompany(auth: AppAuth, client: MongoClient, db: Db, headers: Headers, id: string, name: unknown) {
  const { user } = await requireCompanyAccess(auth, db, headers, id, ["company_admin"]);
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
    return { error: "Företagsnamnet ska innehålla 2–120 tecken." } as const;
  }
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const previous = await db.collection<Organization>("organizations").findOneAndUpdate(
        { _id: id, status: "active" }, { $set: { name: name.trim() } },
        { session, returnDocument: "before" },
      );
      if (!previous) throw new Error("Företaget kunde inte uppdateras.");
      await db.collection("organizationEvents").insertOne({
        eventId: randomUUID(), organizationId: id, userId: user.id,
        type: "name_changed", previousName: previous.name, name: name.trim(), createdAt: new Date(),
      }, { session });
    });
    return { id, name: name.trim() };
  } finally {
    await session.endSession();
  }
}
