import "server-only";
import { getDatabase } from "../db.ts";
import { createAuth, type AppAuth } from "./factory.ts";

let savedAuth: AppAuth | undefined;

export function getAuth() {
  if (!savedAuth) {
    const { client, db, config } = getDatabase();
    savedAuth = createAuth(client, db, config);
  }
  return savedAuth;
}
