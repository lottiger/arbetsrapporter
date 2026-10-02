import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { AccessError } from "@/server/companies/access";
import { getCompany, renameCompany } from "@/server/companies/service";

export const runtime = "nodejs";

function failure(error: unknown) {
  return Response.json({ message: error instanceof AccessError ? error.message : "Företagsuppgifterna kunde inte hämtas eller sparas." }, {
    status: error instanceof AccessError ? error.status : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request, context: RouteContext<"/api/foretag/[id]">) {
  try {
    const { id } = await context.params;
    return Response.json(await getCompany(getAuth(), getDatabase().db, request.headers, id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: RouteContext<"/api/foretag/[id]">) {
  try {
    const { client, db, config } = getDatabase();
    if (request.headers.get("origin") !== config.baseURL) throw new AccessError(403);
    let body;
    try { body = await request.json(); } catch {
      return Response.json({ message: "Ogiltiga uppgifter." }, { status: 400 });
    }
    const result = await renameCompany(getAuth(), client, db, request.headers, (await context.params).id, body?.name);
    return Response.json(result, { status: "error" in result ? 400 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
