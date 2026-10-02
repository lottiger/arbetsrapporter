import "server-only";
import { configIssues } from "../../scripts/local-config.mjs";

export type ServerConfig = {
  mongoUri: string;
  databaseName: string;
  authSecret: string;
  baseURL: string;
};

export function readServerConfig(): ServerConfig {
  if (configIssues(process.env).length) {
    throw new Error("Serverkonfigurationen är inte klar. Kör npm run config:check lokalt.");
  }
  return {
    mongoUri: process.env.MONGODB_URI!.trim(),
    databaseName: process.env.MONGODB_DB!.trim(),
    authSecret: process.env.BETTER_AUTH_SECRET!.trim(),
    baseURL: new URL(process.env.BETTER_AUTH_URL!.trim()).origin,
  };
}
