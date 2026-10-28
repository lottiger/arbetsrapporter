import { changeDraft, getReport } from "@/server/reports/service";
import { reportBody, reportDependencies, reportFailure, reportJSON, reportView } from "@/server/reports/http";

export const runtime = "nodejs";
export async function GET(request: Request, context: RouteContext<"/api/foretag/[id]/rapporter/[reportId]">) {
  try {
    const { id, reportId } = await context.params;
    return reportJSON(await getReport(reportDependencies(), request.headers, id, reportId,
      reportView(request), new URL(request.url).searchParams.get("version")));
  } catch (error) { return reportFailure(error); }
}
export async function PATCH(request: Request, context: RouteContext<"/api/foretag/[id]/rapporter/[reportId]">) {
  try {
    const { id, reportId } = await context.params;
    const body = await reportBody(request);
    return reportJSON(await changeDraft(reportDependencies(), request.headers, id, reportId, body, false));
  } catch (error) { return reportFailure(error); }
}
