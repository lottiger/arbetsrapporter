import "server-only";
import { randomUUID } from "node:crypto";
import { MongoServerError, type Db, type Filter, type MongoClient } from "mongodb";
import { allFields, evaluateAnswers, fillAutomaticTimes, type Answers, type Evaluation, type TemplateDefinition } from "../../domain/templates.ts";
import type { BillingStatus, ReportDetail, ReportEventType, ReportStatus, ReportSummary, ReportView } from "../../domain/reports.ts";
import type { AppAuth } from "../auth/factory.ts";
import { requireCompanyAccess } from "../companies/access.ts";
import type { TemplateDocument, TemplateVersionDocument } from "../templates/service.ts";

type Dependencies = { auth: AppAuth; client: MongoClient; db: Db };
type Report = {
  _id: string; organizationId: string; createdBy: string; authorName: string;
  templateId: string; templateVersionId: string; templateVersion: number; title: string;
  answers: Answers; automaticTimeFields?: string[]; status: ReportStatus; billingStatus: BillingStatus;
  completion?: { comment: string; actorId: string; actorName: string; at: Date; versionId: string; version: number } | null;
  approval?: { actorId: string; actorName: string; at: Date; versionId: string; version: number } | null;
  billingHandled?: { actorId: string; actorName: string; at: Date; versionId: string; version: number } | null;
  revision: number; submittedVersionId: string | null; createdAt: Date; updatedAt: Date;
};
type Version = {
  _id: string; organizationId: string; reportId: string; version: number;
  templateVersionId: string; definition: TemplateDefinition; answers: Answers; automaticTimeFields?: string[];
  submittedAt: Date; submittedBy: { id: string; name: string }; companyName: string;
  computed: Evaluation["computed"]; warnings: Evaluation["warnings"];
};
type Event = {
  _id: string; organizationId: string; reportId: string; revision: number;
  type: ReportEventType; actorId: string; actorName: string;
  createdAt: Date; versionId?: string; version?: number; comment?: string;
};

export class ReportError extends Error {
  readonly status: number;
  readonly evaluation?: Evaluation;
  constructor(status: number, message: string, evaluation?: Evaluation) {
    super(message);
    this.status = status;
    this.evaluation = evaluation;
  }
}
const conflict = () => new ReportError(409, "Rapporten har ändrats eller fått ett nytt beslut. Öppna den senaste sparade rapporten innan du fortsätter.");
const missing = () => new ReportError(404, "Rapporten finns inte eller är inte tillgänglig för dig.");
const invalid = () => new ReportError(400, "Ogiltiga rapportuppgifter.");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function input(value: unknown, keys: string[]) {
  const body = object(value);
  if (Object.keys(body).some((key) => !keys.includes(key))) throw invalid();
  return body;
}
function id(value: unknown) {
  if (typeof value !== "string" || !UUID.test(value)) throw invalid();
  return value;
}
function revision(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw invalid();
  return value;
}

/** Drafts may be incomplete. Types, field names and size limits apply on every write. */
function draftAnswers(definition: TemplateDefinition, value: unknown): Answers {
  const raw = object(value);
  const fields = new Map(allFields(definition).map((field) => [field.key, field]));
  const answers: Answers = {};
  for (const [key, answer] of Object.entries(raw)) {
    const field = fields.get(key);
    if (!field) throw invalid();
    if (field.type === "multiselect") {
      if (!Array.isArray(answer) || answer.length > (field.options?.length ?? 0) ||
        answer.some((item) => typeof item !== "string" || !field.options?.some((option) => option.value === item))) throw invalid();
      answers[key] = [...new Set(answer)] as string[];
    } else if (field.type === "yesno") {
      if (typeof answer !== "boolean" && answer !== "ja" && answer !== "nej" && answer !== "") throw invalid();
      answers[key] = answer;
    } else {
      if (typeof answer !== "string" || answer.length > (field.maxLength ?? (field.type === "textarea" ? 2000 : 200))) throw invalid();
      answers[key] = answer;
    }
  }
  return answers;
}

const indexes = new WeakMap<Db, Promise<void>>();
function automaticFields(definition: TemplateDefinition, value: unknown): string[] {
  if (value === undefined) return [];
  const allowed = definition.rules.flatMap((rule) => rule.type === "time_span" ? [rule.billableHoursField] : []);
  if (!Array.isArray(value) || value.length > allowed.length || value.some((key) => typeof key !== "string" || !allowed.includes(key))) throw invalid();
  return [...new Set(value)] as string[];
}

async function ensureIndexes(db: Db) {
  let ready = indexes.get(db);
  if (!ready) {
    ready = (async () => {
      await db.collection("reports").createIndex({ organizationId: 1, createdBy: 1, updatedAt: -1, _id: -1 });
      await db.collection("reports").createIndex({ organizationId: 1, status: 1, updatedAt: -1, _id: -1 });
      await db.collection("reportVersions").createIndex({ organizationId: 1, reportId: 1, version: 1 }, { unique: true });
      await db.collection("reportEvents").createIndex({ organizationId: 1, reportId: 1, revision: 1 }, { unique: true });
    })();
    indexes.set(db, ready);
  }
  try { await ready; } catch (error) { indexes.delete(db); throw error; }
}

async function scope(deps: Dependencies, headers: Headers, organizationId: string, view: ReportView) {
  const access = await requireCompanyAccess(deps.auth, deps.db, headers, organizationId, view === "billing" ? ["billing", "company_admin"] : [view === "review" ? "company_admin" : "reporter"]);
  const filter: Filter<Report> = { organizationId };
  if (view === "mine") filter.createdBy = access.user.id;
  else if (view === "billing") { filter.status = "approved"; filter.billingStatus = { $in: ["ready", "handled"] }; }
  else filter.status = { $in: ["submitted", "needs_completion", "approved"] };
  return { ...access, filter };
}
function summary(report: Report): ReportSummary {
  return {
    id: report._id, title: report.title, authorName: report.authorName, status: report.status, billingStatus: report.billingStatus,
    revision: report.revision, submittedVersionId: report.submittedVersionId,
    customer: typeof report.answers.kund === "string" ? report.answers.kund : "",
    date: typeof report.answers.datum === "string" ? report.answers.datum : "", updatedAt: report.updatedAt.toISOString(),
  };
}

export async function listReports(deps: Dependencies, headers: Headers, organizationId: string, view: ReportView, status = "all", page = 1) {
  const { filter } = await scope(deps, headers, organizationId, view);
  if (view === "billing") {
    if (!["all", "ready", "handled"].includes(status)) throw invalid();
    if (status !== "all") filter.billingStatus = status as BillingStatus;
  } else if (view === "review" && (status === "open" || status === "handled")) {
    filter.billingStatus = status === "open" ? { $ne: "handled" } : "handled";
    if (status === "handled") filter.status = "approved";
  } else if (status !== "all") {
    if (!["draft", "submitted", "needs_completion", "approved"].includes(status) || (view === "review" && status === "draft")) throw invalid();
    filter.status = status as ReportStatus;
  }
  if (!Number.isSafeInteger(page) || page < 1 || page > 999999) throw invalid();
  const collection = deps.db.collection<Report>("reports");
  const [reports, total] = await Promise.all([
    collection.find(filter, { projection: { _id: 1, title: 1, authorName: 1, status: 1, billingStatus: 1, revision: 1, submittedVersionId: 1, updatedAt: 1, "answers.kund": 1, "answers.datum": 1 } })
      .sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * 50).limit(50).toArray(),
    collection.countDocuments(filter),
  ]);
  // Reviewers see submitted values, including while the owner edits a completion.
  const versions = view === "mine" ? [] : await deps.db.collection<Version>("reportVersions").find({
    organizationId, _id: { $in: reports.flatMap((report) => report.submittedVersionId ? [report.submittedVersionId] : []) },
  }, { projection: { _id: 1, reportId: 1, answers: 1, submittedBy: 1 } }).toArray();
  return { reports: reports.map((report) => {
    const version = versions.find((version) => version._id === report.submittedVersionId && version.reportId === report._id);
    if (view !== "mine" && !version) throw missing();
    return summary(version ? { ...report, answers: version.answers, authorName: version.submittedBy.name } : report);
  }), total, page, hasMore: page * 50 < total };
}

export async function getReport(deps: Dependencies, headers: Headers, organizationId: string, reportId: string, view: ReportView, requestedVersion?: unknown): Promise<ReportDetail> {
  const { filter } = await scope(deps, headers, organizationId, view);
  const report = await deps.db.collection<Report>("reports").findOne({ ...filter, _id: reportId });
  if (!report) throw missing();
  const template = await deps.db.collection<TemplateVersionDocument>("templateVersions").findOne({ _id: report.templateVersionId, organizationId, templateId: report.templateId });
  if (!template) throw missing();
  const viewingVersion = requestedVersion !== undefined && requestedVersion !== null;
  if (viewingVersion && (typeof requestedVersion !== "string" || !/^[1-9]\d{0,5}$/.test(requestedVersion))) throw invalid();
  const version = viewingVersion ? await deps.db.collection<Version>("reportVersions").findOne({ organizationId, reportId, version: Number(requestedVersion) })
    : report.submittedVersionId ? await deps.db.collection<Version>("reportVersions").findOne({ _id: report.submittedVersionId, organizationId, reportId }) : null;
  if (viewingVersion && !version) throw missing();
  if (report.status !== "draft" && !version) throw missing();
  if (view === "billing" && (!report.approval || report.approval.versionId !== report.submittedVersionId || (version && version._id !== report.approval.versionId))) throw missing();
  const editing = view === "mine" && !viewingVersion && (report.status === "draft" || report.status === "needs_completion");
  const answers = editing ? report.answers : version?.answers ?? report.answers;
  const events = await deps.db.collection<Event>("reportEvents").find({ organizationId, reportId,
    ...(view === "billing" ? { type: { $in: ["approved", "billing_handled"] as ReportEventType[] }, versionId: report.approval!.versionId } : {}),
  }).sort({ revision: -1 }).limit(100).toArray();
  const versions = await deps.db.collection<Version>("reportVersions").find({ organizationId, reportId,
    ...(view === "billing" ? { _id: report.approval!.versionId } : {}),
  }, { projection: { _id: 1, version: 1, submittedAt: 1, submittedBy: 1 } }).sort({ version: -1 }).limit(100).toArray();
  return {
    ...summary({ ...report, answers }), organizationId, revision: report.revision, templateVersion: report.templateVersion,
    templateVersionId: report.templateVersionId, definition: version?.definition ?? template.definition,
    answers, billingStatus: report.billingStatus, viewingVersion,
    automaticTimeFields: editing ? report.automaticTimeFields : version?.automaticTimeFields ?? report.automaticTimeFields,
    completion: report.completion ? { comment: report.completion.comment, actorName: report.completion.actorName, at: report.completion.at.toISOString(), version: report.completion.version } : null,
    approval: report.approval ? { actorName: report.approval.actorName, at: report.approval.at.toISOString(), version: report.approval.version, versionId: report.approval.versionId } : null,
    billingHandled: report.billingHandled ? { actorName: report.billingHandled.actorName, at: report.billingHandled.at.toISOString(), version: report.billingHandled.version, versionId: report.billingHandled.versionId } : null,
    versions: versions.map((version) => ({ id: version._id, version: version.version, submittedAt: version.submittedAt.toISOString(), submittedBy: version.submittedBy.name })),
    submission: version ? { id: version._id, version: version.version, submittedAt: version.submittedAt.toISOString(), submittedBy: version.submittedBy,
      companyName: version.companyName, computed: version.computed, warnings: version.warnings } : null,
    events: events.map((event) => ({ id: event._id, type: event.type, actorName: event.actorName, at: event.createdAt.toISOString(), comment: event.comment, version: event.version })),
  };
}

export async function createReport(deps: Dependencies, headers: Headers, organizationId: string, value: unknown, submit = false) {
  const { user, company } = await scope(deps, headers, organizationId, "mine");
  const body = input(value, ["id", "templateVersionId", "answers", "automaticTimeFields"]);
  const reportId = id(body.id);
  const templateVersionId = id(body.templateVersionId);
  const reports = deps.db.collection<Report>("reports");
  const existing = await reports.findOne({ _id: reportId, organizationId, createdBy: user.id });
  // The client keeps this ID across retries. A repeated create never overwrites saved work.
  if (existing) {
    if (existing.templateVersionId !== templateVersionId) throw conflict();
    return { id: existing._id, revision: existing.revision, status: existing.status, created: false };
  }
  const template = await deps.db.collection<TemplateVersionDocument>("templateVersions").findOne({ _id: templateVersionId, organizationId });
  if (!template || !await deps.db.collection<TemplateDocument>("templates").findOne({ _id: template.templateId, organizationId, publishedVersionId: templateVersionId })) {
    throw new ReportError(409, "Mallen har ändrats eller är inte tillgänglig. Öppna Ny rapport igen.");
  }
  const automaticTimeFields = automaticFields(template.definition, body.automaticTimeFields);
  const raw = fillAutomaticTimes(template.definition, draftAnswers(template.definition, body.answers), automaticTimeFields);
  const evaluation = evaluateAnswers(template.definition, raw);
  if (submit && evaluation.errors.length) throw new ReportError(422, "Kontrollera uppgifterna innan rapporten skickas in.", evaluation);
  const answers = submit ? evaluation.answers : raw;
  const status: ReportStatus = submit ? "submitted" : "draft";
  const versionId = submit ? randomUUID() : null;
  await ensureIndexes(deps.db);
  const now = new Date();
  const session = deps.client.startSession();
  try {
    await session.withTransaction(async () => {
      await reports.insertOne({ _id: reportId, organizationId, createdBy: user.id, authorName: user.name,
        templateId: template.templateId, templateVersionId, templateVersion: template.version, title: template.definition.title,
        answers, automaticTimeFields, status, billingStatus: "not_ready", revision: 1, submittedVersionId: versionId, createdAt: now, updatedAt: now,
      }, { session });
      if (versionId) {
        await deps.db.collection<Version>("reportVersions").insertOne({ _id: versionId, organizationId, reportId, version: 1,
          templateVersionId, definition: template.definition, answers, automaticTimeFields, submittedAt: now,
          submittedBy: { id: user.id, name: user.name }, companyName: company.name,
          computed: evaluation.computed, warnings: evaluation.warnings,
        }, { session });
      }
      await deps.db.collection<Event>("reportEvents").insertOne({ _id: randomUUID(), organizationId, reportId, revision: 1,
        type: submit ? "submitted" : "draft_created", actorId: user.id, actorName: user.name, createdAt: now,
        ...(versionId ? { versionId, version: 1 } : {}),
      }, { session });
    });
  } catch (error) {
    if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
    const repeated = await reports.findOne({ _id: reportId, organizationId, createdBy: user.id, templateVersionId });
    if (!repeated) throw conflict();
    return { id: repeated._id, revision: repeated.revision, status: repeated.status, created: false };
  } finally { await session.endSession(); }
  return { id: reportId, revision: 1, status, created: true };
}

export async function changeDraft(deps: Dependencies, headers: Headers, organizationId: string, reportId: string, value: unknown, submit: boolean) {
  const { user, company, filter } = await scope(deps, headers, organizationId, "mine");
  const body = input(value, ["revision", "answers", "automaticTimeFields"]);
  const expected = revision(body.revision);
  await ensureIndexes(deps.db);
  const session = deps.client.startSession();
  let nextStatus: ReportStatus = "draft";
  try {
    await session.withTransaction(async () => {
      const reports = deps.db.collection<Report>("reports");
      const report = await reports.findOne({ ...filter, _id: reportId }, { session });
      if (!report) throw missing();
      if (!["draft", "needs_completion"].includes(report.status) || report.revision !== expected) throw conflict();
      const template = await deps.db.collection<TemplateVersionDocument>("templateVersions").findOne({ _id: report.templateVersionId, organizationId, templateId: report.templateId }, { session });
      if (!template) throw missing();
      const automaticTimeFields = automaticFields(template.definition, body.automaticTimeFields === undefined ? report.automaticTimeFields : body.automaticTimeFields);
      const raw = fillAutomaticTimes(template.definition, draftAnswers(template.definition, body.answers), automaticTimeFields);
      const evaluation = evaluateAnswers(template.definition, raw);
      if (submit && evaluation.errors.length) throw new ReportError(422, "Kontrollera uppgifterna innan rapporten skickas in.", evaluation);
      const answers = submit ? evaluation.answers : raw;
      const now = new Date();
      const versionId = submit ? randomUUID() : null;
      const previous = submit && report.submittedVersionId ? await deps.db.collection<Version>("reportVersions").findOne({ _id: report.submittedVersionId, organizationId, reportId }, { session }) : null;
      if (submit && report.submittedVersionId && !previous) throw missing();
      const versionNumber = (previous?.version ?? 0) + 1;
      nextStatus = submit ? "submitted" : report.status;
      const changed = await reports.updateOne({ ...filter, _id: reportId, status: report.status, revision: expected }, {
        $set: { answers, automaticTimeFields, updatedAt: now, ...(submit ? { status: nextStatus, submittedVersionId: versionId, authorName: user.name, completion: null } : {}) },
        $inc: { revision: 1 },
      }, { session });
      if (changed.modifiedCount !== 1) throw conflict();
      if (submit && versionId) {
        await deps.db.collection<Version>("reportVersions").insertOne({ _id: versionId, organizationId, reportId, version: versionNumber,
          templateVersionId: template._id, definition: template.definition, answers, automaticTimeFields, submittedAt: now,
          submittedBy: { id: user.id, name: user.name }, companyName: company.name,
          computed: evaluation.computed, warnings: evaluation.warnings,
        }, { session });
      }
      await deps.db.collection<Event>("reportEvents").insertOne({ _id: randomUUID(), organizationId, reportId, revision: expected + 1,
        type: submit ? "submitted" : report.status === "needs_completion" ? "completion_saved" : "draft_saved", actorId: user.id, actorName: user.name, createdAt: now,
        ...(versionId ? { versionId, version: versionNumber } : {}),
      }, { session });
    });
  } finally { await session.endSession(); }
  return { id: reportId, revision: expected + 1, status: nextStatus };
}

export async function reviewReport(deps: Dependencies, headers: Headers, organizationId: string, reportId: string, value: unknown) {
  const { user, filter } = await scope(deps, headers, organizationId, "review");
  const body = input(value, ["action", "revision", "versionId", "comment"]);
  if (body.action !== "request_completion" && body.action !== "approve") throw invalid();
  const approve = body.action === "approve";
  const expected = revision(body.revision);
  const versionId = id(body.versionId);
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!approve && (!comment || comment.length > 2000)) throw new ReportError(400, "Skriv vad som behöver kompletteras, högst 2000 tecken.");
  if (approve && body.comment !== undefined) throw invalid();
  await ensureIndexes(deps.db);
  const session = deps.client.startSession();
  try {
    await session.withTransaction(async () => {
      const reports = deps.db.collection<Report>("reports");
      const report = await reports.findOne({ ...filter, _id: reportId }, { session });
      if (!report) throw missing();
      if (report.status !== "submitted" || report.revision !== expected || report.submittedVersionId !== versionId) throw conflict();
      const version = await deps.db.collection<Version>("reportVersions").findOne({ _id: versionId, reportId, organizationId }, { session });
      if (!version) throw missing();
      const now = new Date();
      const decision = { actorId: user.id, actorName: user.name, at: now, versionId, version: version.version };
      // Company admins may approve their own submitted reports; identity still comes from the session.
      const changed = await reports.updateOne({ ...filter, _id: reportId, status: "submitted", revision: expected, submittedVersionId: versionId }, {
        $set: { updatedAt: now, answers: version.answers, automaticTimeFields: version.automaticTimeFields ?? [],
          ...(approve ? { status: "approved" as const, billingStatus: "ready" as const, approval: decision, completion: null }
            : { status: "needs_completion" as const, billingStatus: "not_ready" as const, completion: { ...decision, comment } }),
        }, $inc: { revision: 1 },
      }, { session });
      if (changed.modifiedCount !== 1) throw conflict();
      await deps.db.collection<Event>("reportEvents").insertOne({ _id: randomUUID(), organizationId, reportId,
        revision: expected + 1, type: approve ? "approved" : "completion_requested", actorId: user.id, actorName: user.name,
        createdAt: now, versionId, version: version.version, ...(!approve ? { comment } : {}),
      }, { session });
    });
  } finally { await session.endSession(); }
  return { id: reportId, revision: expected + 1, status: approve ? "approved" : "needs_completion" };
}

export async function markBillingHandled(deps: Dependencies, headers: Headers, organizationId: string, reportId: string, value: unknown) {
  const { user, filter } = await scope(deps, headers, organizationId, "billing");
  const body = input(value, ["revision", "versionId", "confirmed"]);
  if (body.confirmed !== true) throw new ReportError(400, "Bekräfta att rapporten är administrerad i bokföringssystemet.");
  const expected = revision(body.revision);
  const versionId = id(body.versionId);
  await ensureIndexes(deps.db);
  const session = deps.client.startSession();
  try {
    await session.withTransaction(async () => {
      const reports = deps.db.collection<Report>("reports");
      const report = await reports.findOne({ ...filter, _id: reportId }, { session });
      if (!report) throw missing();
      if (report.billingStatus !== "ready" || report.revision !== expected || report.submittedVersionId !== versionId || report.approval?.versionId !== versionId) throw conflict();
      const version = await deps.db.collection<Version>("reportVersions").findOne({ _id: versionId, organizationId, reportId }, { session });
      if (!version) throw missing();
      const now = new Date();
      const changed = await reports.updateOne({ ...filter, _id: reportId, billingStatus: "ready", revision: expected,
        submittedVersionId: versionId, "approval.versionId": versionId,
      }, {
        $set: { billingStatus: "handled", updatedAt: now,
          billingHandled: { actorId: user.id, actorName: user.name, at: now, versionId, version: version.version },
        }, $inc: { revision: 1 },
      }, { session });
      if (changed.modifiedCount !== 1) throw conflict();
      await deps.db.collection<Event>("reportEvents").insertOne({ _id: randomUUID(), organizationId, reportId,
        revision: expected + 1, type: "billing_handled", actorId: user.id, actorName: user.name,
        createdAt: now, versionId, version: version.version,
      }, { session });
    });
  } finally { await session.endSession(); }
  return { id: reportId, revision: expected + 1, status: "approved", billingStatus: "handled" };
}
