import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { configIssues, createLocalEnv } from "./local-config.mjs";

// Syntactic fixture only. Tests never call MongoClient.connect or access Atlas.
function fixture() {
  return {
    MONGODB_URI: "mongodb+srv://test-user:test-password@fixture.mongodb.net/?retryWrites=true&w=majority",
    MONGODB_DB: "arbetsrapporter_dev",
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
    BETTER_AUTH_URL: "http://localhost:3000",
  };
}

test("setup preserves an existing secret and never overwrites the file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "arbetsrapporter-config-"));
  const file = path.join(directory, ".env.local");
  try {
    assert.equal(await createLocalEnv(file), "created");
    const original = await readFile(file, "utf8");
    assert.match(original, /BETTER_AUTH_SECRET=[A-Za-z0-9_-]{43}\n/);
    assert.match(original, /MONGODB_URI=""/);
    assert.equal(await createLocalEnv(file), "exists");
    assert.equal(await readFile(file, "utf8"), original);
  } finally {
    // Delete only the known temporary file and its now-empty directory.
    await rm(file, { force: true });
    await rmdir(directory);
  }
});

test("an empty configuration fails and a well-formed fixture passes offline", () => {
  assert.equal(configIssues({}).length, 4);
  assert.deepEqual(configIssues(fixture()), []);
});

test("rejects unsafe TLS options, missing credentials and placeholders", () => {
  const env = fixture();
  for (const suffix of ["&tls=false", "&tlsInsecure=true", "&tlsAllowInvalidCertificates=true", "&tlsAllowInvalidHostnames=true"]) {
    assert.ok(configIssues({ ...env, MONGODB_URI: env.MONGODB_URI + suffix }).length);
  }
  for (const uri of ["mongodb+srv://fixture.mongodb.net", "mongodb+srv://user:<password>@fixture.mongodb.net", "mongodb+srv://user:%3Cpassword%3E@fixture.mongodb.net"]) {
    assert.ok(configIssues({ ...env, MONGODB_URI: uri }).length);
  }
});

test("diagnostics never echo supplied credentials or malformed URLs", () => {
  const marker = randomBytes(24).toString("hex");
  const issues = configIssues({ MONGODB_URI: marker, BETTER_AUTH_URL: marker, MONGODB_DB: `${marker}/invalid`, BETTER_AUTH_SECRET: `<${marker}>` });
  assert.equal(issues.length, 4);
  assert.ok(!JSON.stringify(issues).includes(marker));
});

test("rejects remote plain HTTP, auth URL paths and system databases", () => {
  const env = fixture();
  for (const url of ["http://example.com", "http://localhost:3000/login", "http://localhost:3000/?secret=value"]) {
    assert.ok(configIssues({ ...env, BETTER_AUTH_URL: url }).length);
  }
  assert.ok(configIssues({ ...env, MONGODB_DB: "admin" }).length);
});
