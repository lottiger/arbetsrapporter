import { createReport, listReports } from "@/server/reports/service";
import { reportBody, reportDependencies, reportFailure, reportJSON, reportView } from "@/server/reports/http";
import { reportPage } from "@/domain/reports";

export const runtime = "nodejs";
export async function GET(request: Request, context: RouteContext<"/api/foretag/[id]/rapporter">) {
  try {
    const query = new URL(request.url).searchParams;
    return reportJSON(await listReports(reportDependencies(), request.headers, (await context.params).id,
      reportView(request), query.get("status") ?? "all", reportPage(query.get("page"))));
  } catch (error) { return reportFailure(error); }
}
export async function POST(request: Request, context: RouteContext<"/api/foretag/[id]/rapporter">) {
  try {
    const body = await reportBody(request);
    return reportJSON(await createReport(reportDependencies(), request.headers, (await context.params).id, body), 201);
  } catch (error) { return reportFailure(error); }
}
