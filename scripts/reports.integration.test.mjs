import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { getDatabase } from "../src/server/db.ts";
import { provisionCompany } from "../src/server/provisioning.ts";
import { publishBuiltInTemplates } from "../src/server/templates/service.ts";

test("reports, completion, approval, billing and company boundaries against the local app", async (t) => {
  nextEnv.loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true, { info() {}, error() {} });
  const baseURL = process.env.AUTH_TEST_BASE_URL;
  assert.ok(baseURL, "Set AUTH_TEST_BASE_URL to a local test server.");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
  const { client, db, config } = getDatabase();
  assert.match(config.databaseName, /_(dev|test)$/);
  assert.equal(config.baseURL, new URL(baseURL).origin);
  const run = randomUUID();
  const password = randomBytes(24).toString("base64url");
  const ip = randomBytes(2);
  const fixtures = [];
  const request = (path, cookie = "", method = "GET", body, origin = baseURL) => fetch(new URL(path, baseURL), {
    method, redirect: "manual", headers: { cookie, origin, "Content-Type": "application/json", "x-forwarded-for": `198.18.${ip[0]}.${ip[1]}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = async (response, status) => {
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return response.json();
  };
  const complete = { tmaRegnr: "abc123", datum: "2026-10-18", kund: "Fiktiv testkund", vagnummer: "Testväg", arbetsplats: "Testplats",
    starttid: "22:30", sluttid: "00:30", rast: "0", debiterbaraTimmar: "3", kontrollFore: "ja", tillbud: "nej", namn: "Angivet namn",
    arbetsuppgifter: "Testarbete", avvikelser: "Test av avvikande debiterbar tid." };

  try {
    for (const name of ["A", "B", "C"]) {
      const email = `qa.reports.${name}.${run}@example.invalid`;
      const fixture = await provisionCompany(client, db, config, { company: `Rapporttest ${name} ${run}`, name: `Test ${name}`, email, password });
      fixtures.push(fixture);
      const response = await request("/api/auth/sign-in/email", "", "POST", { email, password });
      assert.equal(response.status, 200);
      fixture.cookie = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
    }
    const [a, b, c] = fixtures;
    await publishBuiltInTemplates(client, db, a.organizationId, a.userId);
    await publishBuiltInTemplates(client, db, b.organizationId, b.userId);
    await db.collection("memberships").insertMany([
      { _id: randomUUID(), organizationId: a.organizationId, userId: b.userId, roles: ["reporter"], status: "active", createdAt: new Date() },
      { _id: randomUUID(), organizationId: a.organizationId, userId: c.userId, roles: ["company_admin"], status: "active", createdAt: new Date() },
    ]);
    const template = await db.collection("templates").findOne({ organizationId: a.organizationId, key: "tma" });
    const foreignTemplate = await db.collection("templates").findOne({ organizationId: b.organizationId, key: "tma" });
    const base = `/api/foretag/${a.organizationId}/rapporter`;
    const foreignBase = `/api/foretag/${b.organizationId}/rapporter`;
    const reportId = randomUUID();
    const path = `${base}/${reportId}`;
    const createBody = { id: reportId, templateVersionId: template.publishedVersionId, answers: { kund: "Påbörjad kund" } };

    await t.test("old review and billing links redirect to one invoice workspace and preserve query parameters", async () => {
      for (const legacy of ["granskning", "underlag"]) {
        for (const suffix of ["?status=handled&page=2", `/${reportId}?version=1`]) {
          const response = await request(`/admin/${legacy}${suffix}`, a.cookie);
          assert.equal(response.status, 308);
          const destination = new URL(response.headers.get("location"), baseURL);
          assert.equal(`${destination.pathname}${destination.search}`, `/admin/fakturaunderlag${suffix}`);
        }
      }
    });

    await t.test("authentication, active role, origin, body shape and tenant template are enforced", async () => {
      assert.equal((await request(base)).status, 401);
      assert.equal((await request(base, "arbetsrapporter.session_token=fake")).status, 401);
      assert.equal((await request(base, c.cookie, "POST", createBody)).status, 403);
      assert.equal((await request(base, a.cookie, "POST", createBody, "https://example.invalid")).status, 403);
      assert.equal((await request(base, a.cookie, "POST", { ...createBody, createdBy: b.userId })).status, 400);
      assert.equal((await request(base, a.cookie, "POST", { ...createBody, templateVersionId: foreignTemplate.publishedVersionId })).status, 409);
      assert.equal((await request(base, a.cookie, "POST", { ...createBody, answers: { kund: { $ne: null } } })).status, 400);
      assert.equal((await request(base, a.cookie, "POST", { ...createBody, answers: { unknown: "x" } })).status, 400);
      assert.equal((await request(base, a.cookie, "POST", { ...createBody, answers: { kund: "x".repeat(140000) } })).status, 413);
    });
    await t.test("direct submission enforces access and validates before creating any report", async () => {
      const directId = randomUUID();
      const directBody = { id: directId, templateVersionId: template.publishedVersionId, answers: complete };
      const endpoint = `${base}/skicka-in`;
      try {
        assert.equal((await request(endpoint, "", "POST", directBody)).status, 401);
        assert.equal((await request(endpoint, c.cookie, "POST", directBody)).status, 403);
        assert.equal((await request(`${foreignBase}/skicka-in`, a.cookie, "POST", directBody)).status, 403);
        assert.equal((await request(endpoint, a.cookie, "POST", directBody, "https://example.invalid")).status, 403);
        assert.equal((await request(endpoint, a.cookie, "POST", { ...directBody, createdBy: b.userId })).status, 400);
        assert.equal((await request(endpoint, a.cookie, "POST", { ...directBody, templateVersionId: foreignTemplate.publishedVersionId })).status, 409);
        assert.equal((await request(endpoint, a.cookie, "POST", { ...directBody, automaticTimeFields: ["kund"] })).status, 400);
        assert.equal((await request(endpoint, a.cookie, "POST", { ...directBody, answers: { kund: "x".repeat(140000) } })).status, 413);
        for (const answers of [{}, { ...complete, datum: "2026-02-30" }, { ...complete, tillbud: "ja" }, { ...complete, rast: "180" }]) {
          const invalid = await json(await request(endpoint, a.cookie, "POST", { ...directBody, answers }), 422);
          assert.ok(invalid.evaluation.errors.length);
        }
        assert.equal(await db.collection("reports").countDocuments({ _id: directId }), 0);
        for (const name of ["reportEvents", "reportVersions"]) assert.equal(await db.collection(name).countDocuments({ reportId: directId }), 0);
        // Correcting the same new form can submit under its original ID; manual hours remain manual.
        await json(await request(endpoint, a.cookie, "POST", directBody), 201);
        const saved = await json(await request(`${base}/${directId}`, a.cookie), 200);
        assert.equal(saved.status, "submitted");
        assert.equal(saved.answers.debiterbaraTimmar, "3");
        assert.deepEqual(saved.automaticTimeFields, []);
        assert.ok(saved.submission.warnings.length);
      } finally {
        for (const name of ["reportEvents", "reportVersions"]) await db.collection(name).deleteMany({ organizationId: a.organizationId, reportId: directId });
        await db.collection("reports").deleteOne({ _id: directId, organizationId: a.organizationId });
      }
    });
    await t.test("direct submission creates one locked version and event even with simultaneous retries", async () => {
      const directId = randomUUID();
      const directPath = `${base}/${directId}`;
      const directBody = { id: directId, templateVersionId: template.publishedVersionId, answers: complete, automaticTimeFields: ["debiterbaraTimmar"] };
      try {
        const responses = await Promise.all([request(`${base}/skicka-in`, a.cookie, "POST", directBody), request(`${base}/skicka-in`, a.cookie, "POST", directBody)]);
        const results = await Promise.all(responses.map((response) => json(response, 201)));
        assert.deepEqual(results.map((result) => result.created).sort(), [false, true]);
        const saved = await json(await request(directPath, a.cookie), 200);
        assert.equal(saved.status, "submitted");
        assert.equal(saved.billingStatus, "not_ready");
        assert.equal(saved.revision, 1);
        assert.equal(saved.answers.tmaRegnr, "ABC123");
        assert.equal(saved.answers.debiterbaraTimmar, "2");
        assert.deepEqual(saved.automaticTimeFields, ["debiterbaraTimmar"]);
        assert.deepEqual(saved.events.map((event) => event.type), ["submitted"]);
        assert.equal(saved.versions.length, 1);
        assert.equal(saved.submission.version, 1);
        assert.equal(saved.submission.submittedBy.id, a.userId);
        assert.equal(saved.submission.submittedBy.name, "Test A");
        const snapshot = await db.collection("reportVersions").findOne({ organizationId: a.organizationId, reportId: directId });
        assert.equal(snapshot._id, saved.submittedVersionId);
        assert.equal(snapshot.companyName, `Rapporttest A ${run}`);
        assert.deepEqual(snapshot.answers, saved.answers);
        assert.equal((await json(await request(`${directPath}?view=review`, c.cookie), 200)).submission.id, snapshot._id);
        assert.equal((await request(`${directPath}?view=review`, b.cookie)).status, 403);
        assert.equal((await request(directPath, b.cookie)).status, 404);
        assert.equal((await request(directPath, a.cookie, "PATCH", { revision: 1, answers: complete })).status, 409);
        assert.equal((await request(`${directPath}/skicka-in`, a.cookie, "POST", { revision: 1, answers: complete })).status, 409);
        // A lost response followed by edits or a draft save cannot overwrite the submitted version.
        for (const endpoint of [`${base}/skicka-in`, base]) {
          const repeated = await json(await request(endpoint, a.cookie, "POST", { ...directBody, answers: { ...complete, kund: "Senare ändring" } }), 201);
          assert.equal(repeated.created, false);
          assert.equal(repeated.status, "submitted");
        }
        assert.equal((await request(`${base}/skicka-in`, b.cookie, "POST", directBody)).status, 409);
        assert.equal((await request(`${foreignBase}/skicka-in`, b.cookie, "POST", { ...directBody, templateVersionId: foreignTemplate.publishedVersionId })).status, 409);
        assert.deepEqual(await db.collection("reportVersions").findOne({ _id: snapshot._id }), snapshot);
        assert.equal(await db.collection("reportVersions").countDocuments({ reportId: directId }), 1);
        assert.equal(await db.collection("reportEvents").countDocuments({ reportId: directId }), 1);
      } finally {
        for (const name of ["reportEvents", "reportVersions"]) await db.collection(name).deleteMany({ organizationId: a.organizationId, reportId: directId });
        await db.collection("reports").deleteOne({ _id: directId, organizationId: a.organizationId });
      }
    });
    await t.test("a simultaneous first draft save and direct submission never overwrite each other", async () => {
      const directId = randomUUID();
      const directBody = { id: directId, templateVersionId: template.publishedVersionId, answers: complete };
      try {
        const responses = await Promise.all([
          request(base, a.cookie, "POST", { ...directBody, answers: { kund: "Delvis ifyllt" } }),
          request(`${base}/skicka-in`, a.cookie, "POST", directBody),
        ]);
        const results = await Promise.all(responses.map((response) => json(response, 201)));
        assert.deepEqual(results.map((result) => result.created).sort(), [false, true]);
        const saved = await json(await request(`${base}/${directId}`, a.cookie), 200);
        const submitted = saved.status === "submitted";
        assert.equal(saved.revision, 1);
        assert.equal(saved.answers.kund, submitted ? complete.kund : "Delvis ifyllt");
        assert.deepEqual(saved.events.map((event) => event.type), [submitted ? "submitted" : "draft_created"]);
        assert.equal(saved.versions.length, submitted ? 1 : 0);
        const repeated = await json(await request(`${base}/skicka-in`, a.cookie, "POST", directBody), 201);
        assert.equal(repeated.created, false);
        assert.equal(repeated.status, saved.status);
        assert.deepEqual((await json(await request(`${base}/${directId}`, a.cookie), 200)).answers, saved.answers);
      } finally {
        for (const name of ["reportEvents", "reportVersions"]) await db.collection(name).deleteMany({ organizationId: a.organizationId, reportId: directId });
        await db.collection("reports").deleteOne({ _id: directId, organizationId: a.organizationId });
      }
    });
    await t.test("automatic hours are recomputed on the server and manual mode persists", async () => {
      const timeId = randomUUID();
      const timePath = `${base}/${timeId}`;
      try {
        await json(await request(base, a.cookie, "POST", { id: timeId, templateVersionId: template.publishedVersionId, answers: complete, automaticTimeFields: ["debiterbaraTimmar"] }), 201);
        let saved = await json(await request(timePath, a.cookie), 200);
        assert.equal(saved.answers.debiterbaraTimmar, "2");
        assert.deepEqual(saved.automaticTimeFields, ["debiterbaraTimmar"]);
        await json(await request(timePath, a.cookie, "PATCH", { revision: 1, answers: { ...complete, rast: "30" } }), 200);
        saved = await json(await request(timePath, a.cookie), 200);
        assert.equal(saved.answers.debiterbaraTimmar, "1.5");
        await json(await request(timePath, a.cookie, "PATCH", { revision: 2, answers: { ...complete, rast: "30", debiterbaraTimmar: "1.5" }, automaticTimeFields: [] }), 200);
        await json(await request(timePath, a.cookie, "PATCH", { revision: 3, answers: { ...complete, debiterbaraTimmar: "1.5" } }), 200);
        saved = await json(await request(timePath, a.cookie), 200);
        assert.equal(saved.answers.debiterbaraTimmar, "1.5");
        assert.deepEqual(saved.automaticTimeFields, []);
        for (const automaticTimeFields of [["kund"], null, "debiterbaraTimmar"]) {
          assert.equal((await request(timePath, a.cookie, "PATCH", { revision: 4, answers: complete, automaticTimeFields })).status, 400);
        }
        await json(await request(`${timePath}/skicka-in`, a.cookie, "POST", { revision: 4, answers: complete, automaticTimeFields: ["debiterbaraTimmar"] }), 200);
        const snapshot = await db.collection("reportVersions").findOne({ organizationId: a.organizationId, reportId: timeId });
        assert.equal(snapshot.answers.debiterbaraTimmar, "2");
        assert.deepEqual(snapshot.automaticTimeFields, ["debiterbaraTimmar"]);
      } finally {
        for (const name of ["reportEvents", "reportVersions"]) await db.collection(name).deleteMany({ organizationId: a.organizationId, reportId: timeId });
        await db.collection("reports").deleteOne({ _id: timeId, organizationId: a.organizationId });
      }
    });
    await t.test("a partial draft persists, repeated creation is safe and history is atomic", async () => {
      const results = await Promise.all([request(base, a.cookie, "POST", createBody), request(base, a.cookie, "POST", createBody)]);
      for (const response of results) assert.equal(response.status, 201);
      const draft = await json(await request(path, a.cookie), 200);
      assert.equal(draft.status, "draft");
      assert.equal(draft.answers.kund, "Påbörjad kund");
      assert.equal(draft.events.length, 1);
      assert.equal(draft.events[0].actorName, "Test A");
      assert.equal(draft.revision, 1);
      assert.equal(await db.collection("reports").countDocuments({ _id: reportId, organizationId: a.organizationId }), 1);
    });
    await t.test("another reporter cannot read, save or submit a draft, and review cannot see drafts", async () => {
      for (const cookie of [b.cookie, c.cookie]) {
        assert.ok([403, 404].includes((await request(path, cookie)).status));
        assert.ok([403, 404].includes((await request(path, cookie, "PATCH", { revision: 1, answers: complete })).status));
        assert.ok([403, 404].includes((await request(`${path}/skicka-in`, cookie, "POST", { revision: 1, answers: complete })).status));
      }
      assert.equal((await request(`${path}?view=review`, c.cookie)).status, 404);
      assert.equal((await request(`${path}/klarmarkera`, a.cookie, "POST", { revision: 1, versionId: randomUUID(), confirmed: true })).status, 404);
      assert.equal((await request(`${path}?view=review`, b.cookie)).status, 403);
      assert.equal((await json(await request(`${base}?view=review`, c.cookie), 200)).total, 0);
      assert.equal((await json(await request(base, b.cookie), 200)).total, 0);
      assert.equal((await request(`${foreignBase}/${reportId}`, a.cookie)).status, 403);
      assert.equal((await request(`${foreignBase}/${reportId}`, b.cookie)).status, 404);
      assert.equal((await request(`${foreignBase}/${reportId}`, b.cookie, "PATCH", { revision: 1, answers: complete })).status, 404);
    });
    await t.test("submission validates the pinned template on the server without losing the draft", async () => {
      const response = await json(await request(`${path}/skicka-in`, a.cookie, "POST", { revision: 1, answers: {} }), 422);
      assert.ok(response.evaluation.errors.length);
      for (const answers of [{ ...complete, datum: "2026-02-30" }, { ...complete, tillbud: "ja" }, { ...complete, rast: "180" }]) {
        assert.equal((await request(`${path}/skicka-in`, a.cookie, "POST", { revision: 1, answers })).status, 422);
      }
      assert.equal((await json(await request(path, a.cookie), 200)).revision, 1);
      assert.equal(await db.collection("reportVersions").countDocuments({ organizationId: a.organizationId, reportId }), 0);
    });
    await t.test("simultaneous draft saves cannot silently overwrite each other", async () => {
      const responses = await Promise.all([
        request(path, a.cookie, "PATCH", { revision: 1, answers: complete }),
        request(path, a.cookie, "PATCH", { revision: 1, answers: { ...complete, kund: "Alternativ kund" } }),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
      const saved = await json(await request(path, a.cookie), 200);
      assert.equal(saved.revision, 2);
      assert.equal(saved.events.length, 2);
      assert.equal((await request(path, a.cookie, "PATCH", { revision: 1, answers: {} })).status, 409);
      const retry = await json(await request(base, a.cookie, "POST", createBody), 201);
      assert.equal(retry.revision, 2);
      assert.equal(retry.created, false);
      assert.equal((await json(await request(path, a.cookie), 200)).revision, 2);
    });
    await t.test("new template publications do not change existing drafts", async () => {
      const original = await db.collection("templateVersions").findOne({ _id: template.publishedVersionId, organizationId: a.organizationId });
      const versionId = randomUUID();
      await db.collection("templateVersions").insertOne({ ...original, _id: versionId, version: 2, definition: { ...original.definition, title: "Ny testmall" } });
      await db.collection("templates").updateOne({ _id: template._id, organizationId: a.organizationId }, { $set: { publishedVersionId: versionId, publishedVersion: 2 } });
      const draft = await json(await request(path, a.cookie), 200);
      assert.equal(draft.templateVersion, 1);
      assert.equal(draft.definition.title, "Underlag TMA");
      assert.equal((await request(base, a.cookie, "POST", { ...createBody, id: randomUUID() })).status, 409);
    });
    await t.test("double submission creates one immutable snapshot and one event", async () => {
      const responses = await Promise.all([
        request(`${path}/skicka-in`, a.cookie, "POST", { revision: 2, answers: complete }),
        request(`${path}/skicka-in`, a.cookie, "POST", { revision: 2, answers: complete }),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
      const report = await json(await request(path, a.cookie), 200);
      assert.equal(report.status, "submitted");
      assert.equal(report.revision, 3);
      assert.equal(report.answers.tmaRegnr, "ABC123");
      assert.equal(report.answers.debiterbaraTimmar, "3");
      assert.equal(report.answers.kontrollFore, true);
      assert.equal(report.answers.tillbud, false);
      assert.equal(report.submission.submittedBy.id, a.userId);
      assert.equal(report.submission.submittedBy.name, "Test A");
      assert.deepEqual(report.submission.computed, [{ label: "Arbetad tid", value: "2 h (över midnatt)" }]);
      assert.equal(report.submission.warnings.length, 1);
      assert.equal(report.events.length, 3);
      assert.equal(await db.collection("reportVersions").countDocuments({ organizationId: a.organizationId, reportId }), 1);
      const snapshot = await db.collection("reportVersions").findOne({ organizationId: a.organizationId, reportId });
      assert.equal((await request(path, a.cookie, "PATCH", { revision: 3, answers: {} })).status, 409);
      assert.equal((await request(`${path}/skicka-in`, a.cookie, "POST", { revision: 3, answers: complete })).status, 409);
      assert.deepEqual(await db.collection("reportVersions").findOne({ organizationId: a.organizationId, reportId }), snapshot);
    });
    await t.test("review lists and details include submitted reports only for the correct company and role", async () => {
      const list = await json(await request(`${base}?view=review&status=submitted`, c.cookie), 200);
      assert.deepEqual(list.reports.map((item) => item.id), [reportId]);
      assert.equal((await json(await request(`${base}?status=draft`, a.cookie), 200)).total, 0);
      assert.equal((await json(await request(`${base}?status=submitted`, a.cookie), 200)).total, 1);
      assert.equal((await json(await request(`${base}?page=2`, a.cookie), 200)).reports.length, 0);
      assert.equal((await request(`${path}?view=review`, c.cookie)).status, 200);
      assert.equal((await request(`${path}?view=review`, b.cookie)).status, 403);
      assert.equal((await request(`${foreignBase}/${reportId}?view=review`, b.cookie)).status, 404);
      const ownPage = await request(`/rapportor/rapporter/${reportId}`, `${a.cookie}; arbetsrapporter_company=${a.organizationId}`);
      assert.equal(ownPage.status, 200);
      assert.ok((await ownPage.text()).includes("Rapporten är inskickad och låst"));
      const reviewPage = await request(`/admin/fakturaunderlag/${reportId}`, `${c.cookie}; arbetsrapporter_company=${a.organizationId}`);
      assert.equal(reviewPage.status, 200);
      assert.ok((await reviewPage.text()).includes("Test A"));
      const invoiceList = await request("/admin/fakturaunderlag", `${c.cookie}; arbetsrapporter_company=${a.organizationId}`);
      assert.equal(invoiceList.status, 200);
      const invoiceHTML = await invoiceList.text();
      assert.ok(invoiceHTML.includes("Fakturaunderlag"));
      assert.ok(!invoiceHTML.includes("Faktureringsunderlag"));
      assert.ok(!invoiceHTML.includes("Markera som inlagd")); // Submitted reports must first be approved.
      const otherPage = await request(`/rapportor/rapporter/${reportId}`, `${b.cookie}; arbetsrapporter_company=${a.organizationId}`);
      assert.ok([200, 404].includes(otherPage.status)); // A streamed Next.js not-found can have HTTP 200.
      assert.ok(!(await otherPage.text()).includes("Fiktiv testkund"));
    });
    const snapshot1 = await db.collection("reportVersions").findOne({ organizationId: a.organizationId, reportId, version: 1 });
    const reviewPath = `${path}/granska`;
    await t.test("review decisions require company admin, correct origin, version and a completion comment", async () => {
      const decision = { action: "request_completion", revision: 3, versionId: snapshot1._id, comment: "Förtydliga arbetet." };
      assert.equal((await request(reviewPath, undefined, "POST", decision)).status, 401);
      assert.equal((await request(reviewPath, b.cookie, "POST", decision)).status, 403);
      assert.equal((await request(`${foreignBase}/${reportId}/granska`, b.cookie, "POST", decision)).status, 404);
      assert.equal((await request(reviewPath, c.cookie, "POST", decision, "https://example.invalid")).status, 403);
      for (const comment of [undefined, "  ", "x".repeat(2001), { $ne: null }]) {
        assert.equal((await request(reviewPath, c.cookie, "POST", { ...decision, comment })).status, 400);
      }
      assert.equal((await request(reviewPath, c.cookie, "POST", { ...decision, actorId: a.userId })).status, 400);
      assert.equal((await request(reviewPath, c.cookie, "POST", { ...decision, revision: 2 })).status, 409);
      assert.equal((await request(reviewPath, c.cookie, "POST", { ...decision, versionId: randomUUID() })).status, 409);
      assert.equal((await request(`${path}?view=billing`, a.cookie)).status, 404);
      assert.equal((await request(`${path}/klarmarkera`, a.cookie, "POST", { revision: 3, versionId: snapshot1._id, confirmed: true })).status, 404);
      assert.equal((await json(await request(`${base}?view=billing&status=ready`, a.cookie), 200)).total, 0);
    });
    await t.test("completion requests are atomic and pending edits stay private until resubmission", async () => {
      const decision = { action: "request_completion", revision: 3, versionId: snapshot1._id, comment: "  Förtydliga arbetet.\nAnge rätt kund.  " };
      const responses = await Promise.all([request(reviewPath, c.cookie, "POST", decision), request(reviewPath, c.cookie, "POST", decision)]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
      let report = await json(await request(path, a.cookie), 200);
      assert.equal(report.status, "needs_completion");
      assert.equal(report.revision, 4);
      assert.equal(report.completion.comment, "Förtydliga arbetet.\nAnge rätt kund.");
      assert.equal(report.completion.actorName, "Test C");
      assert.equal(report.billingStatus, "not_ready");
      assert.equal((await request(`${path}/klarmarkera`, a.cookie, "POST", { revision: 4, versionId: snapshot1._id, confirmed: true })).status, 404);
      assert.equal(report.events.filter((event) => event.type === "completion_requested").length, 1);
      assert.equal((await request(path, c.cookie, "PATCH", { revision: 4, answers: complete })).status, 403);
      assert.equal((await request(reviewPath, a.cookie, "POST", { action: "approve", revision: 4, versionId: snapshot1._id })).status, 409);
      await json(await request(path, a.cookie, "PATCH", { revision: 4, answers: { ...complete, kund: "Kompletterad kund", arbetsuppgifter: "Förtydligat arbete" }, automaticTimeFields: ["debiterbaraTimmar"] }), 200);
      report = await json(await request(path, a.cookie), 200);
      assert.equal(report.status, "needs_completion");
      assert.equal(report.revision, 5);
      assert.equal(report.answers.kund, "Kompletterad kund");
      const reviewer = await json(await request(`${path}?view=review`, c.cookie), 200);
      assert.equal(reviewer.answers.kund, complete.kund);
      assert.equal((await json(await request(`${base}?view=review&status=needs_completion`, c.cookie), 200)).reports[0].customer, complete.kund);
      const historical = await json(await request(`${path}?version=1`, a.cookie), 200);
      assert.equal(historical.viewingVersion, true);
      assert.equal(historical.answers.kund, complete.kund);
      assert.deepEqual(await db.collection("reportVersions").findOne({ _id: snapshot1._id }), snapshot1);
    });
    await t.test("resubmission creates version two with the original template and preserves comments and version one", async () => {
      assert.equal((await request(`${path}/skicka-in`, a.cookie, "POST", { revision: 5, answers: {} })).status, 422);
      const saved = await json(await request(path, a.cookie), 200);
      await json(await request(`${path}/skicka-in`, a.cookie, "POST", { revision: 5, answers: saved.answers }), 200);
      const report = await json(await request(path, a.cookie), 200);
      assert.equal(report.revision, 6);
      assert.equal(report.status, "submitted");
      assert.equal(report.completion, null);
      assert.equal(report.submission.version, 2);
      assert.equal(report.templateVersionId, snapshot1.templateVersionId);
      assert.equal(report.definition.title, "Underlag TMA");
      assert.equal(report.answers.debiterbaraTimmar, "2");
      assert.deepEqual(report.automaticTimeFields, ["debiterbaraTimmar"]);
      assert.deepEqual(report.versions.map((version) => version.version), [2, 1]);
      assert.equal(report.events.find((event) => event.type === "completion_requested").comment, "Förtydliga arbetet.\nAnge rätt kund.");
      assert.equal((await json(await request(`${path}?view=review&version=1`, c.cookie), 200)).answers.kund, complete.kund);
      assert.equal((await json(await request(`${path}?view=review&version=2`, c.cookie), 200)).answers.kund, "Kompletterad kund");
      assert.equal((await request(`${path}?version=1`, b.cookie)).status, 404);
      assert.equal((await request(`${foreignBase}/${reportId}?view=review&version=1`, b.cookie)).status, 404);
      assert.equal((await request(`${path}?version=garbage`, a.cookie)).status, 400);
      assert.equal((await request(`${path}?version=3`, a.cookie)).status, 404);
      assert.deepEqual(await db.collection("reportVersions").findOne({ _id: snapshot1._id }), snapshot1);
    });
    await t.test("an admin can approve their own current version exactly once and make it ready for billing", async () => {
      const snapshot2 = await db.collection("reportVersions").findOne({ organizationId: a.organizationId, reportId, version: 2 });
      const decision = { action: "approve", revision: 6, versionId: snapshot2._id };
      assert.equal((await request(reviewPath, a.cookie, "POST", { ...decision, revision: 3 })).status, 409);
      assert.equal((await request(reviewPath, a.cookie, "POST", { ...decision, versionId: snapshot1._id })).status, 409);
      const responses = await Promise.all([request(reviewPath, a.cookie, "POST", decision), request(reviewPath, a.cookie, "POST", decision)]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
      const report = await json(await request(path, a.cookie), 200);
      assert.equal(report.status, "approved");
      assert.equal(report.billingStatus, "ready");
      assert.equal(report.approval.actorName, "Test A");
      assert.equal(report.approval.versionId, snapshot2._id);
      assert.equal(report.approval.version, 2);
      assert.equal(report.revision, 7);
      assert.equal(report.events.filter((event) => event.type === "approved").length, 1);
      for (const action of ["approve", "request_completion"]) {
        assert.equal((await request(reviewPath, a.cookie, "POST", { ...decision, revision: 7, action, ...(action === "request_completion" ? { comment: "Ny begäran" } : {}) })).status, 409);
      }
      assert.equal((await request(path, a.cookie, "PATCH", { revision: 7, answers: complete })).status, 409);
      assert.equal((await request(`${path}/skicka-in`, a.cookie, "POST", { revision: 7, answers: complete })).status, 409);
      assert.deepEqual(await db.collection("reportVersions").findOne({ _id: snapshot1._id }), snapshot1);
      assert.deepEqual(await db.collection("reportVersions").findOne({ _id: snapshot2._id }), snapshot2);
    });
    await t.test("marking billing complete requires an approved version, billing access and explicit confirmation", async () => {
      const report = await json(await request(`${path}?view=billing`, a.cookie), 200);
      const body = { revision: report.revision, versionId: report.submission.id, confirmed: true };
      const donePath = `${path}/klarmarkera`;
      assert.equal((await request(donePath, undefined, "POST", body)).status, 401);
      assert.equal((await request(donePath, b.cookie, "POST", body)).status, 403);
      assert.equal((await request(`${foreignBase}/${reportId}/klarmarkera`, b.cookie, "POST", body)).status, 404);
      assert.equal((await request(donePath, a.cookie, "POST", body, "https://example.invalid")).status, 403);
      for (const confirmed of [undefined, false, "true", 1, null]) {
        assert.equal((await request(donePath, a.cookie, "POST", { ...body, confirmed })).status, 400);
      }
      assert.equal((await request(donePath, a.cookie, "POST", { ...body, actorId: b.userId })).status, 400);
      assert.equal((await request(donePath, a.cookie, "POST", { ...body, billingStatus: "handled" })).status, 400);
      assert.equal((await request(donePath, a.cookie, "POST", { ...body, revision: 6 })).status, 409);
      assert.equal((await request(donePath, a.cookie, "POST", { ...body, versionId: snapshot1._id })).status, 409);
      assert.equal((await request(donePath, a.cookie, "POST", { ...body, versionId: randomUUID() })).status, 409);
      const unchanged = await json(await request(`${path}?view=billing`, a.cookie), 200);
      assert.equal(unchanged.revision, 7);
      assert.equal(unchanged.billingStatus, "ready");
      assert.equal(unchanged.billingHandled, null);
    });
    await t.test("billing role sees the approved version only and cannot review or edit", async () => {
      await db.collection("memberships").updateOne({ organizationId: a.organizationId, userId: b.userId }, { $set: { roles: ["billing"] } });
      const list = await json(await request(`${base}?view=billing&status=ready`, b.cookie), 200);
      assert.deepEqual(list.reports.map((report) => report.id), [reportId]);
      assert.equal((await json(await request(`${base}?view=billing&status=handled`, b.cookie), 200)).total, 0);
      const report = await json(await request(`${path}?view=billing`, b.cookie), 200);
      assert.equal(report.submission.version, 2);
      assert.equal(report.answers.kund, "Kompletterad kund");
      assert.deepEqual(report.versions.map((version) => version.version), [2]);
      assert.deepEqual(report.events.map((event) => event.type), ["approved"]);
      assert.equal((await request(`${path}?view=billing&version=1`, b.cookie)).status, 404);
      assert.equal((await request(`${path}?view=billing&version=2`, b.cookie)).status, 200);
      assert.equal((await request(`${path}?view=review`, b.cookie)).status, 403);
      assert.equal((await request(path, b.cookie, "PATCH", { revision: 7, answers: complete })).status, 403);
      assert.equal((await request(reviewPath, b.cookie, "POST", { action: "approve", revision: 7, versionId: report.submission.id })).status, 403);
      const page = await request(`/admin/fakturaunderlag/${reportId}`, `${b.cookie}; arbetsrapporter_company=${a.organizationId}`);
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes("Godkänd rapport"));
      assert.ok(html.includes("Markera som inlagd"));
      assert.ok(!html.includes(`/admin/fakturaunderlag/${reportId}?version=1`));
      assert.ok(!html.includes("Begär komplettering"));
      const billingList = await request("/admin/fakturaunderlag?status=open", `${b.cookie}; arbetsrapporter_company=${a.organizationId}`);
      assert.equal(billingList.status, 200);
      assert.ok((await billingList.text()).includes("Markera som inlagd"));
    });
    await t.test("billing completion is saved once with the verified actor and moves the report to handled", async () => {
      const before = await json(await request(`${path}?view=billing`, b.cookie), 200);
      const open = await json(await request(`${base}?view=review&status=open`, c.cookie), 200);
      assert.equal(open.total, 1);
      assert.equal(open.reports[0].revision, before.revision);
      assert.equal(open.reports[0].submittedVersionId, before.submission.id);
      const snapshots = await db.collection("reportVersions").find({ organizationId: a.organizationId, reportId }).sort({ version: 1 }).toArray();
      const body = { revision: before.revision, versionId: before.submission.id, confirmed: true };
      const responses = await Promise.all([
        request(`${path}/klarmarkera`, b.cookie, "POST", body),
        request(`${path}/klarmarkera`, b.cookie, "POST", body),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
      const report = await json(await request(`${path}?view=billing`, b.cookie), 200);
      assert.equal(report.status, "approved");
      assert.equal(report.billingStatus, "handled");
      assert.equal(report.revision, 8);
      assert.equal(report.billingHandled.actorName, "Test B");
      assert.equal(report.billingHandled.versionId, before.submission.id);
      assert.equal(report.billingHandled.version, 2);
      assert.ok(Number.isFinite(Date.parse(report.billingHandled.at)));
      assert.deepEqual(report.approval, before.approval);
      assert.deepEqual(report.answers, before.answers);
      assert.deepEqual(report.events.map((event) => event.type), ["billing_handled", "approved"]);
      const stored = await db.collection("reports").findOne({ _id: reportId, organizationId: a.organizationId });
      assert.equal(stored.billingHandled.actorId, b.userId);
      const event = await db.collection("reportEvents").findOne({ organizationId: a.organizationId, reportId, type: "billing_handled" });
      assert.equal(event.actorId, b.userId);
      assert.equal(event.createdAt.toISOString(), report.billingHandled.at);
      assert.equal(event.versionId, before.submission.id);
      assert.equal((await json(await request(`${base}?view=billing&status=ready`, b.cookie), 200)).total, 0);
      const handled = await json(await request(`${base}?view=billing&status=handled`, b.cookie), 200);
      assert.deepEqual(handled.reports.map((item) => [item.id, item.billingStatus]), [[reportId, "handled"]]);
      assert.equal((await json(await request(`${base}?view=review&status=open`, c.cookie), 200)).total, 0);
      assert.equal((await json(await request(`${base}?view=review&status=handled`, c.cookie), 200)).total, 1);
      assert.equal((await json(await request(`${base}?view=review&status=all`, c.cookie), 200)).total, 1);
      const completedPage = await request("/admin/fakturaunderlag", `${b.cookie}; arbetsrapporter_company=${a.organizationId}`);
      const completedHTML = await completedPage.text();
      assert.ok(completedHTML.includes("invoice-card is-handled"));
      assert.ok(completedHTML.includes("Inlagd / helt klar"));
      assert.ok(!completedHTML.includes("Markera som inlagd"));
      for (const revision of [7, 8]) assert.equal((await request(`${path}/klarmarkera`, a.cookie, "POST", { ...body, revision })).status, 409);
      assert.equal(await db.collection("reportEvents").countDocuments({ organizationId: a.organizationId, reportId, type: "billing_handled" }), 1);
      assert.deepEqual(await db.collection("reportVersions").find({ organizationId: a.organizationId, reportId }).sort({ version: 1 }).toArray(), snapshots);
      const reloaded = await json(await request(`${path}?view=billing`, a.cookie), 200);
      assert.deepEqual(reloaded.billingHandled, report.billingHandled);
    });
    await t.test("competing approval and completion decisions cannot both succeed", async () => {
      const raceId = randomUUID();
      const racePath = `${base}/${raceId}`;
      const currentTemplate = await db.collection("templates").findOne({ _id: template._id });
      await json(await request(base, a.cookie, "POST", { id: raceId, templateVersionId: currentTemplate.publishedVersionId, answers: complete }), 201);
      const draft = await json(await request(racePath, a.cookie), 200);
      assert.equal((await request(`${racePath}/granska`, a.cookie, "POST", { action: "approve", revision: 1, versionId: snapshot1._id })).status, 404);
      await json(await request(`${racePath}/skicka-in`, a.cookie, "POST", { revision: draft.revision, answers: complete }), 200);
      const submitted = await json(await request(`${racePath}?view=review`, c.cookie), 200);
      assert.equal((await request(`${racePath}?view=billing`, b.cookie)).status, 404);
      const decisions = await Promise.all([
        request(`${racePath}/granska`, c.cookie, "POST", { action: "approve", revision: 2, versionId: submitted.submission.id }),
        request(`${racePath}/granska`, a.cookie, "POST", { action: "request_completion", revision: 2, versionId: submitted.submission.id, comment: "Komplettera." }),
      ]);
      assert.deepEqual(decisions.map((response) => response.status).sort(), [200, 409]);
      const report = await json(await request(racePath, a.cookie), 200);
      assert.equal(report.revision, 3);
      assert.equal(report.events.length, 3);
      assert.equal(report.billingStatus, report.status === "approved" ? "ready" : "not_ready");
      assert.equal(await db.collection("reportVersions").countDocuments({ organizationId: a.organizationId, reportId: raceId }), 1);
    });
    await t.test("changed roles, removed memberships, suspended companies and expired sessions are rechecked", async () => {
      await db.collection("memberships").updateOne({ organizationId: a.organizationId, userId: a.userId }, { $set: { roles: ["billing"] } });
      assert.equal((await request(path, a.cookie)).status, 403);
      assert.equal((await request(`${path}?view=review`, a.cookie)).status, 403);
      await db.collection("organizations").updateOne({ _id: a.organizationId }, { $set: { status: "suspended" } });
      assert.equal((await request(`${path}?view=review`, c.cookie)).status, 403);
      await db.collection("organizations").updateOne({ _id: a.organizationId }, { $set: { status: "active" } });
      await db.collection("memberships").deleteOne({ organizationId: a.organizationId, userId: c.userId });
      assert.equal((await request(`${path}?view=review`, c.cookie)).status, 403);
      assert.equal((await request(`${path}/klarmarkera`, c.cookie, "POST", { revision: 8, versionId: snapshot1._id, confirmed: true })).status, 403);
      await db.collection("session").deleteMany({ userId: b.userId });
      assert.equal((await request(base, b.cookie)).status, 401);
    });
  } finally {
    // These organizations and users were created by this run. Never touch existing companies.
    for (const fixture of fixtures) {
      for (const collection of ["reportEvents", "reportVersions", "reports", "templateVersions", "templates", "memberships", "organizationEvents"]) {
        await db.collection(collection).deleteMany({ organizationId: fixture.organizationId });
      }
      await db.collection("organizations").deleteOne({ _id: fixture.organizationId });
      for (const collection of ["session", "account"]) await db.collection(collection).deleteMany({ userId: fixture.userId });
      await db.collection("user").deleteOne({ _id: fixture.userId });
    }
    await client.close();
  }
});
