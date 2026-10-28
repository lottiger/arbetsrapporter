import "server-only";
import { getAuth } from "../auth/index.ts";
import { getDatabase } from "../db.ts";
import { AccessError } from "../companies/access.ts";
import { ReportError } from "./service.ts";

export function reportDependencies() { return { ...getDatabase(), auth: getAuth() }; }
export function reportView(request: Request) {
  const value = new URL(request.url).searchParams.get("view");
  return value === "review" || value === "billing" ? value : "mine";
}
export function reportJSON(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function reportFailure(error: unknown) {
  const known = error instanceof AccessError || error instanceof ReportError;
  return reportJSON({ message: known ? error.message : "Rapporten kunde inte hämtas eller sparas. Försök igen om en stund.",
    ...(error instanceof ReportError && error.evaluation ? { evaluation: error.evaluation } : {}),
  }, known ? error.status : 503);
}
export async function reportBody(request: Request) {
  if (request.headers.get("origin") !== getDatabase().config.baseURL) throw new AccessError(403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ReportError(415, "Uppgifterna måste skickas som JSON.");
  // Count actual bytes too: Content-Length may be absent or incorrect.
  const reader = request.body?.getReader();
  if (!reader) throw new ReportError(400, "Uppgifter saknas.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 128 * 1024) { await reader.cancel(); throw new ReportError(413, "Rapporten innehåller för mycket text."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new ReportError(400, "Ogiltiga uppgifter."); }
}
