import "server-only";
import { MongoClient, type Db } from "mongodb";
import { readServerConfig } from "./config.ts";

const globalDatabase = globalThis as typeof globalThis & {
  arbetsrapporterMongo?: { uri: string; client: MongoClient };
};

export function getDatabase() {
  const config = readServerConfig();
  const saved = globalDatabase.arbetsrapporterMongo;
  if (!saved || saved.uri !== config.mongoUri) {
    globalDatabase.arbetsrapporterMongo = {
      uri: config.mongoUri,
      client: new MongoClient(config.mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        timeoutMS: 15000,
        maxPoolSize: 10,
      }),
    };
  }
  const { client } = globalDatabase.arbetsrapporterMongo!;
  return { client, db: client.db(config.databaseName), config };
}

export async function ensureCompanyIndexes(db: Db) {
  await db.collection("memberships").createIndex(
    { organizationId: 1, userId: 1 },
    { unique: true, name: "membership_company_user" },
  );
  await db.collection("memberships").createIndex(
    { userId: 1, status: 1 }, { name: "membership_user_status" },
  );
  await db.collection("organizationEvents").createIndex(
    { organizationId: 1, createdAt: -1 }, { name: "company_event_history" },
  );
}
