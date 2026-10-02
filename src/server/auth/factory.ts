import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import type { Db, MongoClient } from "mongodb";
import type { ServerConfig } from "../config.ts";

export function authOptions(client: MongoClient, db: Db, config: ServerConfig) {
  return {
    appName: "Arbetsrapporter",
    baseURL: config.baseURL,
    secret: config.authSecret,
    trustedOrigins: [config.baseURL],
    database: mongodbAdapter(db, { client, transaction: true }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 10 } },
    },
    advanced: {
      database: { generateId: () => randomUUID() },
      cookiePrefix: "arbetsrapporter",
      useSecureCookies: config.baseURL.startsWith("https://"),
    },
    // Application boundaries return safe errors; don't log DB errors with credentials.
    logger: { disabled: true },
  } satisfies BetterAuthOptions;
}

export function createAuth(client: MongoClient, db: Db, config: ServerConfig) {
  return betterAuth(authOptions(client, db, config));
}

export type AppAuth = ReturnType<typeof createAuth>;
