import "server-only";
import type { AppAuth } from "./factory.ts";

const allowedPaths = new Set(["/sign-in/email", "/sign-out", "/get-session"]);

export async function handleAuthRequest(auth: AppAuth, request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (!allowedPaths.has(path)) {
    return Response.json({ message: "Funktionen är inte tillgänglig." }, { status: 404 });
  }
  return auth.handler(request);
}
