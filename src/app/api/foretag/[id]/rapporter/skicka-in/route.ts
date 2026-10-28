import { createReport } from "@/server/reports/service";
import { reportBody, reportDependencies, reportFailure, reportJSON } from "@/server/reports/http";

export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/foretag/[id]/rapporter/skicka-in">) {
  try {
    const body = await reportBody(request);
    return reportJSON(await createReport(reportDependencies(), request.headers, (await context.params).id, body, true), 201);
  } catch (error) { return reportFailure(error); }
}
