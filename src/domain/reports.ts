import type { Answers, Evaluation, TemplateDefinition } from "./templates.ts";

export const reportStatusLabels = {
  draft: "Utkast", submitted: "Inskickad", needs_completion: "Att komplettera", approved: "Godkänd",
} as const;
export type ReportStatus = keyof typeof reportStatusLabels;
export type ReportView = "mine" | "review" | "billing";
export type ReportEventType = "draft_created" | "draft_saved" | "submitted" | "completion_requested" | "completion_saved" | "approved" | "billing_handled";
export type BillingStatus = "not_ready" | "ready" | "handled";
export type ReportSummary = {
  id: string; title: string; customer: string; date: string; authorName: string;
  status: ReportStatus; billingStatus: BillingStatus; updatedAt: string;
  revision: number; submittedVersionId: string | null;
};
export type ReportDetail = ReportSummary & {
  organizationId: string; revision: number; templateVersion: number; templateVersionId: string;
  definition: TemplateDefinition; answers: Answers; automaticTimeFields?: string[];
  viewingVersion: boolean;
  completion: null | { comment: string; actorName: string; at: string; version: number };
  approval: null | { actorName: string; at: string; versionId: string; version: number };
  billingHandled: null | { actorName: string; at: string; versionId: string; version: number };
  versions: { id: string; version: number; submittedAt: string; submittedBy: string }[];
  submission: null | {
    id: string; version: number; submittedAt: string; submittedBy: { id: string; name: string };
    companyName: string; computed: Evaluation["computed"]; warnings: Evaluation["warnings"];
  };
  events: { id: string; type: ReportEventType; actorName: string; at: string; comment?: string; version?: number }[];
};

export function reportPage(value: unknown) {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}
