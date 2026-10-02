import { getAuth } from "@/server/auth";
import { handleAuthRequest } from "@/server/auth/http";

export const runtime = "nodejs";

async function handle(request: Request) {
  try {
    return await handleAuthRequest(getAuth(), request);
  } catch {
    return Response.json({ message: "Inloggningstjänsten kunde inte nås. Försök igen om en stund." }, { status: 503 });
  }
}

export const GET = handle;
export const POST = handle;
