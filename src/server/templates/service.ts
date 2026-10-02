import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Db, MongoClient } from "mongodb";
import { templateDefinitionIssues, allFields, type TemplateDefinition } from "../../domain/templates.ts";
import { builtInTemplates } from "../../domain/templates/index.ts";
import type { Organization } from "../companies/access.ts";

export type TemplateDocument = {
  _id: string;
  organizationId: string;
  key: string;
  title: string;
  publishedVersionId: string;
  publishedVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TemplateVersionDocument = {
  _id: string;
  organizationId: string;
  templateId: string;
  version: number;
  definition: TemplateDefinition;
  checksum: string;
  publishedAt: Date;
  publishedBy: string | null;
};

export type PublishResult = { key: string; title: string; version: number; action: "created" | "updated" | "unchanged" };

export async function ensureTemplateIndexes(db: Db) {
  await db.collection("templates").createIndex({ organizationId: 1, key: 1 }, { unique: true, name: "template_company_key" });
  await db.collection("templateVersions").createIndex(
    { organizationId: 1, templateId: 1, version: 1 },
    { unique: true, name: "template_version_company_template_version" },
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function templateChecksum(definition: TemplateDefinition) {
  return createHash("sha256").update(stableStringify(definition)).digest("hex");
}

/**
 * Publicerar de inbyggda mallarna för ett företag. En ändrad definition blir en ny version;
 * publicerade versioner ändras aldrig. Oförändrade mallar lämnas orörda.
 */
export async function publishBuiltInTemplates(client: MongoClient, db: Db, organizationId: string, publishedBy: string | null) {
  const company = await db.collection<Organization>("organizations").findOne({ _id: organizationId, status: "active" });
  if (!company) throw new Error("Företaget finns inte eller är inte aktivt.");
  for (const definition of builtInTemplates) {
    const issues = templateDefinitionIssues(definition);
    if (issues.length) throw new Error(`Malldefinitionen "${definition.key}" är inte giltig: ${issues.join(" ")}`);
  }
  await ensureTemplateIndexes(db);
  const results: PublishResult[] = [];
  const templates = db.collection<TemplateDocument>("templates");
  const versions = db.collection<TemplateVersionDocument>("templateVersions");
  for (const definition of builtInTemplates) {
    const checksum = templateChecksum(definition);
    const existing = await templates.findOne({ organizationId, key: definition.key });
    const current = existing ? await versions.findOne({ _id: existing.publishedVersionId, organizationId }) : null;
    if (existing && current?.checksum === checksum) {
      results.push({ key: definition.key, title: definition.title, version: existing.publishedVersion, action: "unchanged" });
      continue;
    }
    const now = new Date();
    const templateId = existing?._id ?? randomUUID();
    const version = (existing?.publishedVersion ?? 0) + 1;
    const versionId = randomUUID();
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await versions.insertOne({
          _id: versionId, organizationId, templateId, version, definition, checksum, publishedAt: now, publishedBy,
        }, { session });
        if (existing) {
          await templates.updateOne(
            { _id: templateId, organizationId, publishedVersion: existing.publishedVersion },
            { $set: { title: definition.title, publishedVersionId: versionId, publishedVersion: version, updatedAt: now } },
            { session },
          );
        } else {
          await templates.insertOne({
            _id: templateId, organizationId, key: definition.key, title: definition.title,
            publishedVersionId: versionId, publishedVersion: version, createdAt: now, updatedAt: now,
          }, { session });
        }
        await db.collection("organizationEvents").insertOne({
          eventId: randomUUID(), organizationId, userId: publishedBy, type: "template_published",
          templateId, templateKey: definition.key, version, createdAt: now,
        }, { session });
      });
    } finally {
      await session.endSession();
    }
    results.push({ key: definition.key, title: definition.title, version, action: existing ? "updated" : "created" });
  }
  return results;
}

export type TemplateSummary = {
  key: string;
  title: string;
  description: string;
  source: string;
  version: number;
  publishedAt: Date;
  fieldCount: number;
  requiredCount: number;
};

/** Företagets publicerade mallar. Anropas bara med ett företags-ID som redan verifierats mot medlemskap. */
export async function listTemplates(db: Db, organizationId: string): Promise<TemplateSummary[]> {
  const templates = await db.collection<TemplateDocument>("templates").find({ organizationId }).sort({ title: 1 }).toArray();
  if (!templates.length) return [];
  const versions = await db.collection<TemplateVersionDocument>("templateVersions").find({
    organizationId, _id: { $in: templates.map((template) => template.publishedVersionId) },
  }).toArray();
  return templates.flatMap((template) => {
    const version = versions.find((candidate) => candidate._id === template.publishedVersionId);
    if (!version) return [];
    const fields = allFields(version.definition);
    return [{
      key: template.key,
      title: version.definition.title,
      description: version.definition.description,
      source: version.definition.source,
      version: version.version,
      publishedAt: version.publishedAt,
      fieldCount: fields.length,
      requiredCount: fields.filter((field) => field.required).length,
    }];
  });
}

export async function getPublishedTemplate(db: Db, organizationId: string, key: string) {
  if (!/^[a-z][a-zA-Z0-9]{0,39}$/.test(key)) return null;
  const template = await db.collection<TemplateDocument>("templates").findOne({ organizationId, key });
  if (!template) return null;
  const version = await db.collection<TemplateVersionDocument>("templateVersions").findOne({ _id: template.publishedVersionId, organizationId });
  if (!version) return null;
  return { templateId: template._id, versionId: version._id, version: version.version, publishedAt: version.publishedAt, definition: version.definition };
}
