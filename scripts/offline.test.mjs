import assert from "node:assert/strict";
import test from "node:test";
import { clearOffline, enableOffline, localDrafts, localTemplates, removeLocalDraft, saveLocalDraft } from "../src/lib/offline-store.ts";

function storage() {
  const map = new Map();
  return { get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}
const draft = { id: "report-1", userId: "user-1", organizationId: "company-1", companyName: "Test",
  templateVersionId: "template-1", definition: { title: "Test", sections: [], rules: [] }, answers: { kund: "Kund" },
  automaticTimeFields: ["hours"], localRevision: 0, savedAt: "" };

test("drafts require consent and are isolated by owner; clearing preserves unrelated storage", () => {
  const s = storage();
  s.setItem("unrelated", "keep");
  assert.throws(() => saveLocalDraft(draft, 0, s));
  enableOffline(draft.userId, s);
  const saved = saveLocalDraft(draft, 0, s);
  assert.deepEqual(localDrafts("user-2", s), []);
  assert.throws(() => enableOffline("user-2", s));
  assert.equal(localDrafts(draft.userId, s)[0].id, draft.id);
  removeLocalDraft(draft.id, draft.userId, saved.localRevision, s);
  assert.equal(localTemplates(draft.userId, s).length, 1);
  assert.equal("answers" in localTemplates(draft.userId, s)[0], false);
  clearOffline(s);
  assert.equal(s.length, 1);
  assert.equal(s.getItem("unrelated"), "keep");
});

test("stale edits/deletions cannot overwrite newer local work; server revision is retained", () => {
  const s = storage();
  enableOffline(draft.userId, s);
  const saved = saveLocalDraft({ ...draft, reportId: draft.id, revision: 7 }, 0, s);
  assert.throws(() => saveLocalDraft({ ...saved, answers: { kund: "stale" } }, 0, s));
  assert.throws(() => removeLocalDraft(draft.id, draft.userId, 0, s));
  assert.equal(localDrafts(draft.userId, s)[0].revision, 7);
  assert.equal(localDrafts(draft.userId, s)[0].answers.kund, "Kund");
});

test("full storage fails explicitly without reporting successful persistence", () => {
  const s = storage();
  enableOffline(draft.userId, s);
  s.setItem = () => { throw new Error("quota exceeded"); };
  assert.throws(() => saveLocalDraft(draft, 0, s));
  assert.deepEqual(localDrafts(draft.userId, s), []);
});
