import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { getDatabase } from "../src/server/db.ts";
import { provisionCompany } from "../src/server/provisioning.ts";

test("Better Auth and company isolation against the local app and Atlas test database", async (t) => {
  nextEnv.loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true, { info() {}, error() {} });
  const baseURL = process.env.AUTH_TEST_BASE_URL;
  assert.ok(baseURL, "Set AUTH_TEST_BASE_URL to the local test server before running database tests.");
  const parsed = new URL(baseURL);
  assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname), "Only a local test server is allowed.");
  const { client, db, config } = getDatabase();
  assert.match(config.databaseName, /_(dev|test)$/, "Use a separate development/test database.");
  const run = randomUUID();
  const fixtures = [];
  const password = randomBytes(24).toString("base64url");
  const octets = randomBytes(2);
  const testIPAddress = `198.18.${octets[0]}.${octets[1]}`;
  const emailA = `qa.a.${run}@example.invalid`;
  const emailB = `qa.b.${run}@example.invalid`;
  const companyA = `Verifiering A ${run}`;
  const companyB = `Verifiering B ${run}`;
  const request = (route, cookie = "", method = "GET", body, origin = baseURL) => fetch(new URL(route, baseURL), {
    method, redirect: "manual",
    headers: { cookie, origin, "Content-Type": "application/json", "x-forwarded-for": testIPAddress },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const signIn = async (email) => {
    const response = await request("/api/auth/sign-in/email", "", "POST", { email, password });
    assert.equal(response.status, 200, "Sign-in must succeed for the provisioned test user.");
    const cookies = response.headers.getSetCookie();
    assert.ok(cookies.some((cookie) => /httponly/i.test(cookie)), "Session cookie must be HttpOnly.");
    return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  };

  try {
    fixtures.push(await provisionCompany(client, db, config, { company: companyA, name: "Test A", email: emailA, password }));
    fixtures.push(await provisionCompany(client, db, config, { company: companyB, name: "Test B", email: emailB, password }));
    const [a, b] = fixtures;
    const cookieA = await signIn(emailA);
    const cookieB = await signIn(emailB);
    const pathA = `/api/foretag/${a.organizationId}`;
    const pathB = `/api/foretag/${b.organizationId}`;

    await t.test("anonymous requests and forged session cookies are denied", async () => {
      assert.equal((await request(pathA)).status, 401);
      assert.equal((await request(pathA, "arbetsrapporter.session_token=fabricated")).status, 401);
    });
    await t.test("each admin can read its own company but cannot read or change the other", async () => {
      assert.equal((await request(pathA, cookieA)).status, 200);
      assert.equal((await request(pathB, cookieB)).status, 200);
      assert.equal((await request(pathB, cookieA)).status, 403);
      assert.equal((await request(pathA, cookieB)).status, 403);
      assert.equal((await request(pathB, cookieA, "PATCH", { name: "Unauthorized change" })).status, 403);
      assert.equal((await request(pathA, cookieB, "PATCH", { name: "Unauthorized change" })).status, 403);
      assert.equal((await db.collection("organizations").findOne({ _id: b.organizationId })).name, companyB);
    });
    await t.test("company selection never lists the other company's membership", async () => {
      const response = await request("/foretag", cookieA);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.ok(html.includes(a.organizationId));
      assert.ok(!html.includes(b.organizationId));
    });
    await t.test("an admin can update its company; invalid input and foreign origins are denied", async () => {
      assert.equal((await request(pathA, cookieA, "PATCH", { name: "x" })).status, 400);
      assert.equal((await request(pathA, cookieA, "PATCH", { name: "Blocked" }, "https://example.invalid")).status, 403);
      assert.equal((await request(pathA, cookieA, "PATCH", { name: companyA + " uppdaterat" })).status, 200);
      assert.equal(await db.collection("organizationEvents").countDocuments({ organizationId: a.organizationId, type: "name_changed" }), 1);
    });
    await t.test("role changes and suspended memberships apply to existing sessions", async () => {
      await db.collection("memberships").updateOne({ organizationId: b.organizationId, userId: b.userId }, { $set: { roles: ["reporter"] } });
      assert.equal((await request(pathB, cookieB)).status, 200);
      assert.equal((await request(pathB, cookieB, "PATCH", { name: "Blocked by role" })).status, 403);
      const selected = cookieB + `; arbetsrapporter_company=${b.organizationId}`;
      const adminResponse = await request("/admin/granskning", selected);
      // Next may stream redirects with 200; neither response may contain protected page content.
      const adminHTML = await adminResponse.text();
      assert.ok(adminResponse.headers.get("location")?.includes("ingen-behorighet") || adminHTML.includes("NEXT_REDIRECT"));
      await db.collection("memberships").updateOne({ organizationId: b.organizationId, userId: b.userId }, { $set: { status: "suspended" } });
      assert.equal((await request(pathB, cookieB)).status, 403);
      await db.collection("memberships").updateOne({ organizationId: b.organizationId, userId: b.userId }, { $set: { status: "active" } });
    });
    await t.test("suspended companies and removed memberships deny access", async () => {
      await db.collection("organizations").updateOne({ _id: b.organizationId }, { $set: { status: "suspended" } });
      assert.equal((await request(pathB, cookieB)).status, 403);
      await db.collection("organizations").updateOne({ _id: b.organizationId }, { $set: { status: "active" } });
      await db.collection("memberships").deleteOne({ organizationId: b.organizationId, userId: b.userId });
      assert.equal((await request(pathB, cookieB)).status, 403);
    });
    await t.test("self-registration and global admin endpoints are unavailable", async () => {
      assert.equal((await request("/api/auth/sign-up/email", "", "POST", { name: "Blocked", email: `qa.blocked.${run}@example.invalid`, password })).status, 404);
      assert.equal((await request("/api/auth/admin/create-user", cookieA, "POST", { name: "Blocked", email: `qa.blocked.${run}@example.invalid`, password })).status, 404);
    });
    await t.test("logout revokes the server session", async () => {
      assert.equal((await request("/api/auth/sign-out", cookieA, "POST", {})).status, 200);
      assert.equal((await request(pathA, cookieA)).status, 401);
    });
    await t.test("sign-in rejects another origin and limits repeated attempts", async () => {
      assert.equal((await request("/api/auth/sign-in/email", "", "POST", { email: emailA, password }, "https://example.invalid")).status, 403);
      let limited = false;
      for (let attempt = 0; attempt < 12; attempt++) {
        const response = await request("/api/auth/sign-in/email", "", "POST", { email: `qa.unknown.${run}@example.invalid`, password });
        if (response.status === 429) { limited = true; break; }
        assert.equal(response.status, 401);
      }
      assert.ok(limited, "Repeated sign-in attempts must eventually return 429.");
    });
  } finally {
    // Exact IDs from this invocation only; never drop a database or whole collection.
    for (const fixture of fixtures) {
      await db.collection("memberships").deleteMany({ organizationId: fixture.organizationId });
      await db.collection("organizationEvents").deleteMany({ organizationId: fixture.organizationId });
      await db.collection("organizations").deleteOne({ _id: fixture.organizationId });
      await db.collection("session").deleteMany({ userId: fixture.userId });
      await db.collection("account").deleteMany({ userId: fixture.userId });
      await db.collection("user").deleteOne({ _id: fixture.userId });
    }
    await client.close();
  }
});
