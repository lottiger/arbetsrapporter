import { markBillingHandled } from "@/server/reports/service";
import { reportBody, reportDependencies, reportFailure, reportJSON } from "@/server/reports/http";

export const runtime = "nodejs";
export async function POST(request: Request, context: RouteContext<"/api/foretag/[id]/rapporter/[reportId]/klarmarkera">) {
  try {
    const { id, reportId } = await context.params;
    const body = await reportBody(request);
    return reportJSON(await markBillingHandled(reportDependencies(), request.headers, id, reportId, body));
  } catch (error) { return reportFailure(error); }
}
